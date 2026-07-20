// ---------------------------------------------------------------------------
// Dimensões e física base
// ---------------------------------------------------------------------------
export const W = 800;
export const H = 400;
export const GROUND_Y = H - 60;

export const GRAVITY = 0.55;
export const JUMP_FORCE = -12.5;
export const BASE_SPEED = 5;
export const MAX_SPEED = 9.6;

export const HUNTER_MAX_GAP = 320;
export const HUNTER_BANANA_BONUS = 20;
export const HUNTER_SWIM_PENALTY = 0.4;

export const SWING_LIFT = 55;
export const MAX_HANG_GRACE = 90;

// Postura do macaco. Agachado ele passa por baixo dos obstáculos voadores.
export const STAND_H = 40;
export const CROUCH_H = 20;
// Multiplicador de gravidade ao segurar ↓ no ar — mergulho rápido.
export const FAST_FALL_MULT = 2.7;

// Faixa vertical ocupada pelos voadores. Calibrada para acertar quem está de
// pé (hitbox começa em GROUND_Y-34) e passar por cima de quem está agachado
// (hitbox começa em GROUND_Y-17), com uma folga de ~9px de margem.
export const FLIER_Y = GROUND_Y - 52;
export const FLIER_H = 26;
export const FLIER_W = 34;
export const FLIER_SPEED_MUL = 1.25;
export const FLIER_CLEARANCE = 180;

// Duração dos poderes, em quadros (60 = 1 segundo).
export const SUPER_JUMP_DURATION = 600;
export const MAGNET_DURATION = 480;
export const MAGNET_RADIUS = 165;
export const FREEZE_DURATION = 360;

export const MIN_HAZARD_GAP = 40;
export const RIVER_LOG_CLEARANCE = 160;
export const ROCK_LOG_CLEARANCE = 160;
export const ROCK_RIVER_CLEARANCE = 320;
export const ROCK_DIG_GRACE = 50;
export const ROCK_DIG_DURATION = 55;
export const ROCK_DIG_DEPTH = 30;

export const MAX_LIVES = 5;
// Teto de largura para rios/lava/fendas, para o cipó nunca nascer fora da tela.
export const MAX_HAZARD_WIDTH = 540;
export const INVULNERABLE_FRAMES = 90;

// Quadros que o macaco passa no ar num pulo completo. Depende da gravidade,
// que muda por fase — a largura dos rios é calculada a partir disso, então
// precisa ser uma função e não uma constante.
export function jumpAirFrames(gravityScale = 1) {
  return (2 * Math.abs(JUMP_FORCE)) / (GRAVITY * gravityScale);
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------
// Cada fase define seu próprio cenário, paleta, ícones de obstáculo, gravidade
// e ritmo. `end` é a pontuação em que a fase termina.
//
//   1. Selva Esmeralda      0 → 500
//   2. Dunas do Sol Poente  500 → 1100
//   3. Caldeira Vulcânica   1100 → 1800
//   4. Órbita Fujona        1800 → 2600  (vitória)
//
export const PHASES = [
  {
    name: "Selva Esmeralda",
    emoji: "🌴",
    tagline: "Fuja pela mata fechada!",
    end: 500,
    blendOut: true,
    sky: ["#8fd3f4", "#dcf4ff"],
    ground: ["#7a9e4f", "#5c7d3a"],
    water: ["#5aa9d6", "#2c6f9e"],
    waterStyle: "river",
    waterName: "rio",
    vine: { rope: "#3f6b2a", leaf: "#4f8a34", knot: "#5c4322" },
    logIcon: "🪵",
    flierIcon: "🦜",
    flierDamage: "bird",
    rockIcon: "🪨",
    rockGlow: null,
    gravity: 1,
    speedMul: 1,
    hunterMul: 1,
    ambient: "leaf",
    logDamage: "log",
    rockDamage: "rock",
  },
  {
    name: "Dunas do Sol Poente",
    emoji: "🏜️",
    tagline: "Cuidado com a areia movediça!",
    end: 1100,
    blendOut: true,
    sky: ["#f2681c", "#ffd89b"],
    ground: ["#e3bd7c", "#c19a5b"],
    water: ["#dcae52", "#8a6320"],
    waterStyle: "quicksand",
    waterName: "areia movediça",
    vine: { rope: "#a8763f", leaf: "#c9a24a", knot: "#6b4a22" },
    logIcon: "🌵",
    flierIcon: "🦅",
    flierDamage: "vulture",
    rockIcon: "🗿",
    rockGlow: null,
    gravity: 1,
    speedMul: 1.08,
    hunterMul: 1.05,
    ambient: "sand",
    logDamage: "cactus",
    rockDamage: "rock",
  },
  {
    name: "Caldeira Vulcânica",
    emoji: "🌋",
    tagline: "O chão está fervendo!",
    end: 1800,
    // Sem blend: a transição para o espaço é feita pela cutscene do OVNI.
    blendOut: false,
    sky: ["#2b0a0a", "#8c2a12"],
    ground: ["#3a2723", "#241614"],
    water: ["#ffab3d", "#c1121f"],
    waterStyle: "lava",
    waterName: "lava",
    vine: { rope: "#8d8d97", leaf: "#c0c0c8", knot: "#5a5a62" },
    logIcon: "🦴",
    flierIcon: "🦇",
    flierDamage: "bat",
    rockIcon: "🪨",
    rockGlow: "rgba(255, 110, 30, 0.55)",
    gravity: 1,
    speedMul: 1.16,
    hunterMul: 1.1,
    ambient: "ash",
    logDamage: "bone",
    rockDamage: "rock",
  },
  {
    name: "Órbita Fujona",
    emoji: "🛸",
    tagline: "Gravidade baixa: pulos enormes!",
    end: 2600,
    blendOut: false,
    sky: ["#050017", "#241356"],
    ground: ["#8a4a3a", "#5a2f26"],
    water: ["#7c3aed", "#0b0224"],
    waterStyle: "rift",
    waterName: "fenda espacial",
    vine: { rope: "#7df9ff", leaf: "#b6fbff", knot: "#2fd8e0" },
    logIcon: "☄️",
    flierIcon: "🛰️",
    flierDamage: "satellite",
    rockIcon: "🌑",
    rockGlow: "rgba(140, 190, 255, 0.45)",
    gravity: 0.72,
    speedMul: 1.22,
    hunterMul: 1.12,
    ambient: "stardust",
    logDamage: "meteor",
    rockDamage: "rock",
  },
];

export const VICTORY_SCORE = PHASES[PHASES.length - 1].end;

// Pontuação em que a cutscene de abdução acontece (entrada na fase 4).
export const UFO_TRANSITION_SCORE = PHASES[2].end;

// Janela de pontos em que o cenário faz cross-fade para a próxima fase.
export const PHASE_BLEND_WINDOW = 120;

export function phaseIndexFor(score) {
  for (let i = 0; i < PHASES.length; i++) {
    if (score < PHASES[i].end) return i;
  }
  return PHASES.length - 1;
}

export function phaseFor(score) {
  return PHASES[phaseIndexFor(score)];
}
