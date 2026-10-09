/**
 * Ball Class - True 3D rolling orientation, perspective sphere rendering, and physics state.
 */
class Ball {
  static COLORS = {
    1: '#facc15', // 1 Yellow
    2: '#2563eb', // 2 Blue
    3: '#ef4444', // 3 Red
    4: '#8b5cf6', // 4 Purple
    5: '#f97316', // 5 Orange
    6: '#15803d', // 6 Green
    7: '#831843', // 7 Maroon/Burgundy
    8: '#111827', // 8 Black
    9: '#facc15', // 9 Yellow stripe
    10: '#2563eb', // 10 Blue stripe
    11: '#ef4444', // 11 Red stripe
    12: '#8b5cf6', // 12 Purple stripe
    13: '#f97316', // 13 Orange stripe
    14: '#15803d', // 14 Green stripe
    15: '#831843', // 15 Maroon stripe
  };

  constructor(number, x = 0, y = 0, radius = 13.5) {
    this.number = number;
    this.pos = new Vector2D(x, y);
    this.vel = new Vector2D(0, 0);
    this.spin = new Vector2D(0, 0); // (x: side spin, y: top/back spin)
    this.radius = radius;
    this.mass = 1.0;
    this.isPotted = false;
    this.isBeingPlaced = false; // Flag for ball-in-hand placement ghost
    this.pocketAnim = null; // { progress, targetPos, pocketRadius }

    // 3D Orthonormal orientation vectors on the unit sphere
    // u: Pole axis (number badges are located at +u and -u)
    this.ux = 0; this.uy = 0; this.uz = 1;
    // v: Equatorial axis (stripe orientation)
    this.vx = 1; this.vy = 0; this.vz = 0;
    // w: Perpendicular equatorial axis (w = u x v)
    this.wx = 0; this.wy = 1; this.wz = 0;

    // Suit determination
    if (number === 0) {
      this.type = 'cue';
      this.color = '#ffffff';
    } else if (number >= 1 && number <= 7) {
      this.type = 'solid';
      this.color = Ball.COLORS[number];
    } else if (number === 8) {
      this.type = '8ball';
      this.color = Ball.COLORS[8];
    } else {
      this.type = 'stripe';
      this.color = Ball.COLORS[number];
    }

    // Give each ball a subtle natural random initial rotation
    this.randomizeOrientation();
  }

  randomizeOrientation() {
    const rx = (Math.random() - 0.5) * Math.PI;
    const ry = (Math.random() - 0.5) * Math.PI;
    const rz = (Math.random() - 0.5) * Math.PI;
    this.rotate3D(1, 0, 0, rx);
    this.rotate3D(0, 1, 0, ry);
    this.rotate3D(0, 0, 1, rz);
  }

  reset(x, y) {
    this.pos.set(x, y);
    this.vel.set(0, 0);
    this.spin.set(0, 0);
    this.isPotted = false;
    this.isBeingPlaced = false;
    this.pocketAnim = null;
    this.randomizeOrientation();
  }

  isMoving() {
    return this.vel.magSq() > 0.0004;
  }

  // 3D Rodrigues rotation formula around arbitrary unit axis (ax, ay, az)
  rotate3D(ax, ay, az, angle) {
    if (Math.abs(angle) < 0.00001) return;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const k = 1 - cos;

    const rot = (x, y, z) => {
      const dot = ax * x + ay * y + az * z;
      const cx = ay * z - az * y;
      const cy = az * x - ax * z;
      const cz = ax * y - ay * x;
      return [
        x * cos + cx * sin + ax * dot * k,
        y * cos + cy * sin + ay * dot * k,
        z * cos + cz * sin + az * dot * k
      ];
    };

    [this.ux, this.uy, this.uz] = rot(this.ux, this.uy, this.uz);
    [this.vx, this.vy, this.vz] = rot(this.vx, this.vy, this.vz);
    [this.wx, this.wy, this.wz] = rot(this.wx, this.wy, this.wz);

    // Re-normalize to prevent numerical drift
    const lu = Math.hypot(this.ux, this.uy, this.uz);
    if (lu > 0) { this.ux /= lu; this.uy /= lu; this.uz /= lu; }

    const lv = Math.hypot(this.vx, this.vy, this.vz);
    if (lv > 0) { this.vx /= lv; this.vy /= lv; this.vz /= lv; }

    // Recompute w = u x v to maintain strict orthogonality
    this.wx = this.uy * this.vz - this.uz * this.vy;
    this.wy = this.uz * this.vx - this.ux * this.vz;
    this.wz = this.ux * this.vy - this.uy * this.vx;
  }

