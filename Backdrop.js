import { W, H, GROUND_Y, PHASES } from "./Config.js";

// Nebulosa pré-renderizada num canvas offscreen: o gradiente radial em modo
// "screen" é caro demais para refazer a cada frame.
function buildNebula() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.globalCompositeOperation = "screen";

  const blobs = [
    { x: W * 0.3, y: 80, r: 140, color: "255, 0, 128" },
    { x: W * 0.7, y: 60, r: 160, color: "0, 128, 255" },
    { x: W * 0.5, y: 150, r: 120, color: "120, 0, 255" },
  ];
  for (const b of blobs) {
    const grad = g.createRadialGradient(b.x, b.y, 10, b.x, b.y, b.r);
    grad.addColorStop(0, `rgba(${b.color}, 1)`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export class Backdrop {
  constructor() {
    this.nebula = buildNebula();
    this.reset();
  }

  reset() {
    this.clouds = [
      { x: 100, y: 50, speed: 0.15, scale: 0.8 },
      { x: 350, y: 80, speed: 0.22, scale: 1.1 },
      { x: 600, y: 40, speed: 0.1, scale: 0.6 },
    ];

    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * W,
        y: Math.random() * (GROUND_Y - 40),
        size: 0.5 + Math.random() * 1.8,
        twinkleSpeed: 0.015 + Math.random() * 0.045,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.shootingStars = [];
    this.planets = [
      { x: W - 150, y: 70, r: 16, color: "#e06c53", speed: 0.02 },
      { x: 220, y: 110, r: 22, color: "#d9ab55", rings: true, speed: 0.015 },
      { x: 450, y: 50, r: 12, color: "#55d9bb", speed: 0.01 },
    ];

    this.dragon = { x: -120, y: 60, active: false, timer: 420, particles: [], frame: 0, speed: 4 };

    // Deslocamento de cada camada de parallax (uma por fase).
    this.scroll = [0, 0, 0, 0];
    this.particles = [];
  }

  update(speed, theme, score) {
    const idx = theme.toIdx;

    for (let i = 0; i < this.scroll.length; i++) {
      this.scroll[i] += speed * 0.32;
    }

    for (const cloud of this.clouds) {
      cloud.x -= cloud.speed * (speed * 0.5);
      if (cloud.x + 120 * cloud.scale < 0) {
        cloud.x = W + 50;
        cloud.y = 30 + Math.random() * 60;
      }
    }

    for (const star of this.stars) star.phase += star.twinkleSpeed;

    // Estrelas cadentes apenas no espaço.
    if (idx === 3 && Math.random() < 0.012 && this.shootingStars.length < 3) {
      this.shootingStars.push({
        x: Math.random() * (W - 100),
        y: Math.random() * 90,
        length: 40 + Math.random() * 40,
        speed: 8 + Math.random() * 6,
        progress: 0,
        angle: Math.PI / 6 + Math.random() * (Math.PI / 12),
      });
    }
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const ss = this.shootingStars[i];
      ss.progress += ss.speed;
      if (ss.progress > ss.length + 140) this.shootingStars.splice(i, 1);
    }

    for (const planet of this.planets) {
      planet.x -= planet.speed * (speed * 0.2);
      if (planet.x + 60 < 0) {
        planet.x = W + 100;
        planet.y = 40 + Math.random() * 100;
      }
    }

    this.updateDragon(idx);
    this.updateAmbient(speed, theme);
  }

  // O dragão sobrevoa na selva e, principalmente, no vulcão (onde é a casa dele).
  updateDragon(idx) {
    const allowed = idx === 0 || idx === 2;
    if (!allowed) {
      this.dragon.active = false;
      this.dragon.particles.length = 0;
      return;
    }

    const d = this.dragon;
    if (!d.active) {
      d.timer--;
      if (d.timer <= 0) {
        d.active = true;
        d.x = W + 120;
        d.y = 30 + Math.random() * 70;
        d.speed = 3.5 + Math.random() * 1.5;
        d.frame = 0;
      }
    } else {
      d.frame++;
      d.x -= d.speed;
      d.y += Math.sin(d.frame * 0.08) * 1.6;

      if (d.frame % 3 === 0) {
        d.particles.push({
          x: d.x - 10,
          y: d.y + 6,
          vx: -(1 + Math.random() * 1.5),
          vy: (Math.random() - 0.5) * 1.2,
          size: 3.5 + Math.random() * 3.5,
          alpha: 1,
        });
      }

      if (d.x < -150) {
        d.active = false;
        d.timer = (idx === 2 ? 380 : 600) + Math.random() * 300;
      }
    }

    for (let i = d.particles.length - 1; i >= 0; i--) {
      const p = d.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.022;
      if (p.alpha <= 0) d.particles.splice(i, 1);
    }
  }

  // Partículas ambientes: folhas na selva, areia no deserto, cinzas no vulcão,
  // poeira estelar no espaço.
  updateAmbient(speed, theme) {
    const kind = PHASES[theme.toIdx].ambient;
    const budget = kind === "ash" ? 46 : kind === "sand" ? 40 : 26;

    if (this.particles.length < budget && Math.random() < 0.5) {
      this.particles.push(this.spawnAmbient(kind));
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x -= (p.drift + speed * p.parallax);
      p.y += p.vy;
      p.spin += p.spinSpeed;
      p.life--;
      if (p.life <= 0 || p.x < -20 || p.y > H + 20) this.particles.splice(i, 1);
    }
  }

  spawnAmbient(kind) {
    const base = {
      x: W + 10 + Math.random() * 40,
      y: Math.random() * GROUND_Y,
      spin: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 0.12,
      parallax: 0.25 + Math.random() * 0.3,
      life: 400,
      kind,
    };

    if (kind === "leaf") {
      return { ...base, drift: 0.4, vy: 0.35 + Math.random() * 0.4, size: 3 + Math.random() * 3, color: "#5f9c3a" };
    }
    if (kind === "sand") {
      return { ...base, y: GROUND_Y - Math.random() * 120, drift: 2.2, vy: (Math.random() - 0.6) * 0.3, size: 1 + Math.random() * 1.8, color: "#f0dcae" };
    }
    if (kind === "ash") {
      return { ...base, y: -10 - Math.random() * 40, drift: 0.5, vy: 0.7 + Math.random() * 0.8, size: 1.2 + Math.random() * 2.4, color: Math.random() < 0.25 ? "#ff8c42" : "#6b6259" };
    }
    // stardust
    return { ...base, drift: 0.15, vy: (Math.random() - 0.5) * 0.2, size: 1 + Math.random() * 1.6, color: "#cfe6ff" };
  }

  // -------------------------------------------------------------------------
  // Desenho
  // -------------------------------------------------------------------------

  /** Céu, corpos celestes e silhuetas distantes (atrás de tudo). */
  drawSky(ctx, frame, theme, score) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, theme.sky[0]);
    skyGrad.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Cross-fade entre as duas fases envolvidas.
    if (theme.t <= 0 || theme.fromIdx === theme.toIdx) {
      this.drawScenery(ctx, frame, theme.fromIdx, 1, score);
    } else {
      this.drawScenery(ctx, frame, theme.fromIdx, 1 - theme.t, score);
      this.drawScenery(ctx, frame, theme.toIdx, theme.t, score);
    }

    this.drawDragon(ctx);
  }

  drawScenery(ctx, frame, idx, alpha, score) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (idx === 0) this.drawJungle(ctx, frame, score);
    else if (idx === 1) this.drawDesert(ctx, frame);
    else if (idx === 2) this.drawVolcano(ctx, frame);
    else this.drawSpace(ctx, frame);
    ctx.restore();
  }

  // --- Fase 1: selva -------------------------------------------------------
  drawJungle(ctx, frame, score) {
    // Sol descendo conforme a fase avança.
    const sunY = 55 + (Math.min(score, PHASES[0].end) / PHASES[0].end) * (GROUND_Y - 150);
    const glow = ctx.createRadialGradient(W - 80, sunY, 4, W - 80, sunY, 40);
    glow.addColorStop(0, "rgba(255, 214, 80, 0.9)");
    glow.addColorStop(1, "rgba(255, 214, 80, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(W - 80, sunY, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath();
    ctx.arc(W - 80, sunY, 17, 0, Math.PI * 2);
    ctx.fill();

    // Nuvens.
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    for (const cloud of this.clouds) {
      const { x: cx, y: cy, scale: cs } = cloud;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 14 * cs, cy - 7 * cs, 17 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 28 * cs, cy, 14 * cs, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Duas camadas de árvores em parallax.
    this.drawTreeLine(ctx, this.scroll[0] * 0.45, 190, "#2f5c2a", 0.55);
    this.drawTreeLine(ctx, this.scroll[0] * 0.8, 140, "#24491f", 0.85);
  }

  drawTreeLine(ctx, scroll, spacing, color, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    const off = scroll % spacing;
    for (let x = -spacing; x < W + spacing; x += spacing) {
      const tx = x - off;
      const seed = Math.abs(Math.round((x + scroll - off) / spacing)) % 3;
      const th = 90 + seed * 22;
      // tronco
      ctx.fillRect(tx - 4, GROUND_Y - th, 9, th);
      // copa
      ctx.beginPath();
      ctx.ellipse(tx, GROUND_Y - th, 34, 20, 0, 0, Math.PI * 2);
      ctx.ellipse(tx - 22, GROUND_Y - th + 12, 22, 13, 0, 0, Math.PI * 2);
      ctx.ellipse(tx + 22, GROUND_Y - th + 12, 22, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Fase 2: deserto -----------------------------------------------------
  drawDesert(ctx, frame) {
    // Sol enorme e baixo no horizonte.
    const sunY = GROUND_Y - 70;
    const glow = ctx.createRadialGradient(W * 0.5, sunY, 10, W * 0.5, sunY, 130);
    glow.addColorStop(0, "rgba(255, 240, 170, 0.95)");
    glow.addColorStop(0.45, "rgba(255, 160, 60, 0.5)");
    glow.addColorStop(1, "rgba(255, 120, 40, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, GROUND_Y);
    ctx.fillStyle = "#ffe9a8";
    ctx.beginPath();
    ctx.arc(W * 0.5, sunY, 52, 0, Math.PI * 2);
    ctx.fill();

    // Abutres circulando.
    ctx.save();
    ctx.globalAlpha *= 0.7;
    ctx.strokeStyle = "#3d2416";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const bx = 140 + i * 190 + Math.sin(frame * 0.008 + i) * 60;
      const by = 60 + Math.cos(frame * 0.011 + i * 2) * 18;
      const flap = Math.sin(frame * 0.12 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - 9, by);
      ctx.quadraticCurveTo(bx - 4, by - 5 - flap, bx, by);
      ctx.quadraticCurveTo(bx + 4, by - 5 - flap, bx + 9, by);
      ctx.stroke();
    }
    ctx.restore();

    // Dunas em parallax.
    this.drawDune(ctx, this.scroll[1] * 0.35, 150, 62, "#c98f4d", 0.75);
    this.drawDune(ctx, this.scroll[1] * 0.6, 105, 44, "#a9713a", 0.9);
  }

  drawDune(ctx, scroll, wavelength, height, color, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= W; x += 8) {
      const y = GROUND_Y - height * (0.55 + 0.45 * Math.sin((x + scroll) / wavelength));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- Fase 3: vulcão ------------------------------------------------------
  drawVolcano(ctx, frame) {
    // Lua vermelha entre a fumaça.
    ctx.save();
    ctx.globalAlpha *= 0.85;
    const moonGlow = ctx.createRadialGradient(W - 120, 60, 5, W - 120, 60, 55);
    moonGlow.addColorStop(0, "rgba(255, 120, 80, 0.75)");
    moonGlow.addColorStop(1, "rgba(255, 80, 40, 0)");
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(W - 120, 60, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8674a";
    ctx.beginPath();
    ctx.arc(W - 120, 60, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cordilheira de vulcões com crateras brilhando.
    this.drawVolcanoRidge(ctx, this.scroll[2] * 0.3, 260, 110, "#231416", 0.85, frame, false);
    this.drawVolcanoRidge(ctx, this.scroll[2] * 0.55, 200, 78, "#160c0e", 1, frame, true);
  }

  drawVolcanoRidge(ctx, scroll, spacing, height, color, alpha, frame, erupting) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    const off = scroll % spacing;
    for (let x = -spacing; x < W + spacing; x += spacing) {
      const vx = x - off;
      const half = spacing * 0.42;
      const peakY = GROUND_Y - height;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(vx - half, GROUND_Y);
      ctx.lineTo(vx - 16, peakY);
      ctx.lineTo(vx + 16, peakY);
      ctx.lineTo(vx + half, GROUND_Y);
      ctx.closePath();
      ctx.fill();

      // cratera incandescente
      const pulse = 0.55 + 0.25 * Math.sin(frame * 0.05 + vx);
      ctx.fillStyle = `rgba(255, 120, 30, ${pulse})`;
      ctx.beginPath();
      ctx.ellipse(vx, peakY + 1, 15, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (erupting) {
        // escorrimento de lava pela encosta
        ctx.strokeStyle = `rgba(255, 90, 20, ${pulse * 0.7})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(vx + 6, peakY + 2);
        ctx.quadraticCurveTo(vx + 20, peakY + height * 0.45, vx + 14, GROUND_Y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // --- Fase 4: espaço ------------------------------------------------------
  drawSpace(ctx, frame) {
    // Nebulosa.
    ctx.save();
    ctx.globalAlpha *= 0.4;
    ctx.drawImage(this.nebula, 0, 0);
    ctx.restore();

    // Estrelas em 3 lotes, para não fazer 90 chamadas de desenho.
    for (let g = 0; g < 3; g++) {
      ctx.beginPath();
      let twitchSum = 0;
      let count = 0;
      for (let i = g; i < this.stars.length; i += 3) {
        const star = this.stars[i];
        twitchSum += Math.sin(frame * star.twinkleSpeed + star.phase) * 0.38 + 0.62;
        count++;
        ctx.rect(star.x - star.size / 2, star.y - star.size / 2, star.size, star.size);
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${count > 0 ? twitchSum / count : 1})`;
      ctx.fill();
    }

    // Constelação do macaco.
    const monkeyStars = [
      { x: W * 0.38, y: 40 }, { x: W * 0.44, y: 25 }, { x: W * 0.5, y: 28 },
      { x: W * 0.53, y: 50 }, { x: W * 0.47, y: 65 }, { x: W * 0.41, y: 55 },
      { x: W * 0.38, y: 40 },
    ];
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(monkeyStars[0].x, monkeyStars[0].y);
    for (let i = 1; i < monkeyStars.length; i++) ctx.lineTo(monkeyStars[i].x, monkeyStars[i].y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (const s of monkeyStars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.textAlign = "center";
    ctx.fillText("Constelação Primata 🐵", W * 0.45, 82);
    ctx.restore();

    // Estrelas cadentes.
    ctx.save();
    ctx.lineWidth = 1.5;
    for (const ss of this.shootingStars) {
      const tailX = ss.x - Math.cos(ss.angle) * ss.progress;
      const tailY = ss.y + Math.sin(ss.angle) * ss.progress;
      const headX = ss.x - Math.cos(ss.angle) * (ss.progress - ss.length);
      const headY = ss.y + Math.sin(ss.angle) * (ss.progress - ss.length);
      const sgrad = ctx.createLinearGradient(tailX, tailY, headX, headY);
      sgrad.addColorStop(0, "rgba(255, 255, 255, 0)");
      sgrad.addColorStop(1, "rgba(255, 255, 255, 0.8)");
      ctx.strokeStyle = sgrad;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();
    }
    ctx.restore();

    // Planetas.
    ctx.save();
    ctx.globalAlpha *= 0.9;
    for (const p of this.planets) {
      if (p.rings) {
        ctx.strokeStyle = "rgba(235, 200, 120, 0.4)";
        ctx.lineWidth = 3.5;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(2, 0.45);
        ctx.rotate(-Math.PI / 12);
        ctx.beginPath();
        ctx.arc(0, 0, p.r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      const shad = ctx.createRadialGradient(p.x - p.r / 3, p.y - p.r / 3, 1, p.x, p.y, p.r);
      shad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      shad.addColorStop(1, "rgba(0, 0, 0, 0.45)");
      ctx.fillStyle = shad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Cordilheira marciana recortada.
    ctx.save();
    ctx.globalAlpha *= 0.9;
    ctx.fillStyle = "#3b1f1b";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    const off = (this.scroll[3] * 0.4) % 120;
    for (let x = -120; x <= W + 120; x += 60) {
      const px = x - off;
      const seed = Math.abs(Math.round((x + this.scroll[3] * 0.4) / 60)) % 4;
      ctx.lineTo(px, GROUND_Y - 30 - seed * 16);
    }
    ctx.lineTo(W + 120, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawDragon(ctx) {
    const d = this.dragon;
    if (!d.active && d.particles.length === 0) return;
    ctx.save();
    for (const p of d.particles) {
      ctx.fillStyle = `rgba(255, ${80 + Math.floor(Math.random() * 100)}, 0, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (d.active) {
      ctx.font = "32px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🐉", d.x, d.y);
    }
    ctx.restore();
  }

  /** Partículas ambientes — desenhadas na frente de tudo, bem sutis. */
  drawAmbient(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(0.75, p.life / 120);
      ctx.fillStyle = p.color;
      if (p.kind === "leaf") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
