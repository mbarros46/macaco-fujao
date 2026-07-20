import { PHASES, PHASE_BLEND_WINDOW, phaseIndexFor } from "./Config.js";
import { lerpColor } from "./Helpers.js";

// Descobre entre quais fases o cenário está no momento e o quanto já
// transicionou (0 = fase atual pura, 1 = próxima fase pura).
export function phaseBlend(score) {
  const idx = phaseIndexFor(score);
  const current = PHASES[idx];
  const next = PHASES[idx + 1];

  if (!next || !current.blendOut) return { from: idx, to: idx, t: 0 };

  const start = current.end - PHASE_BLEND_WINDOW;
  if (score < start) return { from: idx, to: idx, t: 0 };

  return { from: idx, to: idx + 1, t: Math.min(1, (score - start) / PHASE_BLEND_WINDOW) };
}

function pair(a, b, t) {
  if (t <= 0) return [a[0], a[1]];
  if (t >= 1) return [b[0], b[1]];
  return [lerpColor(a[0], b[0], t), lerpColor(a[1], b[1], t)];
}

function vine(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    rope: lerpColor(a.rope, b.rope, t),
    leaf: lerpColor(a.leaf, b.leaf, t),
    knot: lerpColor(a.knot, b.knot, t),
  };
}

/**
 * Monta as cores e ícones do frame atual.
 *
 * @param {number} score  pontuação atual
 * @param {object} [override]  { from, to, t } para forçar um blend — usado pela
 *   cutscene do OVNI, que troca vulcão → espaço fora da régua de pontuação.
 */
export function computeTheme(score, override = null) {
  const blend = override || phaseBlend(score);
  const from = PHASES[blend.from];
  const to = PHASES[blend.to];
  const t = blend.t;

  // Ícones e estilo de água trocam de uma vez no meio do fade, para não
  // ficarem meio-termo sem sentido.
  const solid = t < 0.5 ? from : to;

  return {
    fromIdx: blend.from,
    toIdx: blend.to,
    t,
    // Índice usado pela jogabilidade (gravidade, velocidade, dificuldade).
    idx: phaseIndexFor(score),
    phase: PHASES[phaseIndexFor(score)],
    sky: pair(from.sky, to.sky, t),
    ground: pair(from.ground, to.ground, t),
    water: pair(from.water, to.water, t),
    waterStyle: solid.waterStyle,
    waterName: solid.waterName,
    vine: vine(from.vine, to.vine, t),
    logIcon: solid.logIcon,
    rockIcon: solid.rockIcon,
    rockGlow: solid.rockGlow,
    flierIcon: solid.flierIcon,
    logDamage: solid.logDamage,
    rockDamage: solid.rockDamage,
    flierDamage: solid.flierDamage,
  };
}
