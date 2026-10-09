/**
 * ParticleSystem - High-performance billiard particle effects
 * Chalk puffs, collision impact dust, pocket ripples, and victory sparks.
 */
class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.size = 2;
    this.maxLife = 30;
    this.life = 0;
    this.color = '#38bdf8';
    this.type = 'dust'; // 'dust', 'spark', 'ripple'
    this.drag = 0.93;
    this.growth = 0;
  }

  init(x, y, vx, vy, size, life, color, type = 'dust', drag = 0.93, growth = 0) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.maxLife = life;
    this.life = life;
    this.color = color;
    this.type = type;
    this.drag = drag;
    this.growth = growth;
  }

  update(dt = 1) {
    if (!this.active) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(this.drag, dt);
    this.vy *= Math.pow(this.drag, dt);
    this.size += this.growth * dt;
  }

  render(ctx) {
    if (!this.active) return;
    const progress = this.life / this.maxLife; // 1 -> 0
    ctx.save();

    if (this.type === 'ripple') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = Math.max(0, progress * 0.7);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = Math.max(0, progress * 0.9);
      ctx.fill();
    }

    ctx.restore();
  }
}

class ParticleSystem {
  constructor(maxParticles = 200) {
    this.pool = Array.from({ length: maxParticles }, () => new Particle());
  }

  getParticle() {
    let p = this.pool.find(item => !item.active);
    if (!p) {
      p = this.pool[0]; // Reuse oldest
    }
    return p;
  }

  // Puff of cue tip blue master chalk on strike
  createChalkPuff(x, y, angle, powerRatio = 0.5) {
    const count = Math.round(12 + powerRatio * 16);
    const colors = ['#38bdf8', '#60a5fa', '#93c5fd', '#bae6fd', '#e0f2fe'];

    for (let i = 0; i < count; i++) {
      const p = this.getParticle();
      const spread = (Math.random() - 0.5) * 1.2;
      const speed = (Math.random() * 2.2 + 0.6) * (0.8 + powerRatio * 0.8);
      const partAngle = angle + Math.PI + spread; // Puff backward from tip contact
      const vx = Math.cos(partAngle) * speed;
      const vy = Math.sin(partAngle) * speed;
      const size = Math.random() * 2.2 + 1.2;
      const life = Math.round(22 + Math.random() * 18);
      const color = colors[Math.floor(Math.random() * colors.length)];

      p.init(x, y, vx, vy, size, life, color, 'dust', 0.91, 0.04);
    }
  }

  // Micro-sparks & impact dust on hard ball-to-ball collisions
  createImpactDust(x, y, intensity = 1.0) {
    const count = Math.min(18, Math.round(5 + intensity * 8));
    const colors = ['#ffffff', '#f8fafc', '#e2e8f0', '#cbd5e1'];

    for (let i = 0; i < count; i++) {
      const p = this.getParticle();
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 2.5 + 0.8) * Math.min(2.0, intensity * 0.5);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = Math.random() * 1.8 + 0.8;
      const life = Math.round(12 + Math.random() * 14);
      const color = colors[Math.floor(Math.random() * colors.length)];

      p.init(x, y, vx, vy, size, life, color, 'dust', 0.88, 0);
    }
  }

  // Cushion impact dust
  createCushionImpact(x, y, normalX, normalY, intensity = 1.0) {
    const count = Math.min(12, Math.round(4 + intensity * 6));
    const baseAngle = Math.atan2(normalY, normalX);

    for (let i = 0; i < count; i++) {
      const p = this.getParticle();
      const angle = baseAngle + (Math.random() - 0.5) * 1.4;
      const speed = (Math.random() * 2.0 + 0.5) * Math.min(2.0, intensity * 0.4);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = Math.random() * 1.8 + 0.8;
      const life = Math.round(14 + Math.random() * 12);

      p.init(x, y, vx, vy, size, life, '#e2e8f0', 'dust', 0.89, 0);
    }
  }

  // Soft expanding ripple ring when a ball drops into a pocket
  createPocketRipple(x, y) {
    const p = this.getParticle();
    p.init(x, y, 0, 0, 10, 24, '#38bdf8', 'ripple', 1.0, 0.75);
  }

  // Golden celebratory sparks on game-winning shot
  createVictorySparks(x, y) {
    const colors = ['#fbbf24', '#f59e0b', '#fef08a', '#ffffff', '#38bdf8'];
    for (let i = 0; i < 35; i++) {
      const p = this.getParticle();
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5.0 + 1.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = Math.random() * 2.8 + 1.2;
      const life = Math.round(35 + Math.random() * 30);
      const color = colors[Math.floor(Math.random() * colors.length)];

      p.init(x, y, vx, vy, size, life, color, 'spark', 0.95, -0.02);
    }
  }

  update(dt = 1) {
    for (const p of this.pool) {
      if (p.active) {
        p.update(dt);
      }
    }
  }

  render(ctx) {
    for (const p of this.pool) {
      if (p.active) {
        p.render(ctx);
      }
    }
  }

  clear() {
    for (const p of this.pool) {
      p.active = false;
    }
  }
}
