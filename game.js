import {
  W, H, GROUND_Y, BASE_SPEED, MAX_SPEED, HUNTER_MAX_GAP, ROCK_DIG_GRACE,
  ROCK_DIG_DURATION, ROCK_DIG_DEPTH, VICTORY_SCORE, UFO_TRANSITION_SCORE,
  PHASES, MAX_LIVES, INVULNERABLE_FRAMES, phaseIndexFor,
  SUPER_JUMP_DURATION, MAGNET_DURATION, FREEZE_DURATION,
} from "./Config.js";
import { computeTheme } from "./Theme.js";
import { drawVineRope } from "./Helpers.js";
import { Player, PLAYER_HOME_X } from "./Player.js";
import { Hunter } from "./Hunter.js";
import { Environment } from "./Environment.js";
import { Backdrop } from "./Backdrop.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bananasEl = document.getElementById("bananas");
const highscoreEl = document.getElementById("highscore");
const phaseNameEl = document.getElementById("phase-name");
const phaseFillEl = document.getElementById("phase-fill");
const startScreen = document.getElementById("start-screen");
const gameoverScreen = document.getElementById("gameover-screen");
const finalScoreEl = document.getElementById("final-score");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const victoryScreen = document.getElementById("victory-screen");
const victoryScoreEl = document.getElementById("victory-score");
const restartVictoryBtn = document.getElementById("restart-victory-btn");
const pauseScreen = document.getElementById("pause-screen");
const resumeBtn = document.getElementById("resume-btn");
const hunterFillEl = document.getElementById("hunter-fill");
const hunterMeterEl = document.getElementById("hunter-meter");
const digBtn = document.getElementById("dig-btn");

// ---------------------------------------------------------------------------
// Áudio sintetizado (Web Audio API) — sem arquivos externos
// ---------------------------------------------------------------------------
const AudioCtor = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtor ? new AudioCtor() : null;

function unlockAudio() {
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function playTone({ freq = 440, duration = 0.15, type = "sine", startFreq = null, endFreq = null, volume = 0.25 }) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  if (startFreq && endFreq) {
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  } else {
    osc.frequency.setValueAtTime(freq, now);
  }
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playNoiseBurst(duration = 0.2, volume = 0.2) {
  if (!audioCtx) return;
  const bufferSize = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  noise.connect(gain).connect(audioCtx.destination);
  noise.start();
}

const sfx = {
  jump: () => playTone({ startFreq: 300, endFreq: 650, duration: 0.14, type: "square", volume: 0.15 }),
  banana: () => {
    playTone({ startFreq: 500, endFreq: 900, duration: 0.1, type: "triangle", volume: 0.2 });
    setTimeout(() => playTone({ startFreq: 700, endFreq: 1100, duration: 0.09, type: "triangle", volume: 0.15 }), 55);
  },
  heart: () => {
    [660, 880, 1100].forEach((f, i) => setTimeout(() => playTone({ freq: f, duration: 0.12, type: "sine", volume: 0.2 }), i * 70));
  },
  vineGrab: () => playTone({ startFreq: 260, endFreq: 420, duration: 0.08, type: "sine", volume: 0.15 }),
  vineRelease: () => playTone({ startFreq: 420, endFreq: 260, duration: 0.08, type: "sine", volume: 0.15 }),
  digTick: () => playTone({ freq: 140 + Math.random() * 50, duration: 0.05, type: "square", volume: 0.08 }),
  splash: () => {
    playTone({ startFreq: 220, endFreq: 60, duration: 0.3, type: "sine", volume: 0.22 });
    playNoiseBurst(0.18, 0.15);
  },
  hit: () => playTone({ startFreq: 200, endFreq: 50, duration: 0.28, type: "sawtooth", volume: 0.28 }),
  gameover: () => playTone({ startFreq: 400, endFreq: 80, duration: 0.5, type: "sawtooth", volume: 0.25 }),
  shieldUp: () => {
    playTone({ startFreq: 400, endFreq: 950, duration: 0.22, type: "sine", volume: 0.2 });
    setTimeout(() => playTone({ freq: 1250, duration: 0.16, type: "sine", volume: 0.14 }), 110);
  },
  shieldBreak: () => {
    playTone({ startFreq: 900, endFreq: 200, duration: 0.26, type: "triangle", volume: 0.22 });
    playNoiseBurst(0.16, 0.12);
  },
  magnet: () => {
    [700, 900, 1150].forEach((f, i) => setTimeout(() => playTone({ freq: f, duration: 0.1, type: "square", volume: 0.13 }), i * 55));
  },
  freeze: () => {
    playTone({ startFreq: 1400, endFreq: 300, duration: 0.5, type: "sine", volume: 0.2 });
    setTimeout(() => playTone({ freq: 220, duration: 0.3, type: "triangle", volume: 0.12 }), 160);
  },
  phaseUp: () => {
    [523.25, 659.25, 880].forEach((f, i) => setTimeout(() => playTone({ freq: f, duration: 0.18, type: "triangle", volume: 0.22 }), i * 90));
  },
  beam: () => playTone({ startFreq: 180, endFreq: 1200, duration: 1.1, type: "sine", volume: 0.16 }),
  launch: () => {
    playTone({ startFreq: 120, endFreq: 700, duration: 1.4, type: "sawtooth", volume: 0.2 });
    playNoiseBurst(1.2, 0.12);
  },
  victory: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      setTimeout(() => playTone({ freq, duration: 0.25, type: "triangle", volume: 0.25 }), i * 120);
    });
  },
};

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
let highScore = Number(localStorage.getItem("monkeyGameHighScore") || 0);
highscoreEl.textContent = `Recorde: ${highScore}`;

