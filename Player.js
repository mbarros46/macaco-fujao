import { W, H, GROUND_Y, GRAVITY, JUMP_FORCE, SWING_LIFT, MAX_HANG_GRACE, DOUBLE_TAP_WINDOW } from "./Config.js";
import { drawSoftShadow, drawLittleHand, drawVineRope } from "./Helpers.js";

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 90;
    this.y = GROUND_Y - 40;
    this.w = 40;
    this.h = 40;
    this.vy = 0;
    this.jumping = false;
    this.swinging = false;
    this.swingT = 0;
    this.swingDuration = 0;
    this.swingStartY = 0;
    this.digging = false;

    // Game feel & Power-ups
    this.coyoteTimeFramesLeft = 0;
    this.jumpBufferFramesLeft = 0;
    this.superJumpTimer = 0;
    this.wasGroundedLastFrame = true;
  }

  isGrounded() {
    return this.y >= GROUND_Y - this.h;
  }

  jump(sfx) {
    if (this.swinging || this.digging) return;

    const currentJumpForce = this.superJumpTimer > 0 ? JUMP_FORCE * 1.38 : JUMP_FORCE;

    if (this.isGrounded() || this.coyoteTimeFramesLeft > 0) {
      this.vy = currentJumpForce;
      this.jumping = true;
      this.coyoteTimeFramesLeft = 0;
      if (sfx) sfx.jump();
    } else {
      // Trigger jump buffer if in air
      this.jumpBufferFramesLeft = 6;
    }
  }

  collectSuperJump() {
    this.superJumpTimer = 600; // 10 seconds at 60fps
  }

  update(activeRock, frame, endGame, sfx) {
    // Decrement jump buffer
    if (this.jumpBufferFramesLeft > 0) {
      this.jumpBufferFramesLeft--;
    }

    // Decrement super jump timer
    if (this.superJumpTimer > 0) {
      this.superJumpTimer--;
    }

    // Coyote time tracking
    const grounded = this.isGrounded();
    if (!grounded && this.wasGroundedLastFrame && !this.jumping && !this.swinging) {
      this.coyoteTimeFramesLeft = 5;
    }
    if (!grounded && this.coyoteTimeFramesLeft > 0) {
      this.coyoteTimeFramesLeft--;
    }
    this.wasGroundedLastFrame = grounded;

    // Jump buffer check
    if (grounded && this.jumpBufferFramesLeft > 0) {
      this.jumpBufferFramesLeft = 0;
      this.jump(sfx);
    }

    // Monkey physics: swinging on vine vs normal gravity
    if (this.swinging) {
      this.swingT++;
      if (this.swingT > this.swingDuration + MAX_HANG_GRACE) {
        endGame("vine");
        return;
      }
      const t = Math.min(1, this.swingT / this.swingDuration);
      const arc = Math.sin(t * Math.PI) * SWING_LIFT;
      const idleSway = t >= 1 ? Math.sin(frame * 0.08) * 4 : 0;
      this.y = this.swingStartY - arc - idleSway;
    } else {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= GROUND_Y - this.h) {
        this.y = GROUND_Y - this.h;
        this.vy = 0;
        this.jumping = false;
      }
    }
  }

  handleSwingRelease(lastSwingTapFrame, sfx) {
    this.swinging = false;
    this.vy = 0;
    if (sfx) sfx.vineRelease();
  }

  draw(ctx, frameNum) {
    const cx = this.x + this.w / 2;
    const baseY = this.y + this.h;
    const jumping = this.jumping;
    const swing = jumping ? 0 : Math.sin(frameNum * 0.35);
    
    // Gorilla Palette
    const FUR = "#38383c";      // Dark charcoal grey
    const SKIN = "#6d6d74";     // Lighter muzzle/chest grey
    const OUTLINE = "#1b1b1d";  // Almost black
    const CHEST = "#525259";

    ctx.save();
    ctx.translate(cx, baseY);

    drawSoftShadow(ctx, 16, 5);

    // Super jump indicator (spring mola effect under the monkey)
    if (this.superJumpTimer > 0) {
      ctx.save();
      ctx.strokeStyle = "#ff3366";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      // Draw a small 2D spiral spring
      ctx.moveTo(-10, 0);
      ctx.bezierCurveTo(-5, -5, 5, -5, 0, -8);
      ctx.bezierCurveTo(-5, -10, 5, -10, 0, -14);
      ctx.bezierCurveTo(-5, -15, 5, -15, 0, -18);
      ctx.stroke();
      ctx.restore();
    }

    const headY = -25;
    const bodyY = -9;

    // 1. Shoulders & Arms (stocky, muscular gorilla shoulders)
    ctx.fillStyle = FUR;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      const armBob = side * swing * 2.5;
      ctx.save();
      ctx.translate(side * 14, bodyY - 4);
      // Large shoulder joint
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Muscular forearm hanging down
      ctx.beginPath();
      ctx.ellipse(0, 7 + armBob, 5.5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Hand fist
      drawLittleHand(ctx, 0, 15 + armBob, SKIN, OUTLINE);
      ctx.restore();
    }

    // 2. Thick stocky neck / back fur
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(0, headY + 5, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Body (Robust muscular chest)
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, bodyY, 15, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gorilla Chest Plate (abs/muscles line)
    ctx.fillStyle = CHEST;
    ctx.beginPath();
    ctx.ellipse(0, bodyY + 1.5, 10, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Chest center division
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, bodyY - 6.5);
    ctx.lineTo(0, bodyY + 9.5);
    ctx.stroke();

    // 4. Head (sagittal crest style, slightly elongated top)
    ctx.fillStyle = FUR;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Top head crest shape
    ctx.moveTo(-9, headY);
    ctx.bezierCurveTo(-11, headY - 14, 11, headY - 14, 9, headY);
    ctx.arc(0, headY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. Gorilla Face Mask (prominent grey face plate, looking forward)
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.ellipse(0, headY + 2.5, 8.5, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrow ridge (flat, strong bar)
    ctx.fillStyle = FUR;
    ctx.fillRect(-7.5, headY - 3, 15, 2.5);

    // Front-facing Eyes
    for (const ex of [-3.8, 3.8]) {
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(ex, headY + 1.2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex - 0.6, headY + 0.6, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flat prominent nose
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(-1.8, headY + 4.5, 1.2, 1, 0, 0, Math.PI * 2);
    ctx.ellipse(1.8, headY + 4.5, 1.2, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (thin serious/determined line)
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, headY + 8, 3.5, 0.4, Math.PI - 0.4);
    ctx.stroke();

    // 6. Ears
    for (const side of [-1, 1]) {
      ctx.fillStyle = FUR;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(side * 11.5, headY - 2, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 7. Feet (thick stout feet at bottom)
    const footY = -1.2;
    const footBob = Math.abs(swing) * 2.2;
    for (const side of [-1, 1]) {
      const fx = side * 8.5;
      const fy = footY - (side === 1 ? footBob : 2.2 - footBob);
      ctx.fillStyle = SKIN;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Super jump indicator (Spring/Mola floating overlay)
    if (this.superJumpTimer > 0) {
      ctx.font = "14px Arial";
      ctx.fillStyle = "#ff3366";
      ctx.textBaseline = "bottom";
      ctx.textAlign = "center";
      ctx.fillText(`⚡ JUMP: ${Math.ceil(this.superJumpTimer / 60)}s`, 0, headY - 18);
    }

    ctx.restore();
  }
}
