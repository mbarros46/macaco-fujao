import {
  W, H, GROUND_Y, jumpAirFrames, MIN_HAZARD_GAP, RIVER_LOG_CLEARANCE,
  ROCK_LOG_CLEARANCE, ROCK_RIVER_CLEARANCE, HUNTER_MAX_GAP, HUNTER_BANANA_BONUS,
  MAX_LIVES, MAX_HAZARD_WIDTH, FLIER_Y, FLIER_H, FLIER_W, FLIER_SPEED_MUL,
  FLIER_CLEARANCE, MAGNET_RADIUS,
} from "./Config.js";
import { drawVineRope, withAlpha } from "./Helpers.js";

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class Environment {
  constructor() {
    this.reset();
  }

  reset() {
    this.logs = [];
    this.bananas = [];
    this.powerups = [];
    this.rocks = [];
    this.rivers = [];
    this.fliers = [];

    this.spawnTimer = 60;
    this.bananaTimer = 120;
    this.riverTimer = 420;
    this.rockTimer = 500 + Math.random() * 200;
    this.flierTimer = 300 + Math.random() * 200;
  }

  /** Empurra tudo para a esquerda sem rodar spawn/colisão (usado nas cutscenes). */
  scrollOnly(speed) {
    for (const list of [this.logs, this.rocks, this.rivers, this.bananas, this.powerups]) {
      for (const item of list) item.x -= speed;
    }
    for (const f of this.fliers) f.x -= speed * FLIER_SPEED_MUL;
  }

  // O ícone é fixado no momento do spawn: se dependesse do tema do frame, um
  // obstáculo já na tela trocaria de aparência no meio da transição de fase.
  spawnLog(theme) {
    const h = 30 + Math.random() * 20;
    const w = 30 + Math.random() * 30;
    this.logs.push({ x: W + 20, y: GROUND_Y - h, w, h, icon: theme.logIcon, reason: theme.logDamage });
  }

  spawnRock(theme) {
    const w = 55 + Math.random() * 20;
    this.rocks.push({ x: W + 20, w, h: 46, icon: theme.rockIcon, glow: theme.rockGlow });
  }

  // Voadores ocupam a faixa da cabeça: não dá para pular por cima nem passar
  // por baixo de pé. A única saída é agachar.
  spawnFlier(theme) {
    this.fliers.push({
      x: W + 30,
      y: FLIER_Y,
      w: FLIER_W,
      h: FLIER_H,
      icon: theme.flierIcon,
      reason: theme.flierDamage,
      phase: Math.random() * Math.PI * 2,
    });
  }

  spawnItem(theme, player) {
    const onGround = Math.random() < 0.7;
    const y = onGround ? GROUND_Y - 30 : GROUND_Y - 110 - Math.random() * 30;

    // Corações são mais generosos nas fases avançadas, mas nunca acima do teto
    // de vidas — senão o HUD estoura e o jogo perde a tensão.
    const heartMax = theme.idx >= 2 ? 2 : 1;
    const onScreenHearts = this.powerups.filter((p) => p.type === "heart" && !p.collected).length;
    if (player.lives < MAX_LIVES && onScreenHearts < heartMax && Math.random() < 0.06) {
      this.powerups.push({ x: W + 20, y: y - 5, w: 26, h: 26, type: "heart", collected: false });
      return;
    }

    if (Math.random() < 0.14) {
      // O escudo é o mais raro por ser o mais forte (anula um golpe inteiro).
      const pool = ["peel", "spring", "magnet", "freeze", "magnet", "freeze", "shield"];
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.powerups.push({ x: W + 20, y: y - 5, w: 26, h: 26, type, collected: false });
    } else {
      this.bananas.push({ x: W + 20, y, w: 26, h: 26, collected: false });
    }
  }

  // A largura do rio sai do tempo de ar do pulo: tem que ser larga o bastante
  // para exigir o cipó, mas atravessável com ele. Na fase espacial a gravidade
  // é menor, o pulo é mais longo, e o rio precisa acompanhar.
  spawnRiver(speed, gravityScale, theme) {
    const airFrames = jumpAirFrames(gravityScale);
    // O teto evita que a gravidade baixa da fase espacial gere uma fenda maior
    // que a tela — aí o cipó nasceria fora do campo de visão.
    const w = Math.min(MAX_HAZARD_WIDTH, Math.round(airFrames * speed) + 70 + Math.random() * 40);
    const swingDuration = Math.ceil((w + 90) / speed) + 15;
    this.rivers.push({
      x: W + 20,
      w,
      vineOffset: w * 0.18,
      vineGrabbed: false,
      swingDuration,
      hunterSwimDuration: Math.round(swingDuration * 1.3),
      hunterTriggered: false,
      phase: Math.random() * 10,
      style: theme.waterStyle,
      colors: [theme.water[0], theme.water[1]],
      vinePalette: theme.vine,
    });
  }

  update({ speed, score, player, hunter, sfx, onDamage, shake, theme }) {
    const gravityScale = theme.phase.gravity;

    // --- 1. Spawning ------------------------------------------------------
    // Fases mais avançadas apertam o ritmo dos obstáculos.
    const pressure = Math.min(34, Math.floor(score / 22) + theme.idx * 4);

    this.spawnTimer--;
    if (this.spawnTimer <= 0) {
      this.spawnLog(theme);
      this.spawnTimer = 70 - pressure + Math.random() * 40;
      this.bananaTimer = Math.max(this.bananaTimer, MIN_HAZARD_GAP);
    }

    this.bananaTimer--;
    if (this.bananaTimer <= 0) {
      this.spawnItem(theme, player);
      this.bananaTimer = 90 + Math.random() * 90;
      this.spawnTimer = Math.max(this.spawnTimer, MIN_HAZARD_GAP);
    }

    this.riverTimer--;
    if (this.riverTimer <= 0 && this.rivers.length === 0) {
      const lastLog = this.logs[this.logs.length - 1];
      const lastRock = this.rocks[this.rocks.length - 1];
      const logClear = !lastLog || lastLog.x + lastLog.w < W - RIVER_LOG_CLEARANCE;
      const rockClear = !lastRock || lastRock.x + lastRock.w < W - ROCK_RIVER_CLEARANCE;
      if (logClear && rockClear) {
        this.spawnRiver(speed, gravityScale, theme);
        this.riverTimer = 450 + Math.random() * 300 - theme.idx * 30;
        this.spawnTimer = Math.max(this.spawnTimer, 100);
        this.bananaTimer = Math.max(this.bananaTimer, 80);
        this.rockTimer = Math.max(this.rockTimer, 200);
      } else {
        this.riverTimer = 10;
      }
    }

    this.rockTimer--;
    if (this.rockTimer <= 0 && this.rocks.length === 0) {
      const lastLog = this.logs[this.logs.length - 1];
      const lastRiver = this.rivers[this.rivers.length - 1];
      const logClear = !lastLog || lastLog.x + lastLog.w < W - ROCK_LOG_CLEARANCE;
      const riverClear = !lastRiver || lastRiver.x + lastRiver.w < W - ROCK_RIVER_CLEARANCE;
      if (logClear && riverClear) {
        this.spawnRock(theme);
        this.rockTimer = 500 + Math.random() * 300 - theme.idx * 30;
        this.spawnTimer = Math.max(this.spawnTimer, 100);
        this.bananaTimer = Math.max(this.bananaTimer, 80);
        this.riverTimer = Math.max(this.riverTimer, 200);
      } else {
        this.rockTimer = 10;
      }
    }

    // Voadores só a partir da fase 2 — a primeira fase serve para o jogador
    // aprender pulo e cipó antes de precisar do agachamento.
    this.flierTimer--;
    if (this.flierTimer <= 0) {
      // Na primeira metade da fase 1 não aparecem: o jogador ainda está
      // aprendendo pulo e cipó. Depois disso já entram, para a mecânica de
      // agachar ser apresentada cedo em vez de só na fase 2.
      if (theme.idx === 0 && score < 250) {
        this.flierTimer = 120;
      } else {
        // Não pode coincidir com uma rocha (que obriga a parar e cavar) nem com
        // um rio (onde o jogador está pendurado e sem controle de altura).
        const lastRock = this.rocks[this.rocks.length - 1];
        const lastRiver = this.rivers[this.rivers.length - 1];
        const rockClear = !lastRock || lastRock.x + lastRock.w < W - FLIER_CLEARANCE;
        const riverClear = !lastRiver || lastRiver.x + lastRiver.w < W - FLIER_CLEARANCE;
        if (rockClear && riverClear) {
          this.spawnFlier(theme);
          this.flierTimer = 420 + Math.random() * 320 - theme.idx * 40;
          this.spawnTimer = Math.max(this.spawnTimer, 90);
        } else {
          this.flierTimer = 15;
        }
      }
    }

    // --- 2. Movimento -----------------------------------------------------
    this.scrollOnly(speed);
    this.logs = this.logs.filter((l) => l.x + l.w > -10);
    this.fliers = this.fliers.filter((f) => f.x + f.w > -10);

    // Ímã: puxa as bananas próximas para o macaco.
    if (player.magnetTimer > 0) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      for (const b of this.bananas) {
        const dx = px - (b.x + b.w / 2);
        const dy = py - (b.y + b.h / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < MAGNET_RADIUS && dist > 1) {
          const pull = Math.min(9, (1 - dist / MAGNET_RADIUS) * 13);
          b.x += (dx / dist) * pull;
          b.y += (dy / dist) * pull;
        }
      }
    }
    this.bananas = this.bananas.filter((b) => b.x + b.w > -10 && !b.collected);
    this.powerups = this.powerups.filter((p) => p.x + p.w > -10 && !p.collected);
    this.rivers = this.rivers.filter((r) => r.x + r.w > -HUNTER_MAX_GAP - 60);
    this.rocks = this.rocks.filter((r) => r.x + r.w > -10);

    // --- 3. Colisões ------------------------------------------------------
    // Vem do próprio jogador porque encolhe quando ele agacha.
    const hitbox = player.hitbox();
    // Durante a invulnerabilidade o macaco atravessa os perigos. Sem isso, o
    // obstáculo que acabou de acertá-lo continua sobreposto e dispara tremor
    // de tela (e dano de novo assim que a invulnerabilidade acaba).
    const vulnerable = player.invulnerableTimer <= 0;

    if (vulnerable) {
      for (const flier of this.fliers) {
        const box = { x: flier.x + 4, y: flier.y + 3, w: flier.w - 8, h: flier.h - 6 };
        if (rectsOverlap(hitbox, box)) {
          shake();
          onDamage(flier.reason);
          return null;
        }
      }

      for (const log of this.logs) {
        const logHitbox = { x: log.x + 4, y: log.y + 4, w: log.w - 8, h: log.h - 8 };
        if (rectsOverlap(hitbox, logHitbox)) {
          shake();
          onDamage(log.reason || "log");
          return null;
        }
      }
    }

    for (const rock of this.rocks) {
      const rockHitbox = { x: rock.x + 6, y: GROUND_Y - rock.h + 8, w: rock.w - 12, h: rock.h - 8 };
      if (rectsOverlap(hitbox, rockHitbox)) {
        // Com o super pulo ativo ele passa por cima da rocha.
        if (player.superJumpTimer > 0) continue;

        if (player.jumping || player.swinging) {
          if (!vulnerable) continue;
          shake();
          onDamage("rock");
          return null;
        }
        return rock; // entra em modo escavação
      }
    }

    for (const b of this.bananas) {
      if (!b.collected && rectsOverlap(hitbox, b)) {
        b.collected = true;
        hunter.gap = Math.min(HUNTER_MAX_GAP, hunter.gap + HUNTER_BANANA_BONUS);
        if (sfx) sfx.banana();
        return "banana";
      }
    }

    for (const p of this.powerups) {
      if (!p.collected && rectsOverlap(hitbox, p)) {
        p.collected = true;
        if (p.type === "peel") {
          hunter.gap = Math.min(HUNTER_MAX_GAP, hunter.gap + 90);
          if (sfx) {
            sfx.banana();
            setTimeout(() => sfx.banana(), 80);
          }
          return "peel";
        }
        if (p.type === "spring") {
          player.collectSuperJump();
          if (sfx) {
            sfx.jump();
            setTimeout(() => sfx.jump(), 90);
          }
          return "spring";
        }
        if (p.type === "heart") {
          if (sfx) sfx.heart();
          return "heart";
        }
        if (p.type === "shield") {
          player.shield = true;
          if (sfx) sfx.shieldUp();
          return "shield";
        }
        if (p.type === "magnet") {
          player.collectMagnet();
          if (sfx) sfx.magnet();
          return "magnet";
        }
        if (p.type === "freeze") {
          hunter.freeze();
          if (sfx) sfx.freeze();
          return "freeze";
        }
      }
    }

    for (const river of this.rivers) {
      const vineX = river.x + river.vineOffset;
      if (!player.swinging && !river.vineGrabbed && player.jumping) {
        const vineZone = { x: vineX - 16, y: 0, w: 32, h: GROUND_Y - 20 };
        if (rectsOverlap(hitbox, vineZone)) {
          river.vineGrabbed = true;
          player.swinging = true;
          player.jumping = true;
          player.swingT = 0;
          player.swingDuration = river.swingDuration;
          player.swingStartY = player.y;
          if (sfx) sfx.vineGrab();
        }
      }

      if (!player.swinging && vulnerable &&
          rectsOverlap(hitbox, { x: river.x, y: GROUND_Y - 16, w: river.w, h: H - GROUND_Y + 16 })) {
        shake();
        onDamage("river");
        return null;
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Desenho
  // -------------------------------------------------------------------------
  draw(ctx, frame, groundOffset, theme) {
    // 1. Chão
    ctx.fillStyle = theme.ground[0];
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = theme.ground[1];
    for (let i = 0; i < W; i += 24) {
      ctx.fillRect(i - groundOffset, GROUND_Y, 12, 6);
    }

    // 2. Rios / areia movediça / lava / fendas
    for (const river of this.rivers) this.drawHazardPool(ctx, river, frame);

    // 3. Troncos (ou cactos, ossadas, meteoros)
    for (const log of this.logs) {
      ctx.save();
      ctx.translate(log.x + log.w / 2, log.y + log.h / 2);
      ctx.font = `${Math.max(log.w, log.h) + 10}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(log.icon, 0, 0);
      ctx.restore();
    }

    // 4. Rochas
    for (const rock of this.rocks) {
      ctx.save();
      ctx.translate(rock.x + rock.w / 2, GROUND_Y - rock.h / 2 + 6);
      if (rock.glow) {
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, rock.h);
        g.addColorStop(0, rock.glow);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rock.h, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = `${rock.h + 32}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rock.icon, 0, 0);
      ctx.restore();
    }

    // 5. Voadores
    for (const f of this.fliers) {
      ctx.save();
      // Desenhado exatamente sobre a caixa de colisão. Antes havia um balanço
      // vertical (`sin`) só no desenho: o bicho aparecia alguns pixels acima ou
      // abaixo de onde realmente colidia, e o jogador agachado via o bicho
      // encostar nele sem tomar dano — parecia bug porque era.
      ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Halo claro atrás do bicho. Um fundo escuro seria pior: a águia e o
      // morcego já são escuros e sumiriam dentro dele. O halo claro destaca
      // tanto os ícones escuros quanto os coloridos, em qualquer cenário.
      const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, f.w * 0.6);
      halo.addColorStop(0, "rgba(255, 255, 255, 0.65)");
      halo.addColorStop(0.6, "rgba(255, 255, 255, 0.3)");
      halo.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, f.w * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Fonte limitada à altura da caixa: o ícone não transborda para a faixa
      // de quem está agachado, então o que se vê é o que colide.
      ctx.font = `${f.h}px serif`;
      ctx.fillText(f.icon, 0, 1);
      ctx.restore();
    }

    // Aviso de "abaixe!" enquanto o voador ainda está chegando. Fica acima
    // dele, em céu aberto, onde dá para ler — e some quando ele chega perto,
    // para não poluir bem na hora da ação.
    for (const f of this.fliers) {
      if (f.x < 190 || f.x > W - 40) continue;
      const alpha = Math.min(1, (f.x - 190) / 90) * (0.55 + 0.45 * Math.sin(frame * 0.18));
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(f.x + f.w / 2, f.y - 20);
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.roundRect(-30, -10, 60, 19, 9);
      ctx.fill();
      ctx.font = "bold 11px 'Segoe UI', sans-serif";
      ctx.fillStyle = "#ffe066";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("↓ ABAIXE", 0, 0);
      ctx.restore();
    }

    // 6. Bananas
    ctx.font = "26px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const b of this.bananas) {
      const bob = Math.sin(frame * 0.1 + b.x * 0.05) * 2;
      ctx.fillText("🍌", b.x + b.w / 2, b.y + b.h / 2 + bob);
    }

    // 6. Power-ups
    for (const p of this.powerups) this.drawPowerup(ctx, p, frame);

    // 7. Cipós pendurados sobre os rios
    for (const river of this.rivers) {
      if (river.vineGrabbed) continue;
      const vineX = river.x + river.vineOffset;
      const handX = vineX + Math.sin(frame * 0.05 + river.phase) * 8;
      drawVineRope(ctx, vineX, 0, handX, GROUND_Y - 95, river.vinePalette);
    }
  }

  drawHazardPool(ctx, river, frame) {
    const grad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    grad.addColorStop(0, river.colors[0]);
    grad.addColorStop(1, river.colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(river.x, GROUND_Y, river.w, H - GROUND_Y);

    ctx.save();
    ctx.beginPath();
    ctx.rect(river.x, GROUND_Y, river.w, H - GROUND_Y);
    ctx.clip();

    if (river.style === "river") {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let wx = 0; wx < river.w; wx += 20) {
        const wy = GROUND_Y + 10 + Math.sin(frame * 0.1 + wx) * 3;
        ctx.moveTo(river.x + wx, wy);
        ctx.quadraticCurveTo(river.x + wx + 5, wy + 4, river.x + wx + 10, wy);
      }
      ctx.stroke();
    } else if (river.style === "quicksand") {
      // Redemoinhos lentos de areia.
      ctx.strokeStyle = "rgba(90, 60, 20, 0.4)";
      ctx.lineWidth = 2.5;
      for (let wx = 12; wx < river.w; wx += 42) {
        const cy = GROUND_Y + 18 + Math.sin(frame * 0.03 + wx) * 4;
        ctx.beginPath();
        ctx.ellipse(river.x + wx, cy, 15, 5, Math.sin(frame * 0.02 + wx) * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (river.style === "lava") {
      // Brilho pulsante + bolhas estourando.
      ctx.fillStyle = `rgba(255, 235, 120, ${0.18 + 0.12 * Math.sin(frame * 0.08)})`;
      ctx.fillRect(river.x, GROUND_Y, river.w, 10);
      ctx.fillStyle = "rgba(255, 220, 130, 0.75)";
      for (let wx = 10; wx < river.w; wx += 30) {
        const t = (frame * 0.04 + wx) % 6;
        const r = Math.max(0, 4 - Math.abs(t - 3) * 1.4);
        ctx.beginPath();
        ctx.arc(river.x + wx, GROUND_Y + 14 + Math.sin(frame * 0.05 + wx) * 3, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (river.style === "rift") {
      // Fenda espacial: estrelas presas no vazio.
      for (let i = 0; i < river.w / 14; i++) {
        const sx = river.x + ((i * 37) % river.w);
        const sy = GROUND_Y + 6 + ((i * 23) % (H - GROUND_Y - 8));
        const tw = 0.35 + 0.35 * Math.sin(frame * 0.09 + i);
        ctx.fillStyle = withAlpha("#ffffff", tw);
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.strokeStyle = `rgba(190, 140, 255, ${0.35 + 0.2 * Math.sin(frame * 0.07)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(river.x, GROUND_Y + 2);
      ctx.lineTo(river.x + river.w, GROUND_Y + 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPowerup(ctx, p, frame) {
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    const scale = 1.0 + Math.sin(frame * 0.15) * 0.1;
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (p.type === "peel") {
      ctx.fillStyle = "#ffe066";
      ctx.strokeStyle = "#4a3223";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI, true);
      ctx.lineTo(-4, 6);
      ctx.lineTo(0, 2);
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#4a3223";
      ctx.fillText("CASCA", 0, -12);
    } else if (p.type === "spring") {
      ctx.strokeStyle = "#ff3366";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-7, 7);
      ctx.bezierCurveTo(-3, 3, 3, 3, 0, 0);
      ctx.bezierCurveTo(-3, -3, 3, -3, 0, -6);
      ctx.bezierCurveTo(-3, -9, 3, -9, 0, -12);
      ctx.stroke();
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#ff3366";
      ctx.fillText("MOLA", 0, -18);
    } else if (p.type === "heart") {
      ctx.font = "24px serif";
      ctx.fillText("❤️", 0, 0);
    } else if (p.type === "shield") {
      ctx.font = "24px serif";
      ctx.fillText("🛡️", 0, 0);
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#8fe4ff";
      ctx.fillText("ESCUDO", 0, -15);
    } else if (p.type === "magnet") {
      ctx.font = "24px serif";
      ctx.fillText("🧲", 0, 0);
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#8fc8ff";
      ctx.fillText("ÍMÃ", 0, -15);
    } else if (p.type === "freeze") {
      ctx.font = "24px serif";
      ctx.fillText("🧊", 0, 0);
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#a8ecff";
      ctx.fillText("GELO", 0, -15);
    }
    ctx.restore();
  }
}