const player = new Player();
const hunter = new Hunter();
const environment = new Environment();
const backdrop = new Backdrop();

// idle | playing | transition | victory | gameover
let state = "idle";
let paused = false;
let rafId = null;

let speed, score, bananaCount, frame;
let activeRock, rockGraceLeft, digProgress, groundOffset;
let downHeld = false;
let lastDamageReason = null;
let shakeTime = 0;
let flashAlpha = 0;

let theme;
let lastPhaseIdx = 0;
let banner = null;

let ufo = {};
let transitionDone = false;
let rocket = null;
let victoryStage = "arrive";

function triggerScreenShake(amount = 12) {
  shakeTime = Math.max(shakeTime, amount);
}

function resetGame() {
  player.reset();
  hunter.reset();
  environment.reset();
  backdrop.reset();

  speed = BASE_SPEED;
  score = 0;
  bananaCount = 0;
  frame = 0;

  activeRock = null;
  rockGraceLeft = 0;
  digProgress = 0;
  groundOffset = 0;
  downHeld = false;
  shakeTime = 0;
  flashAlpha = 0;

  theme = computeTheme(0);
  lastPhaseIdx = 0;
  banner = null;
  paused = false;

  // Estes três precisam voltar ao estado inicial: sem resetá-los, a segunda
  // partida pulava a cutscene do OVNI e herdava o foguete da vitória anterior.
  transitionDone = false;
  rocket = null;
  victoryStage = "arrive";

  ufo = { x: -100, y: 40, active: false, timer: 700, speed: 2.5, state: "fly-in", beamProgress: 0, beamOpacity: 0, rescueStage: null, rescueT: 0 };

  hunterMeterEl.classList.remove("critical");
  hunterFillEl.style.width = "0%";
  victoryScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  if (digBtn) digBtn.classList.add("hidden");
  updateHud();
}

function showBanner(idx) {
  const phase = PHASES[idx];
  banner = { title: `${phase.emoji}  Fase ${idx + 1} — ${phase.name}`, sub: phase.tagline, t: 0, life: 170 };
  sfx.phaseUp();
  flashAlpha = 0.5;
}

function handleAction() {
  unlockAudio();
  if (state === "idle") startGame();
  else if (state === "gameover") startGame();
  else if (state === "playing" && !paused) {
    if (player.swinging) player.releaseVine(sfx);
    else player.jump(sfx);
  }
}