  // Roll the ball in 3D across the table surface
  roll(dx, dy, spinZ = 0) {
    const dist = Math.hypot(dx, dy);
    if (dist > 0.0001) {
      const angle = dist / this.radius;
      // Rotation axis lies on the table surface (z=0), perpendicular to displacement (dx, dy)
      // Moving in (dx, dy) rotates around (-dy/dist, dx/dist, 0)
      const ax = -dy / dist;
      const ay = dx / dist;
      this.rotate3D(ax, ay, 0, angle);
    }

    if (Math.abs(spinZ) > 0.0001) {
      // Rotation around vertical Z axis (sidespin / English)
      this.rotate3D(0, 0, 1, spinZ);
    }
  }

  startPocketAnimation(pocketPos, pocketRadius) {
    this.isPotted = true;
    this.pocketAnim = {
      progress: 0,
      startPos: this.pos.copy(),
      targetPos: pocketPos.copy(),
      pocketRadius: pocketRadius
    };
    this.vel.set(0, 0);
  }

  updatePocketAnimation(dt = 1) {
    if (!this.pocketAnim) return;
    this.pocketAnim.progress += 0.08 * dt;
    if (this.pocketAnim.progress > 1) {
      this.pocketAnim.progress = 1;
    }
    const t = this.pocketAnim.progress;
    this.pos.x = this.pocketAnim.startPos.x + (this.pocketAnim.targetPos.x - this.pocketAnim.startPos.x) * t;
    this.pos.y = this.pocketAnim.startPos.y + (this.pocketAnim.targetPos.y - this.pocketAnim.startPos.y) * t;
  }

  // =========================================================================
  // 3D Sphere Rendering
  // =========================================================================
  render(ctx) {
    if (this.isPotted && (!this.pocketAnim || this.pocketAnim.progress >= 1)) {
      return;
    }

    ctx.save();

    let scale = 1.0;
    let alpha = 1.0;
    if (this.pocketAnim) {
      scale = 1.0 - this.pocketAnim.progress * 0.55;
      alpha = 1.0 - this.pocketAnim.progress * 0.7;
      ctx.globalAlpha = alpha;
    }

    const x = this.pos.x;
    const y = this.pos.y;
    const r = this.radius * scale;

    // 1. Drop shadow beneath the ball on felt
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill();

    // 2. Base Sphere Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);

    if (this.type === 'stripe') {
      ctx.fillStyle = '#f8fafc'; // White base for striped balls
    } else if (this.type === 'cue') {
      ctx.fillStyle = '#fdfdfd'; // Off-white for cue ball
    } else {
      ctx.fillStyle = this.color; // Solid / 8-ball color
    }
    ctx.fill();

    // 3. Render 3D rolling texture elements
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip(); // Clip everything to the ball boundary

    if (this.type === 'stripe') {
      this.render3DStripe(ctx, x, y, r);
    }

    if (this.number > 0) {
      // Number Badges on opposite poles +u and -u
      this.render3DBadge(ctx, x, y, r, this.ux, this.uy, this.uz, 1);
      this.render3DBadge(ctx, x, y, r, -this.ux, -this.uy, -this.uz, -1);
    } else {
      // Cue Ball Measle Dots (6 Aramith red dots at +/-u, +/-v, +/-w)
      this.render3DCueDots(ctx, x, y, r);
    }

    ctx.restore();

    // 4. Fixed 3D Specular Highlight & Spherical Shadow
    // The light source stays fixed at top-left world coordinates while texture rolls!
    const shadowGrad = ctx.createRadialGradient(
      x - r * 0.35,
      y - r * 0.35,
      r * 0.08,
      x,
      y,
      r
    );
    shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    shadowGrad.addColorStop(0.28, 'rgba(255, 255, 255, 0.15)');
    shadowGrad.addColorStop(0.72, 'rgba(0, 0, 0, 0.0)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.58)');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = shadowGrad;
    ctx.fill();

    // Crisp high-gloss specular highlight pinprick
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.32, r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();

    ctx.restore();
  }

