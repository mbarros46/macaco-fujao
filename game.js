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

  let highScore = Number(localStorage.getItem("monkeyGameHighScore") || 0);
  highscoreEl.textContent = `Recorde: ${highScore}`;

  let state = "idle"; // idle | playing | gameover

  let monkey, logs, bananas, rivers, speed, score, bananaCount, spawnTimer, bananaTimer, riverTimer, frame;
  let hunterGap, gameOverReason, hunterSwimming, hunterSwimFramesLeft, lastSwingTapFrame;

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
    };
    logs = [];
    bananas = [];
    rivers = [];
    speed = BASE_SPEED;
    score = 0;
    bananaCount = 0;
    spawnTimer = 60;
    bananaTimer = 120;
    riverTimer = 420;
    frame = 0;
    hunterGap = HUNTER_MAX_GAP;
    hunterSwimming = false;
    hunterSwimFramesLeft = 0;
    lastSwingTapFrame = -Infinity;
    gameOverReason = null;
    hunterMeterEl.classList.remove("critical");
    hunterFillEl.style.width = "0%";
  }

  function jump() {
    if (state !== "playing") return;
    if (!monkey.jumping && !monkey.swinging) {
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
    };
    finalScoreEl.textContent = `${REASON_TEXT[reason]}  Pontos: ${Math.floor(score)}  |  🍌 x ${bananaCount}`;
    gameoverScreen.classList.remove("hidden");
  }

  function spawnLog() {
    const h = 30 + Math.random() * 20;
    const w = 30 + Math.random() * 30;
    logs.push({ x: W + 20, y: GROUND_Y - h, w, h });
  }

  function spawnBanana() {
    const onGround = Math.random() < 0.5;
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
      spawnRiver();
      riverTimer = 450 + Math.random() * 300;
      spawnTimer = Math.max(spawnTimer, 100);
      bananaTimer = Math.max(bananaTimer, 80);
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

    // collisions
    const hitbox = { x: monkey.x + 6, y: monkey.y + 6, w: monkey.w - 12, h: monkey.h - 12 };
    for (const log of logs) {
      if (rectsOverlap(hitbox, log)) {
        endGame("log");
        return;
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
    const closing = hunterSwimming ? -HUNTER_SWIM_PENALTY : 0.22 + score / 2200;
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

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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

  function limbEnd(x, y, angle, len) {
    return { x: x - len * Math.sin(angle), y: y + len * Math.cos(angle) };
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

  // cylinder-shaded limb, gradient perpendicular to its length, plus a rounded end pad (paw/boot)
  function drawLimb3D(x, y, angle, len, width, color, padColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    grad.addColorStop(0, shadeColor(color, -35));
    grad.addColorStop(0.45, shadeColor(color, 20));
    grad.addColorStop(1, shadeColor(color, -55));
    ctx.fillStyle = grad;
    roundRect(-width / 2, 0, width, len, width / 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(color, -65);
    ctx.lineWidth = 1;
    ctx.stroke();
    if (padColor) {
      ctx.fillStyle = padColor;
      ctx.beginPath();
      ctx.ellipse(0, len - 1, width / 2 + 1.5, width / 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shadeColor(padColor, -50);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
    return limbEnd(x, y, angle, len);
  }

  function furTicks(cx, cy, r, color, count) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x0 = cx + Math.cos(a) * (r - 2);
      const y0 = cy + Math.sin(a) * (r - 2) * 0.9;
      const x1 = cx + Math.cos(a) * (r + 3);
      const y1 = cy + Math.sin(a) * (r + 3) * 0.9;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
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

  function drawMonkey(m, frameNum) {
    const cx = m.x + m.w / 2;
    const baseY = m.y + m.h;
    const jumping = m.jumping;
    const swing = jumping ? 0 : Math.sin(frameNum * 0.35);
    const FUR = "#6b4226";
    const FUR_DARK = "#4a2c17";
    const SKIN = "#e0b285";

    ctx.save();
    ctx.translate(cx, baseY);

    drawSoftShadow(15, 4.5);

    // tail
    const tailGrad = ctx.createLinearGradient(-8, -26, -14, -44);
    tailGrad.addColorStop(0, shadeColor(FUR, -10));
    tailGrad.addColorStop(1, shadeColor(FUR, -40));
    ctx.strokeStyle = tailGrad;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, -26);
    ctx.quadraticCurveTo(-22, -30 + swing * 3, -14, -42 + swing * 2);
    ctx.stroke();

    // back limbs (darker, further from light)
    drawLimb3D(-6, -14, jumping ? -0.6 : swing * 0.6, 14, 7, shadeColor(FUR, -20), shadeColor(FUR_DARK, -10));
    drawLimb3D(-8, -30, jumping ? 2.4 : -swing * 0.5 + 0.3, 13, 6, shadeColor(FUR, -20), SKIN);

    // body (volumetric shading, light from upper-left)
    const bodyGrad = ctx.createRadialGradient(-5, -30, 2, 0, -24, 17);
    bodyGrad.addColorStop(0, shadeColor(FUR, 45));
    bodyGrad.addColorStop(0.55, FUR);
    bodyGrad.addColorStop(1, shadeColor(FUR, -35));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, -24, 12, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    furTicks(0, -24, 13, shadeColor(FUR, -25), 22);

    // belly patch
    const bellyGrad = ctx.createRadialGradient(-1, -25, 1, 1, -21, 10);
    bellyGrad.addColorStop(0, shadeColor(SKIN, 25));
    bellyGrad.addColorStop(1, shadeColor(SKIN, -25));
    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.ellipse(1, -21, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // front leg (lit side)
    drawLimb3D(6, -14, jumping ? -1.9 : -swing * 0.6, 14, 7, FUR, shadeColor(FUR_DARK, 10));

    // head
    const headY = -40;
    const headGrad = ctx.createRadialGradient(-4, headY - 4, 1, 0, headY, 12);
    headGrad.addColorStop(0, shadeColor(FUR, 45));
    headGrad.addColorStop(0.6, FUR);
    headGrad.addColorStop(1, shadeColor(FUR, -35));
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, headY, 11, 0, Math.PI * 2);
    ctx.fill();
    furTicks(0, headY, 11, shadeColor(FUR, -25), 18);

    // ears
    for (const side of [-1, 1]) {
      const earGrad = ctx.createRadialGradient(side * 9 - side * 1.5, headY - 5.5, 0.5, side * 9, headY - 4, 5);
      earGrad.addColorStop(0, shadeColor(FUR, 30));
      earGrad.addColorStop(1, shadeColor(FUR, -25));
      ctx.fillStyle = earGrad;
      ctx.beginPath();
      ctx.arc(side * 9, headY - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      const innerGrad = ctx.createRadialGradient(side * 9, headY - 4, 0.3, side * 9, headY - 4, 2.6);
      innerGrad.addColorStop(0, shadeColor(SKIN, 20));
      innerGrad.addColorStop(1, shadeColor(SKIN, -20));
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(side * 9, headY - 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // face patch (muzzle)
    const faceGrad = ctx.createRadialGradient(0, headY + 1, 1, 1, headY + 3, 8);
    faceGrad.addColorStop(0, shadeColor(SKIN, 20));
    faceGrad.addColorStop(1, shadeColor(SKIN, -20));
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.ellipse(1, headY + 3, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // brow ridge shadow
    ctx.strokeStyle = "rgba(40,25,12,0.35)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(1, headY - 1.5, 6.5, Math.PI * 1.08, Math.PI * 1.85);
    ctx.stroke();

    // eyes: sclera + iris + pupil + highlight
    for (const ex of [-2, 5]) {
      ctx.fillStyle = "#f5ecd9";
      ctx.beginPath();
      ctx.ellipse(ex, headY, 2.1, 1.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a2313";
      ctx.beginPath();
      ctx.arc(ex, headY, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(ex, headY, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex - 0.4, headY - 0.5, 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // nostrils
    ctx.fillStyle = "#3a2313";
    ctx.beginPath();
    ctx.ellipse(-1.3, headY + 3.5, 0.7, 0.5, 0.3, 0, Math.PI * 2);
    ctx.ellipse(2.6, headY + 3.5, 0.7, 0.5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // mouth
    ctx.strokeStyle = "#3a2313";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(1, headY + 5.5, 3, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // front arm (lit side)
    drawLimb3D(8, -30, jumping ? 2.9 : swing * 0.5 - 0.2, 13, 6, SKIN, shadeColor(SKIN, -15));

    ctx.restore();
  }

  function drawHunter(hx, groundY, frameNum, swimming) {
    if (hx < -60 || hx > W + 60) return;
    const swing = Math.sin(frameNum * 0.35);
    const SHIRT = "#5a7d4a";
    const PANTS = "#4a4232";
    const SKIN = "#d8a274";
    const BOOT = "#2a1e16";

    ctx.save();
    ctx.translate(hx, swimming ? groundY - 14 : groundY);

    if (!swimming) drawSoftShadow(16, 5);

    if (swimming) {
      // ripples + splashing arm strokes instead of legs when swimming
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const rr = 10 + i * 6 + (frameNum * 0.6) % 6;
        ctx.globalAlpha = Math.max(0, 0.5 - i * 0.15);
        ctx.beginPath();
        ctx.ellipse(0, 2, rr, rr * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      drawLimb3D(-6, -14, -0.9 + swing * 0.8, 15, 7, shadeColor(SHIRT, -10), SKIN);
    } else {
      // legs with boots
      drawLimb3D(-5, -20, swing * 0.6, 18, 8, shadeColor(PANTS, -12), BOOT);
      drawLimb3D(5, -20, -swing * 0.6, 18, 8, PANTS, BOOT);
    }

    // shirt (fabric shading + folds)
    const shirtGrad = ctx.createLinearGradient(0, -46, 0, -18);
    shirtGrad.addColorStop(0, shadeColor(SHIRT, 25));
    shirtGrad.addColorStop(1, shadeColor(SHIRT, -30));
    ctx.fillStyle = shirtGrad;
    roundRect(-11, -46, 22, 28, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,20,10,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -34);
    ctx.quadraticCurveTo(0, -31, 8, -35);
    ctx.moveTo(-9, -26);
    ctx.quadraticCurveTo(0, -23, 9, -27);
    ctx.stroke();
    // chest pocket
    ctx.strokeStyle = "rgba(30,20,10,0.4)";
    ctx.strokeRect(-8, -40, 6, 6);
    // belt with buckle
    ctx.fillStyle = "#3b2a1a";
    ctx.fillRect(-11, -22, 22, 4);
    const buckleGrad = ctx.createLinearGradient(-2, -22, 2, -18);
    buckleGrad.addColorStop(0, "#d8c37a");
    buckleGrad.addColorStop(1, "#8a7638");
    ctx.fillStyle = buckleGrad;
    ctx.fillRect(-2.5, -21.5, 5, 3);

    // back arm
    drawLimb3D(-9, -42, -0.4 + swing * 0.15, 18, 6, shadeColor(SHIRT, -15), shadeColor(SKIN, -10));

    // neck
    ctx.fillStyle = shadeColor(SKIN, -15);
    ctx.fillRect(-3, -48, 6, 5);

    // head
    const headGrad = ctx.createRadialGradient(-3, -55, 1, 0, -52, 10);
    headGrad.addColorStop(0, shadeColor(SKIN, 30));
    headGrad.addColorStop(0.6, SKIN);
    headGrad.addColorStop(1, shadeColor(SKIN, -30));
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -52, 9, 0, Math.PI * 2);
    ctx.fill();

    // ear
    ctx.fillStyle = shadeColor(SKIN, -10);
    ctx.beginPath();
    ctx.ellipse(8.5, -51, 1.8, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // brow + eyes
    ctx.strokeStyle = "rgba(40,25,12,0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, -54.5);
    ctx.lineTo(-1, -55);
    ctx.moveTo(1.5, -55);
    ctx.lineTo(5, -54.2);
    ctx.stroke();
    ctx.fillStyle = "#2b1a0e";
    ctx.beginPath();
    ctx.arc(-2.3, -52, 1.1, 0, Math.PI * 2);
    ctx.arc(3, -52, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-2.6, -52.4, 0.3, 0, Math.PI * 2);
    ctx.arc(2.7, -52.4, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // nose + mustache
    ctx.strokeStyle = shadeColor(SKIN, -35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.5, -53);
    ctx.lineTo(1, -49.5);
    ctx.stroke();
    ctx.fillStyle = "#4a3524";
    ctx.beginPath();
    ctx.ellipse(0.5, -48.6, 3.2, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(SKIN, -40);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0.5, -47.8, 2, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // safari hat with underside shadow on brim
    const brimGrad = ctx.createLinearGradient(0, -61, 0, -57);
    brimGrad.addColorStop(0, shadeColor("#8a6a3a", 15));
    brimGrad.addColorStop(1, shadeColor("#8a6a3a", -35));
    ctx.fillStyle = brimGrad;
    ctx.beginPath();
    ctx.ellipse(0, -59, 12.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const domeGrad = ctx.createRadialGradient(-3, -63, 1, 0, -61, 8);
    domeGrad.addColorStop(0, shadeColor("#8a6a3a", 30));
    domeGrad.addColorStop(1, shadeColor("#8a6a3a", -20));
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(0, -61, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#5c4322";
    ctx.fillRect(-7, -60.5, 14, 2);

    // front arm reaching out, ending at hand
    const hand = drawLimb3D(10, -42, -0.5, 16, 6, shadeColor(SHIRT, 10), SKIN);

    // net (metallic rim + mesh) held at the hand
    const netCx = hand.x + 6;
    const netCy = hand.y - 4;
    const rimGrad = ctx.createLinearGradient(netCx - 9, netCy - 9, netCx + 9, netCy + 9);
    rimGrad.addColorStop(0, "#e8d9a8");
    rimGrad.addColorStop(0.5, "#b89a5e");
    rimGrad.addColorStop(1, "#7a6236");
    ctx.strokeStyle = rimGrad;
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
      const offset = (frame * (state === "playing" ? speed : 0)) % 24;
      ctx.fillRect(i - offset, GROUND_Y, 12, 6);
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

    // monkey
    drawMonkey(monkey, frame);

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
    }
  });

  canvas.addEventListener("pointerdown", handleAction);

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  // initial idle draw
  resetGame();
  draw();
})();