function startGame() {
  resetGame();
  state = "playing";
  startScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  victoryScreen.classList.add("hidden");
  showBanner(0);
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function togglePause() {
  if (state !== "playing") return;
  paused = !paused;
  pauseScreen.classList.toggle("hidden", !paused);
  if (paused) downHeld = false;
}

// ---------------------------------------------------------------------------
// Dano e fim de jogo
// ---------------------------------------------------------------------------
function handleDamage(reason) {
  if (player.invulnerableTimer > 0) return;
  lastDamageReason = reason;

  // Limpa o perigo que causou o dano. A rocha, em especial, travava o jogo:
  // `update()` retornava cedo enquanto `activeRock` existisse, congelando tudo.
  if (activeRock) {
    environment.rocks = environment.rocks.filter((r) => r !== activeRock);
    activeRock = null;
    player.digging = false;
    player.y = GROUND_Y - player.h;
    digProgress = 0;
  }
  player.releaseVine(null);

  // O escudo absorve o golpe inteiro antes de encostar nas vidas.
  if (player.shield) {
    player.shield = false;
    player.invulnerableTimer = INVULNERABLE_FRAMES;
    triggerScreenShake();
    sfx.shieldBreak();
    hunter.gap = Math.min(HUNTER_MAX_GAP, hunter.gap + 90);
    return;
  }

  player.lives--;

  if (player.lives <= 0) {
    endGame(reason);
    return;
  }

  player.invulnerableTimer = INVULNERABLE_FRAMES;
  triggerScreenShake();
  if (reason === "river") sfx.splash();
  else sfx.hit();
  hunter.gap = Math.min(HUNTER_MAX_GAP, hunter.gap + 150);
}

const REASON_TEXT = {
  hunter: "O caçador te agarrou! 🥅",
  river: "Você caiu no rio! 🌊",
  vine: "O cipó arrebentou de tanto você ficar pendurado! 🍃",
  log: "Você bateu num tronco! 🪵",
  cactus: "Espinho de cacto não perdoa! 🌵",
  bone: "Tropeçou numa ossada! 🦴",
  meteor: "Um meteoro te acertou em cheio! ☄️",
  rock: "A rocha bloqueou seu caminho! 🪨",
  bird: "A arara te derrubou! 🦜 (era pra abaixar!)",
  vulture: "O abutre te pegou de cheio! 🦅 (era pra abaixar!)",
  bat: "O morcego acertou sua cabeça! 🦇 (era pra abaixar!)",
  satellite: "Colidiu com um satélite! 🛰️ (era pra abaixar!)",
};

function endGame(reason) {
  state = "gameover";
  paused = false;
  downHeld = false;
  if (digBtn) digBtn.classList.add("hidden");
  triggerScreenShake(16);
  if (reason === "river") sfx.splash();
  else sfx.hit();
  setTimeout(() => sfx.gameover(), 180);

  saveHighScore();

  const phase = PHASES[phaseIndexFor(score)];
  finalScoreEl.innerHTML =
    `${REASON_TEXT[reason] || "Fim da fuga!"}<br>` +
    `Chegou até a <b>Fase ${phaseIndexFor(score) + 1} — ${phase.name}</b> ${phase.emoji}<br>` +
    `Pontos: <b>${Math.floor(score)}</b> &nbsp;|&nbsp; 🍌 x ${bananaCount}`;
  gameoverScreen.classList.remove("hidden");
}

function saveHighScore() {
  if (score > highScore) {
    highScore = Math.floor(score);
    localStorage.setItem("monkeyGameHighScore", String(highScore));
    highscoreEl.textContent = `Recorde: ${highScore}`;
  }
}

// ---------------------------------------------------------------------------
// Cutscene: abdução pelo OVNI (vulcão → espaço)
// ---------------------------------------------------------------------------
function updateAmbientUfo() {
  // Easter egg: o OVNI só passeia pelo céu do espaço quando não está numa
  // cutscene de resgate.
  if (ufo.rescueStage) return;
  if (theme.toIdx !== 3) {
    ufo.active = false;
    return;
  }

  if (!ufo.active) {
    ufo.timer--;
    if (ufo.timer <= 0) {
      ufo.active = true;
      ufo.x = W + 100;
      ufo.y = 30 + Math.random() * 40;
      ufo.speed = 2.5;
      ufo.state = "fly-in";
      ufo.beamProgress = 0;
      ufo.beamOpacity = 0;
    }
    return;
  }

  if (ufo.state === "fly-in") {
    ufo.x -= ufo.speed;
    if (ufo.x <= W / 2) {
      ufo.state = "hover";
      ufo.beamProgress = 0;
    }
  } else if (ufo.state === "hover") {
    ufo.beamProgress += 0.015;
    ufo.beamOpacity = Math.sin(ufo.beamProgress * Math.PI) * 0.45;
    if (ufo.beamProgress >= 1) ufo.state = "fly-out";
  } else if (ufo.state === "fly-out") {
    ufo.x -= ufo.speed * 1.6;
    if (ufo.x < -100) {
      ufo.active = false;
      ufo.timer = 800 + Math.random() * 400;
    }
  }
}

function triggerUfoTransition() {
  state = "transition";
  paused = false;
  downHeld = false;
  if (digBtn) digBtn.classList.add("hidden");
  activeRock = null;
  player.digging = false;
  // Zerado de propósito: `player.update()` não roda durante a cutscene, então
  // um timer residual nunca decrementaria e o macaco piscaria a cena inteira.
  player.invulnerableTimer = 0;

  ufo.active = true;
  ufo.x = W + 80;
  ufo.y = 80;
  ufo.beamProgress = 0;
  ufo.beamOpacity = 0;
  ufo.rescueStage = "fly-in";
  ufo.rescueT = 0;
  sfx.beam();
}

function updateUfoTransition() {
  ufo.rescueT++;
  if (speed > 0) speed = Math.max(0, speed - 0.08);
  groundOffset = (groundOffset + speed) % 24;
  environment.scrollOnly(speed);

  // O caçador fica para trás, boquiaberto.
  if (hunter.gap < HUNTER_MAX_GAP + 200) hunter.gap += 4;
  hunterFillEl.style.width = "0%";
  hunterMeterEl.classList.remove("critical");

  // Centraliza o macaco sob o OVNI.
  const targetX = W / 2 - player.w / 2;
  if (player.x < targetX - 2) player.x += 2;
  else if (player.x > targetX + 2) player.x -= 2;
  else player.x = targetX;

  player.releaseVine(null);
  const floating = ufo.rescueStage === "float-up" || ufo.rescueStage === "fly-out";
  if (!floating && player.y < GROUND_Y - player.h) {
    player.y = Math.min(GROUND_Y - player.h, player.y + 4);
  }

  if (ufo.rescueStage === "fly-in") {
    ufo.x -= (ufo.x - W / 2) * 0.07;
    ufo.y -= (ufo.y - 70) * 0.07;
    if (Math.abs(ufo.x - W / 2) < 3 && Math.abs(ufo.y - 70) < 3) {
      ufo.x = W / 2;
      ufo.y = 70;
      ufo.rescueStage = "hover-beam";
      ufo.beamProgress = 0;
    }
  } else if (ufo.rescueStage === "hover-beam") {
    ufo.beamProgress += 0.035;
    ufo.beamOpacity = Math.min(0.7, ufo.beamProgress * 0.7);
    if (ufo.beamProgress >= 1) ufo.rescueStage = "float-up";
  } else if (ufo.rescueStage === "float-up") {
    const targetY = ufo.y + 8;
    player.y -= (player.y - targetY) * 0.04;
    player.floatAngle += 0.045;
    if (Math.abs(player.y - targetY) < 5) {
      ufo.rescueStage = "fly-out";
      ufo.beamProgress = 1;
      player.invisible = true;
    }
  } else if (ufo.rescueStage === "fly-out") {
    if (ufo.beamOpacity > 0) {
      ufo.beamOpacity -= 0.06;
    } else {
      ufo.x += 7;
      ufo.y -= 3.5;
      if (ufo.x > W + 100) finishUfoTransition();
    }
  }
}

function finishUfoTransition() {
  ufo.rescueStage = null;
  ufo.active = false;
  ufo.timer = 700;
  transitionDone = true;
  state = "playing";

  // Reentrada: o macaco é largado do alto do novo cenário.
  player.invisible = false;
  player.x = PLAYER_HOME_X;
  player.y = -100;
  player.vy = 0;
  player.jumping = true;
  player.floatAngle = 0;
  player.invulnerableTimer = INVULNERABLE_FRAMES;

  hunter.gap = HUNTER_MAX_GAP;
  environment.reset();
  speed = BASE_SPEED;
  triggerScreenShake(10);
}

// Progresso 0→1 da cutscene, usado para transicionar o céu vulcânico para o
// espacial fora da régua normal de pontuação.
function transitionBlend() {
  if (ufo.rescueStage === "fly-in") return Math.min(0.15, ufo.rescueT / 400);
  if (ufo.rescueStage === "hover-beam") return 0.15 + ufo.beamProgress * 0.4;
  if (ufo.rescueStage === "float-up") return 0.55 + Math.min(0.3, ufo.rescueT / 900);
  return 1;
}

// ---------------------------------------------------------------------------
// Cutscene: vitória (foguete-banana)
// ---------------------------------------------------------------------------
function triggerVictory() {
  state = "victory";
  paused = false;
  downHeld = false;
  if (digBtn) digBtn.classList.add("hidden");
  activeRock = null;
  player.digging = false;
  player.releaseVine(null);
  // Idem: sem colisões durante a cena final, e um timer preso faria o macaco
  // piscar justo na hora do triunfo.
  player.invulnerableTimer = 0;

  victoryStage = "arrive";
  rocket = { x: W + 160, y: GROUND_Y - 78, vy: 0, flames: [], t: 0 };
  sfx.victory();
  saveHighScore();
}

function updateVictorySequence() {
  if (speed > 0) speed = Math.max(0, speed - 0.09);
  groundOffset = (groundOffset + speed) % 24;
  environment.scrollOnly(speed);

  if (hunter.gap < HUNTER_MAX_GAP + 240) hunter.gap += 4;
  hunterFillEl.style.width = "0%";
  hunterMeterEl.classList.remove("critical");

  // Gravidade da fase final continua valendo para a queda do macaco.
  if (!player.swinging && player.y < GROUND_Y - player.h) {
    player.vy += 0.55 * player.gravityScale;
    player.y = Math.min(GROUND_Y - player.h, player.y + player.vy);
  }

  const landingX = W - 190;

  if (victoryStage === "arrive") {
    rocket.x -= (rocket.x - landingX) * 0.06;
    if (Math.abs(rocket.x - landingX) < 4) {
      rocket.x = landingX;
      victoryStage = "board";
    }
  } else if (victoryStage === "board") {
    const target = rocket.x - 34;
    if (player.x < target) {
      player.x += 3.2;
    } else {
      player.invisible = true;
      victoryStage = "launch";
      rocket.t = 0;
      sfx.launch();
      triggerScreenShake(20);
    }
  } else if (victoryStage === "launch") {
    rocket.t++;
    rocket.vy += 0.14;
    rocket.y -= rocket.vy;
    if (rocket.t % 2 === 0) {
      rocket.flames.push({
        x: rocket.x + (Math.random() - 0.5) * 12,
        y: rocket.y + 30,
        size: 5 + Math.random() * 7,
        alpha: 1,
        vy: 1.2 + Math.random(),
      });
    }
    if (rocket.y < -180) showVictoryScreen();
  }

  for (let i = rocket.flames.length - 1; i >= 0; i--) {
    const f = rocket.flames[i];
    f.y += f.vy;
    f.alpha -= 0.035;
    f.size *= 0.97;
    if (f.alpha <= 0) rocket.flames.splice(i, 1);
  }
}

function drawRocket(ctx) {
  if (!rocket) return;
  ctx.save();
  for (const f of rocket.flames) {
    ctx.fillStyle = `rgba(255, ${120 + Math.floor(Math.random() * 110)}, 40, ${f.alpha})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(rocket.x, rocket.y);
  // O emoji 🚀 aponta 45° para cima e à direita; girar -45° o deixa na vertical.
  ctx.rotate(-Math.PI / 4);
  ctx.font = "64px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🚀", 0, 0);
  ctx.restore();

  if (victoryStage === "arrive" || victoryStage === "board") {
    ctx.save();
    ctx.font = "16px serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText("🍌 EXPRESSO BANANA 🍌", rocket.x, rocket.y - 52);
    ctx.restore();
  }
}

function showVictoryScreen() {
  state = "idle";
  victoryScoreEl.innerHTML = `Pontos: <b>${Math.floor(score)}</b> &nbsp;|&nbsp; 🍌 x ${bananaCount} &nbsp;|&nbsp; ❤️ x ${player.lives}`;
  victoryScreen.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function updateHud() {
  const idx = phaseIndexFor(score);
  const phase = PHASES[idx];
  const start = idx === 0 ? 0 : PHASES[idx - 1].end;
  const pct = Math.max(0, Math.min(100, ((score - start) / (phase.end - start)) * 100));

  scoreEl.textContent = `Pontos: ${Math.floor(score)}`;
  bananasEl.textContent = `❤️ x ${player.lives} | 🍌 x ${bananaCount}`;
  phaseNameEl.textContent = `${phase.emoji} Fase ${idx + 1}/${PHASES.length} — ${phase.name}`;
  phaseFillEl.style.width = `${pct}%`;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
// Efeitos puramente visuais, mas que precisam avançar no `update` e não no
// `draw`: mantê-los no desenho fazia com que qualquer quadro não desenhado
// (aba oculta, engasgo do navegador) deixasse o banner e o clarão presos na
// tela para sempre.
function tickEffects() {
  if (shakeTime > 0) shakeTime--;
  if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.035);
  if (banner) {
    banner.t++;
    if (banner.t > banner.life) banner = null;
  }
}

function update() {
  frame++;
  tickEffects();

  if (state === "transition") {
    theme = computeTheme(score, { from: 2, to: 3, t: transitionBlend() });
    backdrop.update(speed, theme, score);
    updateUfoTransition();
    return;
  }

  if (state === "victory") {
    theme = computeTheme(score);
    backdrop.update(speed, theme, score);
    updateVictorySequence();
    return;
  }

  // A velocidade só é recalculada durante o jogo normal. Antes ela era
  // reescrita no topo de update() todo frame, o que anulava a desaceleração
  // das cutscenes e o mundo nunca parava.
  theme = computeTheme(score);
  player.gravityScale = theme.phase.gravity;
  speed = Math.min(MAX_SPEED, (BASE_SPEED + score / 900) * theme.phase.speedMul);

  backdrop.update(speed, theme, score);
  updateAmbientUfo();

  // O mesmo ↓ faz três coisas diferentes conforme o contexto: cava se houver
  // rocha na frente, mergulha se estiver no ar, agacha se estiver no chão.
  player.applyDownInput(downHeld, !!activeRock);
  player.update(frame, handleDamage, sfx);
  if (state !== "playing") return;

  if (!activeRock) {
    groundOffset = (groundOffset + speed) % 24;

    const hit = environment.update({
      speed, score, player, hunter, sfx,
      onDamage: handleDamage,
      shake: triggerScreenShake,
      theme,
    });
    if (state !== "playing") return;

    if (hit && hit.w && !hit.type) {
      activeRock = hit;
      rockGraceLeft = ROCK_DIG_GRACE;
      digProgress = 0;
      player.digging = false;
    } else if (hit === "banana") {
      bananaCount++;
      score += 10;
    } else if (hit === "peel") {
      bananaCount++;
      score += 15;
    } else if (hit === "spring") {
      score += 15;
    } else if (hit === "heart") {
      player.lives = Math.min(MAX_LIVES, player.lives + 1);
      score += 20;
    } else if (hit === "shield" || hit === "magnet" || hit === "freeze") {
      score += 15;
    }
  }

  // Escavação sob a rocha
  if (activeRock) {
    if (!player.digging) {
      if (downHeld) {
        player.digging = true;
      } else {
        rockGraceLeft--;
        if (rockGraceLeft <= 0) {
          handleDamage("rock");
          return;
        }
      }
    }
    if (player.digging && downHeld) {
      digProgress++;
      if (digProgress % 6 === 0) sfx.digTick();
      player.y = GROUND_Y - player.h + Math.min(ROCK_DIG_DEPTH, (digProgress / ROCK_DIG_DURATION) * ROCK_DIG_DEPTH);
      if (digProgress >= ROCK_DIG_DURATION) {
        environment.rocks = environment.rocks.filter((r) => r !== activeRock);
        activeRock = null;
        player.digging = false;
        player.y = GROUND_Y - player.h;
        digProgress = 0;
      }
    } else if (player.digging && !downHeld) {
      // Soltou o botão: volta a contar a carência antes de bater na rocha.
      player.digging = false;
      player.y = GROUND_Y - player.h;
    }
  }

  hunter.update(player, environment.rivers, score, speed, theme.phase.hunterMul);
  if (hunter.gap <= 0) {
    hunter.gap = 60;
    handleDamage("hunter");
    if (state !== "playing") return;
  }

  const dangerPct = Math.max(0, Math.min(100, (1 - hunter.gap / HUNTER_MAX_GAP) * 100));
  hunterFillEl.style.width = `${dangerPct}%`;
  hunterMeterEl.classList.toggle("critical", dangerPct > 75);

  score += 0.15;
  updateHud();

  const idx = phaseIndexFor(score);
  if (idx !== lastPhaseIdx) {
    lastPhaseIdx = idx;
    showBanner(idx);
  }

  if (score >= VICTORY_SCORE) {
    triggerVictory();
    return;
  }

  if (score >= UFO_TRANSITION_SCORE && !transitionDone) {
    score = UFO_TRANSITION_SCORE;
    triggerUfoTransition();
  }
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------
function draw() {
  ctx.save();
  if (shakeTime > 0) {
    ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  }

  ctx.clearRect(0, 0, W, H);

  // O botão de ↓ agora serve para cavar E para abaixar, então fica visível a
  // partida inteira e só troca de rótulo conforme o contexto.
  if (digBtn) {
    digBtn.classList.toggle("hidden", state !== "playing");
    const label = activeRock ? "⬇ CAVAR" : "⬇ ABAIXAR";
    if (digBtn.textContent !== label) digBtn.textContent = label;
    digBtn.classList.toggle("urgent", !!activeRock);
  }

  backdrop.drawSky(ctx, frame, theme, score);
  drawUfo(ctx);
  environment.draw(ctx, frame, groundOffset, theme);
  if (state === "victory") drawRocket(ctx);

  // Macaco (recortado no chão enquanto cava)
  if (player.digging) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, GROUND_Y);
    ctx.clip();
    player.draw(ctx, frame);
    ctx.restore();

    const dustX = player.x + player.w / 2;
    ctx.fillStyle = "rgba(120,90,50,0.5)";
    for (let i = 0; i < 3; i++) {
      const a = frame * 0.3 + i * 2;
      ctx.beginPath();
      ctx.ellipse(dustX + Math.cos(a) * 14, GROUND_Y - 2 + Math.sin(a * 1.7) * 3, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    player.draw(ctx, frame);
  }

  hunter.draw(ctx, player, frame, theme.idx);

  if (player.swinging) {
    const cx = player.x + player.w / 2;
    drawVineRope(ctx, cx, 0, cx, player.y + player.h / 2, theme.vine);
  }

  // Barra de escavação
  if (activeRock) {
    const barX = player.x - 10;
    const barY = player.y - 14;
    const barW = 60;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(barX, barY, barW, 6);
    if (player.digging) {
      ctx.fillStyle = "#d9c23c";
      ctx.fillRect(barX, barY, barW * (digProgress / ROCK_DIG_DURATION), 6);
    } else {
      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⬇ cave!", player.x + player.w / 2, barY - 6);
    }
  }

  backdrop.drawAmbient(ctx);
  drawPowerStrip(ctx);

  // Vinheta de perigo
  if (state === "playing" && hunter.gap < 100) {
    const pulse = 0.15 + 0.15 * Math.abs(Math.sin(frame / 6));
    ctx.save();
    ctx.globalAlpha = pulse * (1 - hunter.gap / 100);
    ctx.fillStyle = "#c81e1e";
    ctx.fillRect(0, 0, W, 10);
    ctx.fillRect(0, H - 10, W, 10);
    ctx.restore();
  }

  drawBanner(ctx);

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

function drawUfo(ctx) {
  if (!ufo.active) return;
  ctx.save();
  if (ufo.beamOpacity > 0) {
    const beam = ctx.createLinearGradient(0, ufo.y, 0, GROUND_Y);
    beam.addColorStop(0, `rgba(100, 255, 100, ${ufo.beamOpacity})`);
    beam.addColorStop(1, "rgba(100, 255, 100, 0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(ufo.x - 8, ufo.y + 10);
    ctx.lineTo(ufo.x + 8, ufo.y + 10);
    ctx.lineTo(ufo.x + 36, GROUND_Y);
    ctx.lineTo(ufo.x - 36, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.font = "28px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🛸", ufo.x, ufo.y);
  ctx.restore();
}

// Lista os poderes ativos no canto superior esquerdo. Antes cada poder
// desenhava o próprio rótulo em cima do macaco, o que empilhava texto sobre o
// personagem justamente quando ele mais precisa ser visível.
function drawPowerStrip(ctx) {
  if (state !== "playing") return;

  const active = [];
  if (player.shield) active.push(["🛡️", "Escudo", null, "#8fe4ff"]);
  if (player.superJumpTimer > 0) active.push(["🦘", "Mola", player.superJumpTimer, "#ff8fa8"]);
  if (player.magnetTimer > 0) active.push(["🧲", "Ímã", player.magnetTimer, "#8fc8ff"]);
  if (hunter.frozenTimer > 0) active.push(["🧊", "Gelo", hunter.frozenTimer, "#a8ecff"]);
  if (active.length === 0) return;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  active.forEach(([icon, name, frames, color], i) => {
    const y = 20 + i * 24;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(8, y - 10, 108, 20, 10);
    ctx.fill();

    ctx.font = "13px serif";
    ctx.fillText(icon, 14, y);

    ctx.font = "bold 11px 'Segoe UI', sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(name, 34, y);

    if (frames !== null) {
      // Barra que esvazia — mais legível de relance que uma contagem em texto.
      const total = name === "Gelo" ? FREEZE_DURATION : name === "Ímã" ? MAGNET_DURATION : SUPER_JUMP_DURATION;
      const pct = Math.max(0, Math.min(1, frames / total));
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(72, y - 3, 38, 6);
      ctx.fillStyle = color;
      ctx.fillRect(72, y - 3, 38 * pct, 6);
    }
  });
  ctx.restore();
}

function drawBanner(ctx) {
  if (!banner) return;
  // Fade in nos primeiros 20 quadros, fade out nos últimos 40.
  const fadeIn = Math.min(1, banner.t / 20);
  const fadeOut = Math.min(1, (banner.life - banner.t) / 40);
  const alpha = Math.min(fadeIn, fadeOut);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 118, W, 66);

  ctx.font = "bold 26px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#ffd94a";
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineWidth = 4;
  ctx.strokeText(banner.title, W / 2, 150);
  ctx.fillText(banner.title, W / 2, 150);

  ctx.font = "15px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(banner.sub, W / 2, 172);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
function loop() {
  // "transition" ficava de fora desta lista e o jogo congelava para sempre
  // assim que a cutscene do OVNI começava.
  if (state !== "playing" && state !== "transition" && state !== "victory") {
    rafId = null;
    return;
  }
  if (!paused) update();
  draw();
  rafId = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    handleAction();
  } else if (e.code === "ArrowDown" || e.code === "KeyS") {
    e.preventDefault();
    downHeld = true;
  } else if (e.code === "KeyP" || e.code === "Escape") {
    e.preventDefault();
    togglePause();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowDown" || e.code === "KeyS") downHeld = false;
});

// Perder o foco da aba pausa a partida em vez de deixar o caçador avançar.
window.addEventListener("blur", () => {
  if (state === "playing" && !paused) togglePause();
});

canvas.addEventListener("pointerdown", handleAction);

if (digBtn) {
  const press = (e) => { e.preventDefault(); unlockAudio(); downHeld = true; };
  const release = (e) => { e.preventDefault(); downHeld = false; };
  digBtn.addEventListener("pointerdown", press);
  digBtn.addEventListener("pointerup", release);
  digBtn.addEventListener("pointerleave", release);
  digBtn.addEventListener("pointercancel", release);
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
restartVictoryBtn.addEventListener("click", startGame);
resumeBtn.addEventListener("click", togglePause);

// Atalho de desenvolvimento para testar fases sem jogar até elas.
// Só existe em localhost — em produção o objeto nem é criado.
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  window.__macaco = {
    skipTo(value) { score = value; },
    get state() { return { state, score: Math.floor(score), phase: phaseIndexFor(score), lives: player.lives, speed }; },
    get player() {
      return {
        y: Math.round(player.y), h: player.h, vy: +player.vy.toFixed(2),
        crouching: player.crouching, fastFalling: player.fastFalling,
        jumping: player.jumping, shield: player.shield,
        magnet: player.magnetTimer, superJump: player.superJumpTimer,
        hitbox: player.hitbox(),
      };
    },
    get world() {
      return {
        fliers: environment.fliers.map((f) => ({ icon: f.icon, x: Math.round(f.x), y: f.y, w: f.w, h: f.h })),
        frozen: hunter.frozenTimer,
        gap: Math.round(hunter.gap),
        icons: { log: theme.logIcon, rock: theme.rockIcon, flier: theme.flierIcon },
      };
    },
    give(type) {
      if (type === "shield") player.shield = true;
      else if (type === "magnet") player.collectMagnet();
      else if (type === "freeze") hunter.freeze();
      else if (type === "spring") player.collectSuperJump();
    },
    spawnFlier() { environment.spawnFlier(theme); },
    clearHazards() {
      environment.logs.length = 0;
      environment.rocks.length = 0;
      environment.rivers.length = 0;
      activeRock = null;
    },
    get lastDamage() { return lastDamageReason; },
    // Avança N quadros sem depender do requestAnimationFrame — útil para
    // testar com a aba em segundo plano, quando o navegador o suspende.
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        if (state !== "playing" && state !== "transition" && state !== "victory") break;
        update();
      }
      return this.state;
    },
    godMode() { player.lives = 99; },
    setLives(n) { player.lives = n; player.invulnerableTimer = 0; },
  };
}

// Desenho inicial da tela ociosa
resetGame();
draw();