  // Render 3D perspective stripe band
  render3DStripe(ctx, x, y, r) {
    const ux = this.ux;
    const uy = this.uy;
    const uz = this.uz;
    const u2d = Math.hypot(ux, uy);

    ctx.fillStyle = this.color;

    // Pole facing nearly straight toward or away from viewer (u2d ~ 0)
    if (u2d < 0.12) {
      // White cap in center of radius ~0.70*r, surrounded by prominent colored equatorial ring
      const innerR = r * 0.70;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.arc(x, y, innerR, 0, Math.PI * 2, true);
      ctx.fill();

      // Sharp boundary pinstripe
      ctx.beginPath();
      ctx.arc(x, y, innerR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }

    // Normal stripe case: draw colored band wrapping around equator
    const angle = Math.atan2(uy, ux);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // In local space, u points along +X, equator wraps around Y
    const h = r * 0.40; // Stripe half-width along pole
    const rCap = Math.sqrt(Math.max(0, r * r - h * h));
    const wx = rCap * Math.abs(uz);

    // Draw the exact band between the two ellipses (+h and -h)
    ctx.beginPath();
    ctx.ellipse(h * u2d, 0, wx, rCap, 0, -Math.PI / 2, Math.PI / 2, uz < 0);
    ctx.ellipse(-h * u2d, 0, wx, rCap, 0, Math.PI / 2, -Math.PI / 2, uz > 0);
    ctx.closePath();
    ctx.fill();

    // Crisp boundary pinstripes for sharp contrast against white caps
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(h * u2d, 0, wx, rCap, 0, -Math.PI / 2, Math.PI / 2, uz < 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-h * u2d, 0, wx, rCap, 0, -Math.PI / 2, Math.PI / 2, uz < 0);
    ctx.stroke();

    ctx.restore();
  }

  // Render 3D foreshortened number badge
  render3DBadge(ctx, x, y, r, px, py, pz, sign) {
    // Only render if on or near the visible upper hemisphere (pz > -0.15)
    if (pz < -0.15) return;

    const bx = x + px * r;
    const by = y + py * r;
    const badgeR = r * 0.38;

    // Tangent angle from center of ball
    const radAngle = Math.atan2(py, px);
    const pzClamped = Math.max(0.08, pz);

    // Badge alpha fades near the horizon for smooth rolling transition
    const alpha = Math.min(1.0, (pz + 0.15) / 0.25);
    ctx.save();
    ctx.globalAlpha *= alpha;

    // 1. White badge circle foreshortened into an ellipse
    ctx.beginPath();
    ctx.ellipse(bx, by, badgeR, badgeR * pzClamped, radAngle + Math.PI / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Subtle dark border around badge
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 2. Number text inside the foreshortened badge
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(radAngle + Math.PI / 2);
    ctx.scale(1.0, pzClamped);

    // Striped Balls (9-15): Draw tournament colored underline bar beneath the number
    // Makes striped balls instantly recognizable from any angle!
    if (this.type === 'stripe') {
      const barW = badgeR * 1.15;
      const barH = 2.0;
      ctx.fillStyle = this.color;
      ctx.fillRect(-barW / 2, badgeR * 0.44, barW, barH);
    }

    ctx.fillStyle = '#111827';
    ctx.font = `bold ${Math.round(badgeR * 1.15)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.number.toString(), 0, this.type === 'stripe' ? -0.8 : 0.5);

    ctx.restore();
    ctx.restore();
  }

  // Render 3D rolling red measles dots on the cue ball
  render3DCueDots(ctx, x, y, r) {
    const dotR = r * 0.13;
    const poles = [
      [this.ux, this.uy, this.uz],
      [-this.ux, -this.uy, -this.uz],
      [this.vx, this.vy, this.vz],
      [-this.vx, -this.vy, -this.vz],
      [this.wx, this.wy, this.wz],
      [-this.wx, -this.wy, -this.wz]
    ];

    ctx.fillStyle = '#ef4444';

    for (const [px, py, pz] of poles) {
      if (pz > 0.01) {
        const dx = x + px * r;
        const dy = y + py * r;
        const radAngle = Math.atan2(py, px);
        const pzClamped = Math.max(0.08, pz);

        ctx.beginPath();
        ctx.ellipse(dx, dy, dotR, dotR * pzClamped, radAngle + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
