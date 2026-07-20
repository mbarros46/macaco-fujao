export function lerpColor(c1, c2, factor) {
  const rgb1 = parseColor(c1);
  const rgb2 = parseColor(c2);
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

// Aceita "#abc", "#aabbcc" e "rgb(r, g, b)" — o lerp devolve rgb(), então
// precisa conseguir reprocessar a própria saída ao encadear blends.
function parseColor(color) {
  if (color.startsWith("rgb")) {
    const [r, g, b] = color.match(/\d+/g).map(Number);
    return { r, g, b };
  }
  let h = color.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function withAlpha(color, alpha) {
  const { r, g, b } = parseColor(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function shadeColor(hex, percent) {
  const { r, g, b } = parseColor(hex);
  const cl = (v) => Math.max(0, Math.min(255, v + percent));
  return `rgb(${cl(r)}, ${cl(g)}, ${cl(b)})`;
}

export function drawSoftShadow(ctx, rx, ry) {
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

const DEFAULT_VINE = { rope: "#3f6b2a", leaf: "#4f8a34", knot: "#5c4322" };

export function drawVineRope(ctx, ax, ay, hx, hy, palette = DEFAULT_VINE) {
  const p = palette || DEFAULT_VINE;
  ctx.save();
  ctx.strokeStyle = p.rope;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo((ax + hx) / 2 + (hx - ax) * 0.15, (ay + hy) / 2, hx, hy);
  ctx.stroke();
  // folhinhas/nós ao longo do cipó
  for (let t = 0.25; t < 1; t += 0.25) {
    const lx = ax + (hx - ax) * t;
    const ly = ay + (hy - ay) * t;
    ctx.fillStyle = p.leaf;
    ctx.beginPath();
    ctx.ellipse(lx - 3, ly, 4, 2, 0.6, 0, Math.PI * 2);
    ctx.ellipse(lx + 3, ly + 2, 4, 2, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // punho
  ctx.fillStyle = p.knot;
  ctx.beginPath();
  ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawLittleHand(ctx, x, y, color, outline) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.8;
  for (const fx of [-2, 0, 2]) {
    ctx.beginPath();
    ctx.moveTo(x + fx, y + 3);
    ctx.lineTo(x + fx, y + 4.8);
    ctx.stroke();
  }
}
