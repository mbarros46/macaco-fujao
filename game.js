(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 60;

  const scoreEl = document.getElementById("score");
  const bananasEl = document.getElementById("bananas");
  const highscoreEl = document.getElementById("highscore");
  const startScreen = document.getElementById("start-screen");
  const gameoverScreen = document.getElementById("gameover-screen");
  const finalScoreEl = document.getElementById("final-score");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  const hunterFillEl = document.getElementById("hunter-fill");
  const hunterMeterEl = document.getElementById("hunter-meter");

  const GRAVITY = 0.55;
  const JUMP_FORCE = -12.5;
  const BASE_SPEED = 5;
  const HUNTER_MAX_GAP = 320;
  const HUNTER_BANANA_BONUS = 20;
  const HUNTER_SWIM_PENALTY = 0.4; // gap gained per frame the hunter is swimming
  const SWING_LIFT = 55; // extra height gained above the grab point during a vine swing
  const MAX_HANG_GRACE = 90; // frames allowed hanging still after the arc settles before the vine snaps
  const JUMP_AIR_FRAMES = (2 * Math.abs(JUMP_FORCE)) / GRAVITY;
  const DOUBLE_TAP_WINDOW = 21; // frames (~350ms at 60fps) allowed between the two release taps
  const MIN_HAZARD_GAP = 40; // frames of spacing enforced between a log spawn and a banana spawn
  const RIVER_LOG_CLEARANCE = 160; // px of clear runway required in front of the last log before a river can spawn
  const ROCK_LOG_CLEARANCE = 160; // px of clear runway required in front of the last log before a rock can spawn
  const ROCK_RIVER_CLEARANCE = 320; // px of clear runway required between a rock and a river (either order) — keeps the two big set-pieces well apart
  const ROCK_DIG_GRACE = 50; // frames allowed to start digging (holding a seta para baixo) once the monkey reaches a rock
  const ROCK_DIG_DURATION = 55; // frames of held down-arrow needed to dig all the way under a rock
  const ROCK_DIG_DEPTH = 30; // px the monkey sinks into the ground while digging

  let highScore = Number(localStorage.getItem("monkeyGameHighScore") || 0);
  highscoreEl.textContent = `Recorde: ${highScore}`;

  let state = "idle"; // idle | playing | gameover

  let monkey, logs, bananas, rivers, rocks, speed, score, bananaCount, spawnTimer, bananaTimer, riverTimer, rockTimer, frame;
  let hunterGap, gameOverReason, hunterSwimming, hunterSwimFramesLeft, lastSwingTapFrame;
  let activeRock, rockGraceLeft, digProgress, groundOffset;
  let downHeld = false; // tracks the down-arrow being held, needed for the dig-to-clear-a-rock mechanic

  function resetGame() {
    monkey = {
      x: 90,
      y: GROUND_Y - 40,
      w: 40,
      h: 40,
      vy: 0,
      jumping: false,
      swinging: false,
      swingT: 0,
      swingDuration: 0,
      digging: false,
    };
    logs = [];
    bananas = [];
    rivers = [];
    rocks = [];
    speed = BASE_SPEED;
    score = 0;
    bananaCount = 0;
    spawnTimer = 60;
    bananaTimer = 120;
    riverTimer = 420;
    rockTimer = 500 + Math.random() * 200;
    frame = 0;
    hunterGap = HUNTER_MAX_GAP;
    hunterSwimming = false;
    hunterSwimFramesLeft = 0;
    lastSwingTapFrame = -Infinity;
    activeRock = null;
    rockGraceLeft = 0;
    digProgress = 0;
    groundOffset = 0;
    gameOverReason = null;
    hunterMeterEl.classList.remove("critical");
    hunterFillEl.style.width = "0%";
  }

  function jump() {
    if (state !== "playing") return;
    if (!monkey.jumping && !monkey.swinging && !activeRock) {
      monkey.vy = JUMP_FORCE;
      monkey.jumping = true;
    }
  }

  // releasing the vine takes two taps within DOUBLE_TAP_WINDOW frames of each other;
  // miss the window (or never tap) and the swing just keeps hanging while the hunter closes in
  function handleSwingRelease() {
    if (frame - lastSwingTapFrame <= DOUBLE_TAP_WINDOW) {
      monkey.swinging = false;
      monkey.vy = 0; // resumes falling naturally next frame from wherever the release happened
      lastSwingTapFrame = -Infinity;
    } else {
      lastSwingTapFrame = frame;
    }
  }

  function handleAction() {
    if (state === "idle") startGame();
    else if (state === "playing") {
      if (monkey.swinging) handleSwingRelease();
      else jump();
    } else if (state === "gameover") startGame();
  }

  function startGame() {
    resetGame();
    state = "playing";
    startScreen.classList.add("hidden");
    gameoverScreen.classList.add("hidden");
    requestAnimationFrame(loop);
  }

  function endGame(reason) {
    state = "gameover";
    gameOverReason = reason;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("monkeyGameHighScore", String(highScore));
      highscoreEl.textContent = `Recorde: ${highScore}`;
    }
    const REASON_TEXT = {
      hunter: "O caçador te agarrou! 🥅",
      river: "Você caiu no rio! 🌊",
      vine: "O cipó arrebentou de tanto você ficar pendurado! 🍃",
      log: "Você bateu num tronco! 🪵",
      rock: "A rocha bloqueou seu caminho! 🪨",
    };
    finalScoreEl.textContent = `${REASON_TEXT[reason]}  Pontos: ${Math.floor(score)}  |  🍌 x ${bananaCount}`;
    gameoverScreen.classList.remove("hidden");
  }

  function spawnLog() {
    const h = 30 + Math.random() * 20;
    const w = 30 + Math.random() * 30;
    logs.push({ x: W + 20, y: GROUND_Y - h, w, h });
  }

  // rocks are a hard wall — too tall to jump, they force the monkey to stop and dig underneath
  function spawnRock() {
    const w = 55 + Math.random() * 20;
    rocks.push({ x: W + 20, w, h: 46 });
  }

  function spawnBanana() {
    const onGround = Math.random() < 0.7;
    const y = onGround ? GROUND_Y - 30 : GROUND_Y - 110 - Math.random() * 30;
    bananas.push({ x: W + 20, y, w: 26, h: 26, collected: false });
  }

  // rivers are wider than any normal jump can clear, so crossing them requires grabbing the vine
  function spawnRiver() {
    const w = Math.round(JUMP_AIR_FRAMES * speed) + 70 + Math.random() * 40;
    const swingDuration = Math.ceil((w + 90) / speed) + 15;
    rivers.push({
      x: W + 20,
      w,
      vineOffset: w * 0.18,
      vineGrabbed: false,
      swingDuration,
      hunterSwimDuration: Math.round(swingDuration * 1.3), // swimming takes the hunter longer than swinging
      hunterTriggered: false,
      phase: Math.random() * 10,
    });
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function update() {
    frame++;
    speed = BASE_SPEED + score / 400;

    // monkey physics: normal gravity, or a scripted arc while swinging on a vine
    if (monkey.swinging) {
      monkey.swingT++;
      // hanging on too long snaps the vine — you must double-tap to let go within the grace window
      if (monkey.swingT > monkey.swingDuration + MAX_HANG_GRACE) {
        endGame("vine");
        return;
      }
      const t = Math.min(1, monkey.swingT / monkey.swingDuration);
      const arc = Math.sin(t * Math.PI) * SWING_LIFT;
      // once the rise-and-settle arc finishes, hang with a gentle idle sway until released
      const idleSway = t >= 1 ? Math.sin(frame * 0.08) * 4 : 0;
      monkey.y = monkey.swingStartY - arc - idleSway;
      // no automatic release otherwise: the player must double-tap to let go (see handleSwingRelease)
    } else {
      monkey.vy += GRAVITY;
      monkey.y += monkey.vy;
      if (monkey.y >= GROUND_Y - monkey.h) {
        monkey.y = GROUND_Y - monkey.h;
        monkey.vy = 0;
        monkey.jumping = false;
      }
    }

    // everything below only advances while the monkey is free to run — reaching a rock freezes
    // the whole world (except the hunter, who keeps closing in) until the rock is dug through
    if (!activeRock) {
      groundOffset = (groundOffset + speed) % 24;

      // spawn logs
      spawnTimer--;
      if (spawnTimer <= 0) {
        spawnLog();
        spawnTimer = 70 - Math.min(30, Math.floor(score / 20)) + Math.random() * 40;
        bananaTimer = Math.max(bananaTimer, MIN_HAZARD_GAP); // keep bananas from landing right next to the log
      }

      // spawn bananas
      bananaTimer--;
      if (bananaTimer <= 0) {
        spawnBanana();
        bananaTimer = 90 + Math.random() * 90;
        spawnTimer = Math.max(spawnTimer, MIN_HAZARD_GAP); // keep the next log from landing right next to the banana
      }

      // spawn rivers (rare set-piece; only one on screen at a time)
      riverTimer--;
      if (riverTimer <= 0 && rivers.length === 0) {
        // don't drop the river right behind a log already on screen — that leaves no runway to land
        // between jumping the log and needing to grab the vine, so the jump carries straight into the water
        const lastLog = logs[logs.length - 1];
        // keep rivers and rocks well apart — two big set-pieces back-to-back would be unfair
        const lastRock = rocks[rocks.length - 1];
        const logClear = !lastLog || lastLog.x + lastLog.w < W - RIVER_LOG_CLEARANCE;
        const rockClear = !lastRock || lastRock.x + lastRock.w < W - ROCK_RIVER_CLEARANCE;
        if (logClear && rockClear) {
          spawnRiver();
          riverTimer = 450 + Math.random() * 300;
          spawnTimer = Math.max(spawnTimer, 100);
          bananaTimer = Math.max(bananaTimer, 80);
          rockTimer = Math.max(rockTimer, 200);
        } else {
          riverTimer = 10; // retry shortly once the runway ahead clears
        }
      }

      // spawn rocks (rare set-piece; only one on screen at a time)
      rockTimer--;
      if (rockTimer <= 0 && rocks.length === 0) {
        // same runway concern as rivers: don't drop a rock right behind a log, or there's no room to stop
        const lastLog = logs[logs.length - 1];
        const lastRiver = rivers[rivers.length - 1];
        const logClear = !lastLog || lastLog.x + lastLog.w < W - ROCK_LOG_CLEARANCE;
        const riverClear = !lastRiver || lastRiver.x + lastRiver.w < W - ROCK_RIVER_CLEARANCE;
        if (logClear && riverClear) {
          spawnRock();
          rockTimer = 500 + Math.random() * 300;
          spawnTimer = Math.max(spawnTimer, 100);
          bananaTimer = Math.max(bananaTimer, 80);
          riverTimer = Math.max(riverTimer, 200);
        } else {
          rockTimer = 10; // retry shortly once the runway ahead clears
        }
      }

      // move logs
      for (const log of logs) log.x -= speed;
      logs = logs.filter((l) => l.x + l.w > -10);

      // move bananas
      for (const b of bananas) b.x -= speed;
      bananas = bananas.filter((b) => b.x + b.w > -10 && !b.collected);

      // move rivers (kept around well past the screen edge so a far-behind hunter can still reach them)
      for (const river of rivers) river.x -= speed;
      rivers = rivers.filter((r) => r.x + r.w > -HUNTER_MAX_GAP - 60);

      // move rocks
      for (const rock of rocks) rock.x -= speed;
      rocks = rocks.filter((r) => r.x + r.w > -10);
    }

    // collisions
    const hitbox = { x: monkey.x + 6, y: monkey.y + 6, w: monkey.w - 12, h: monkey.h - 12 };
    for (const log of logs) {
      if (rectsOverlap(hitbox, log)) {
        endGame("log");
        return;
      }
    }

    // rocks: a boulder is too tall to jump over. Crashing into it airborne is a game over,
    // but reaching it on the ground stops the monkey so the player can dig underneath instead
    if (!activeRock) {
      for (const rock of rocks) {
        const tallZone = { x: rock.x, y: GROUND_Y - 170, w: rock.w, h: 170 };
        if (rectsOverlap(hitbox, tallZone)) {
          if (monkey.jumping || monkey.swinging) {
            endGame("rock");
            return;
          }
          activeRock = rock;
          rockGraceLeft = ROCK_DIG_GRACE;
          digProgress = 0;
          monkey.digging = false;
          break;
        }
      }
    }

    // digging: the grace window requires holding the down arrow before it runs out, then holding
    // it again drives the dig progress — releasing simply pauses at the current depth
    if (activeRock) {
      if (!monkey.digging) {
        if (downHeld) {
          monkey.digging = true;
        } else {
          rockGraceLeft--;
          if (rockGraceLeft <= 0) {
            endGame("rock");
            return;
          }
        }
      }
      if (monkey.digging && downHeld) {
        digProgress++;
        monkey.y = GROUND_Y - monkey.h + Math.min(ROCK_DIG_DEPTH, (digProgress / ROCK_DIG_DURATION) * ROCK_DIG_DEPTH);
        if (digProgress >= ROCK_DIG_DURATION) {
          rocks = rocks.filter((r) => r !== activeRock);
          activeRock = null;
          monkey.digging = false;
          monkey.y = GROUND_Y - monkey.h;
          digProgress = 0;
        }
      }
    }

    for (const b of bananas) {
      if (!b.collected && rectsOverlap(hitbox, b)) {
        b.collected = true;
        bananaCount++;
        score += 10;
        hunterGap = Math.min(HUNTER_MAX_GAP, hunterGap + HUNTER_BANANA_BONUS);
      }
    }

    // rivers: grab the vine while jumping to swing across, or fall in if grounded
    for (const river of rivers) {
      const vineX = river.x + river.vineOffset;
      if (!monkey.swinging && !river.vineGrabbed && monkey.jumping) {
        const vineZone = { x: vineX - 12, y: GROUND_Y - 150, w: 24, h: 115 };
        if (rectsOverlap(hitbox, vineZone)) {
          river.vineGrabbed = true;
          monkey.swinging = true;
          monkey.jumping = true;
          monkey.swingT = 0;
          monkey.swingDuration = river.swingDuration;
          monkey.swingStartY = monkey.y;
        }
      }
      // top edge raised above GROUND_Y so it actually reaches the (inset) hitbox when grounded —
      // otherwise the 6px hitbox padding always leaves a gap and the collision never fires
      if (!monkey.swinging && rectsOverlap(hitbox, { x: river.x, y: GROUND_Y - 16, w: river.w, h: H - GROUND_Y + 16 })) {
        endGame("river");
        return;
      }
    }

    // hunter closing in — swimming across a river slows him down a lot.
    // Once triggered, the slowdown runs for a fixed duration instead of being re-checked every
    // frame: re-checking live would be unstable, since the penalty itself changes hunterX, which
    // could immediately un-trigger the very overlap that caused it (a one-frame flicker).
    const hunterX = monkey.x - hunterGap;
    if (hunterSwimFramesLeft > 0) {
      hunterSwimFramesLeft--;
      hunterSwimming = true;
    } else {
      hunterSwimming = false;
      for (const river of rivers) {
        if (!river.hunterTriggered && hunterX + 14 > river.x && hunterX - 14 < river.x + river.w) {
          river.hunterTriggered = true;
          hunterSwimFramesLeft = river.hunterSwimDuration;
          hunterSwimming = true;
          break;
        }
      }
    }
    const closing = hunterSwimming ? -HUNTER_SWIM_PENALTY : 0.16 + score / 2200;
    hunterGap -= closing;
    if (hunterGap <= 0) {
      endGame("hunter");
      return;
    }
    const dangerPct = Math.max(0, Math.min(100, (1 - hunterGap / HUNTER_MAX_GAP) * 100));
    hunterFillEl.style.width = `${dangerPct}%`;
    hunterMeterEl.classList.toggle("critical", dangerPct > 75);

    score += 0.15;
    scoreEl.textContent = `Pontos: ${Math.floor(score)}`;
    bananasEl.textContent = `🍌 x ${bananaCount}`;
  }

  function shadeColor(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0xff) + percent;
    let b = (num & 0xff) + percent;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return "#" + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }

  function drawSoftShadow(rx, ry) {
    const grad = ctx.createRadialGradient(0, -1, 1, 0, -1, rx);
    grad.addColorStop(0, "rgba(20,15,10,0.38)");
    grad.addColorStop(1, "rgba(20,15,10,0)");
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -1, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawVineRope(ax, ay, hx, hy, armed) {
    ctx.save();
    ctx.strokeStyle = armed ? "#d9c23c" : "#3f6b2a";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + hx) / 2 + (hx - ax) * 0.15, (ay + hy) / 2, hx, hy);
    ctx.stroke();
    // leaf tufts along the vine
    for (let t = 0.25; t < 1; t += 0.25) {
      const lx = ax + (hx - ax) * t;
      const ly = ay + (hy - ay) * t;
      ctx.fillStyle = "#4f8a34";
      ctx.beginPath();
      ctx.ellipse(lx - 3, ly, 4, 2, 0.6, 0, Math.PI * 2);
      ctx.ellipse(lx + 3, ly + 2, 4, 2, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // knot/handle
    ctx.fillStyle = "#5c4322";
    ctx.beginPath();
    ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLittleHand(x, y, color, outline) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // finger creases
    ctx.strokeStyle = outline;
    ctx.lineWidth = 0.8;
    for (const fx of [-2, 0, 2]) {
      ctx.beginPath();
      ctx.moveTo(x + fx, y + 3);
      ctx.lineTo(x + fx, y + 4.8);
      ctx.stroke();
    }
  }

  // flat, bold-outlined "emoji sticker" style: no gradients/fur texture, just clean shapes
  function drawMonkey(m, frameNum) {
    const cx = m.x + m.w / 2;
    const baseY = m.y + m.h;
    const jumping = m.jumping;
    const swing = jumping ? 0 : Math.sin(frameNum * 0.35);
    const FUR = "#8a5a34";
    const SKIN = "#f2c9a0";
    const OUTLINE = "#3d2612";

    ctx.save();
    ctx.translate(cx, baseY);

    drawSoftShadow(15, 4.5);

    const headY = -24;

    // ears (behind the head so only the outer half peeks out)
    for (const side of [-1, 1]) {
      ctx.fillStyle = FUR;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(side * 10, headY - 2, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      ctx.arc(side * 10, headY - 2, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // head (flat fur circle)
    ctx.fillStyle = FUR;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, headY, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // face patch (flat tan oval, emoji-style)
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.ellipse(0, headY + 3, 9, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyebrows
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (const ex of [-4, 5]) {
      ctx.beginPath();
      ctx.arc(ex, headY - 1.5, 2.2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // eyes: big flat circles + highlight, classic emoji look
    for (const ex of [-4, 5]) {
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(ex, headY + 1.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex - 0.7, headY + 0.6, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // nostrils
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(-1.6, headY + 5.5, 0.7, 0.5, 0.3, 0, Math.PI * 2);
    ctx.ellipse(2.6, headY + 5.5, 0.7, 0.5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // mouth
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0.5, headY + 7, 3, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // little floating hands (no arms/body connecting them)
    const bob = jumping ? -3 : swing * 2;
    drawLittleHand(-19, headY + 9 - bob, SKIN, OUTLINE);
    drawLittleHand(19, headY + 9 + bob, SKIN, OUTLINE);

    ctx.restore();
  }

  // net held in the hunter's floating hand: short handle + hooped mesh
  function drawNet(handX, handY) {
    const netCx = handX + 7;
    const netCy = handY - 7;
    ctx.strokeStyle = "#6b4b24";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(netCx, netCy);
    ctx.stroke();

    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(netCx, netCy, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,90,50,0.55)";
    ctx.lineWidth = 0.8;
    for (let i = -8; i <= 8; i += 4) {
      ctx.beginPath();
      ctx.moveTo(netCx - 8, netCy + i);
      ctx.lineTo(netCx + 8, netCy + i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(netCx + i, netCy - 8);
      ctx.lineTo(netCx + i, netCy + 8);
      ctx.stroke();
    }
  }

  // flat, bold-outlined "emoji sticker" style, matching the monkey: just a head with floating hands
  function drawHunter(hx, groundY, frameNum, swimming) {
    if (hx < -60 || hx > W + 60) return;
    const swing = Math.sin(frameNum * 0.35);
    const SKIN = "#d8a274";
    const OUTLINE = "#3d2612";
    const HAT = "#c9a24a";

    ctx.save();
    ctx.translate(hx, swimming ? groundY - 14 : groundY);

    if (!swimming) drawSoftShadow(16, 5);

    const headY = -24;

    if (swimming) {
      // ripples instead of a splashing body, since there's no body/legs anymore
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const rr = 10 + i * 6 + (frameNum * 0.6) % 6;
        ctx.globalAlpha = Math.max(0, 0.5 - i * 0.15);
        ctx.beginPath();
        ctx.ellipse(0, headY + 24, rr, rr * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ears
    for (const side of [-1, 1]) {
      ctx.fillStyle = SKIN;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(side * 10.5, headY, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // head (flat skin circle)
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, headY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // eyebrows
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, headY - 3);
    ctx.lineTo(-2, headY - 4);
    ctx.moveTo(2, headY - 4);
    ctx.lineTo(7, headY - 3);
    ctx.stroke();

    // eyes
    for (const ex of [-4.5, 4.5]) {
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(ex, headY, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex - 0.6, headY - 0.6, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // mustache
    ctx.fillStyle = "#4a3524";
    ctx.beginPath();
    ctx.ellipse(0, headY + 5.5, 5, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // mouth
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, headY + 7, 2.4, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // safari hat
    ctx.fillStyle = HAT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, headY - 10, 13.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, headY - 12, 8, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = shadeColor(HAT, -30);
    ctx.fillRect(-8, headY - 12.5, 16, 2.2);

    // little floating hands, one holding the net
    const bob = swing * 2;
    drawLittleHand(-19, headY + 9 - bob, SKIN, OUTLINE);
    const netHandX = 19;
    const netHandY = headY + 9 + bob;
    drawNet(netHandX, netHandY);
    drawLittleHand(netHandX, netHandY, SKIN, OUTLINE);

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // sky gradient already via CSS; draw sun
    ctx.font = "40px serif";
    ctx.fillText("☀️", W - 80, 60);

    // ground
    ctx.fillStyle = "#7a9e4f";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#5c7d3a";
    for (let i = 0; i < W; i += 24) {
      ctx.fillRect(i - groundOffset, GROUND_Y, 12, 6);
    }

    // rivers
    for (const river of rivers) {
      const wgrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
      wgrad.addColorStop(0, "#5aa9d6");
      wgrad.addColorStop(1, "#2c6f9e");
      ctx.fillStyle = wgrad;
      ctx.fillRect(river.x, GROUND_Y, river.w, H - GROUND_Y);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      for (let wx = 0; wx < river.w; wx += 20) {
        const wy = GROUND_Y + 10 + Math.sin(frame * 0.1 + wx) * 3;
        ctx.beginPath();
        ctx.moveTo(river.x + wx, wy);
        ctx.quadraticCurveTo(river.x + wx + 5, wy + 4, river.x + wx + 10, wy);
        ctx.stroke();
      }
    }

    // logs
    ctx.font = "40px serif";
    for (const log of logs) {
      ctx.save();
      ctx.translate(log.x + log.w / 2, log.y + log.h / 2);
      ctx.font = `${Math.max(log.w, log.h) + 10}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🪵", 0, 0);
      ctx.restore();
    }

    // rocks
    for (const rock of rocks) {
      ctx.save();
      ctx.translate(rock.x + rock.w / 2, GROUND_Y - rock.h / 2 + 6);
      ctx.font = `${rock.h + 32}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🪨", 0, 0);
      ctx.restore();
    }

    // bananas
    ctx.font = "26px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const b of bananas) {
      ctx.fillText("🍌", b.x + b.w / 2, b.y + b.h / 2);
    }

    // vines waiting to be grabbed, swaying over their river
    for (const river of rivers) {
      if (river.vineGrabbed) continue;
      const vineX = river.x + river.vineOffset;
      const handX = vineX + Math.sin(frame * 0.05 + river.phase) * 8;
      const handY = GROUND_Y - 95;
      drawVineRope(vineX, 0, handX, handY);
    }

    // hunter chasing from behind
    const hunterX = monkey.x - hunterGap;
    drawHunter(hunterX, GROUND_Y, frame, hunterSwimming);

    // vine currently carrying the monkey (anchored above its fixed screen position)
    if (monkey.swinging) {
      const cx = monkey.x + monkey.w / 2;
      const armed = frame - lastSwingTapFrame <= DOUBLE_TAP_WINDOW;
      drawVineRope(cx, 0, cx, monkey.y + monkey.h / 2, armed);
    }

    // monkey (clipped at ground level while digging, so it visually sinks into the earth)
    if (monkey.digging) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, GROUND_Y);
      ctx.clip();
      drawMonkey(monkey, frame);
      ctx.restore();

      // dust kicked up around the dig site
      const dustX = monkey.x + monkey.w / 2;
      ctx.fillStyle = "rgba(120,90,50,0.5)";
      for (let i = 0; i < 3; i++) {
        const a = frame * 0.3 + i * 2;
        ctx.beginPath();
        ctx.ellipse(dustX + Math.cos(a) * 14, GROUND_Y - 2 + Math.sin(a * 1.7) * 3, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      drawMonkey(monkey, frame);
    }

    // dig progress / grace-window hint while stuck at a rock
    if (activeRock) {
      const barX = monkey.x - 10;
      const barY = monkey.y - 14;
      const barW = 60;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(barX, barY, barW, 6);
      if (monkey.digging) {
        ctx.fillStyle = "#d9c23c";
        ctx.fillRect(barX, barY, barW * (digProgress / ROCK_DIG_DURATION), 6);
      } else {
        ctx.fillStyle = "#fff";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⬇ cave!", monkey.x + monkey.w / 2, barY - 6);
      }
    }

    // danger vignette when hunter is close
    if (state === "playing" && hunterGap < 100) {
      const pulse = 0.15 + 0.15 * Math.abs(Math.sin(frame / 6));
      ctx.save();
      ctx.globalAlpha = pulse * (1 - hunterGap / 100);
      ctx.fillStyle = "#c81e1e";
      ctx.fillRect(0, 0, W, 10);
      ctx.fillRect(0, H - 10, W, 10);
      ctx.restore();
    }
  }

  function loop() {
    if (state !== "playing") return;
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // input
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      handleAction();
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      downHeld = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown") downHeld = false;
  });

  canvas.addEventListener("pointerdown", handleAction);

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  // initial idle draw
  resetGame();
  draw();
})();
