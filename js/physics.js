/**
 * PhysicsEngine - Continuous sub-stepped 2D physics simulation for pool.
 */
class PhysicsEngine {
  constructor(table) {
    this.table = table;
    this.subSteps = 8;

    // Realistic cloth physics profile (calibrated for authentic roll and rail-to-rail travel)
    this.friction = 0.991;          // Smooth glide per frame
    this.rollingDecel = 0.017;      // Constant rolling deceleration (allows clean rail-to-rail travel)
    this.restitutionCushion = 0.7;  // Lively responsive cushion rubber
    this.stopThreshold = 0.05;

    this.restitutionBall = 0.96;    // Ball-to-ball elasticity
    this.onBallBallCollision = null;
    this.onCushionCollision = null;
    this.onBallPotted = null;
  }

  // Direct manual adjustment method
  setFriction(frictionVal, decelVal) {
    if (frictionVal !== undefined) this.friction = frictionVal;
    if (decelVal !== undefined) this.rollingDecel = decelVal;
  }

  update(balls, dt = 1.0) {
    const subDt = dt / this.subSteps;

    for (let step = 0; step < this.subSteps; step++) {
      // 1. Move balls & apply realistic rolling friction
      for (const b of balls) {
        if (b.isPotted) {
          b.updatePocketAnimation(subDt);
          continue;
        }

        // When cue ball is in hand being positioned, do not simulate movement or physics
        if (b.isBeingPlaced) {
          b.vel.set(0, 0);
          continue;
        }

        if (b.isMoving()) {
          const dx = b.vel.x * subDt;
          const dy = b.vel.y * subDt;
          b.pos.x += dx;
          b.pos.y += dy;

          const speed = b.vel.mag();

          // 3D Sphere Roll: rotates the ball's 3D orientation frame
          const spinZ = (b.spin && Math.abs(b.spin.x) > 0.001) ? b.spin.x * 0.06 * subDt : 0;
          b.roll(dx, dy, spinZ);

          // Authentic Billiard Felt Friction:
          // Combines proportional cloth drag + constant rolling deceleration (Coulomb resistance)
          const drag = Math.pow(this.friction, subDt);
          const decel = this.rollingDecel * subDt;
          const newSpeed = Math.max(0, speed * drag - decel);

          if (newSpeed < this.stopThreshold) {
            b.vel.set(0, 0);
          } else {
            b.vel.mult(newSpeed / speed);
          }

          // English spin decay & translation effect
          if (b.spin && b.spin.magSq() > 0.0001) {
            b.vel.x += b.spin.x * 0.015 * subDt;
            b.vel.y += b.spin.y * 0.015 * subDt;
            b.spin.mult(0.985);
          }
        }
      }

      // 2. Ball-to-Ball Collisions
      for (let i = 0; i < balls.length; i++) {
        const b1 = balls[i];
        if (b1.isPotted || b1.isBeingPlaced) continue;

        for (let j = i + 1; j < balls.length; j++) {
          const b2 = balls[j];
          if (b2.isPotted || b2.isBeingPlaced) continue;

          this.resolveBallBallCollision(b1, b2);
        }
      }

      // 3. Pocket Funnel & Drop Check
      for (const b of balls) {
        if (b.isPotted || b.isBeingPlaced) continue;

        // Apply gentle slate pocket gravity funnel pull (balanced halfway)
        for (const pocket of this.table.pockets) {
          const toPocket = Vector2D.sub(pocket.pos, b.pos);
          const dist = toPocket.mag();
          const funnelRadius = pocket.radius * 1.28;
          if (dist < funnelRadius && dist > 1) {
            const pull = (1 - dist / funnelRadius) * 0.38 * subDt;
            b.vel.x += (toPocket.x / dist) * pull;
            b.vel.y += (toPocket.y / dist) * pull;
          }
        }

        const pocket = this.table.checkPocketDrop(b);
        if (pocket) {
          b.startPocketAnimation(pocket.pos, pocket.radius);
          Sound.playPocketDrop();
          if (this.onBallPotted) {
            this.onBallPotted(b, pocket);
          }
        }
      }

      // 4. Ball-to-Cushion Collisions
      for (const b of balls) {
        if (b.isPotted || b.isBeingPlaced) continue;
        this.resolveBallCushionCollisions(b);
      }
    }
  }

  resolveBallBallCollision(b1, b2) {
    if (b1.isBeingPlaced || b2.isBeingPlaced) return;
    const minDist = b1.radius + b2.radius;
    const dx = b2.pos.x - b1.pos.x;
    const dy = b2.pos.y - b1.pos.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < minDist * minDist && distSq > 0.000001) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;

      // Position separation to eliminate overlap
      const overlap = (minDist - dist) * 0.5;
      b1.pos.x -= nx * overlap;
      b1.pos.y -= ny * overlap;
      b2.pos.x += nx * overlap;
      b2.pos.y += ny * overlap;

      // Relative velocity along collision normal
      const rvx = b1.vel.x - b2.vel.x;
      const rvy = b1.vel.y - b2.vel.y;
      const velAlongNormal = rvx * nx + rvy * ny;

      // Only resolve if balls are moving toward each other
      if (velAlongNormal > 0) {
        const impulse = (1 + this.restitutionBall) * velAlongNormal * 0.5;
        b1.vel.x -= impulse * nx;
        b1.vel.y -= impulse * ny;
        b2.vel.x += impulse * nx;
        b2.vel.y += impulse * ny;

        // Apply backspin/draw or topspin/follow to cue ball
        if (b1.type === 'cue' && b1.spin.magSq() > 0.01) {
          // Negative y spin = draw/backspin (pulls cue ball back along collision line)
          b1.vel.x += nx * b1.spin.y * 3.5;
          b1.vel.y += ny * b1.spin.y * 3.5;
          b1.spin.mult(0.2); // Expended on contact
        } else if (b2.type === 'cue' && b2.spin.magSq() > 0.01) {
          b2.vel.x -= nx * b2.spin.y * 3.5;
          b2.vel.y -= ny * b2.spin.y * 3.5;
          b2.spin.mult(0.2);
        }

        // Acoustic feedback
        Sound.playBallHit(Math.abs(velAlongNormal));

        if (this.onBallBallCollision) {
          const midX = (b1.pos.x + b2.pos.x) * 0.5;
          const midY = (b1.pos.y + b2.pos.y) * 0.5;
          this.onBallBallCollision(b1, b2, midX, midY, Math.abs(velAlongNormal));
        }
      }
    }
  }

  resolveBallCushionCollisions(ball) {
    if (ball.isBeingPlaced || ball.isPotted) return;

    // Pocket throat grace (balanced halfway): if ball is entering a pocket mouth directly inward, skip sharp cushion corner vertex rejection
    for (const pocket of this.table.pockets) {
      const toPocket = Vector2D.sub(pocket.pos, ball.pos);
      const distSq = toPocket.magSq();
      const throatRadius = pocket.radius * 1.18;
      if (distSq < throatRadius * throatRadius) {
        // If ball is within throat and rolling directly inward toward pocket, skip cushion bounce
        if (toPocket.dot(ball.vel) > 0.05) {
          return;
        }
      }
    }

    for (const c of this.table.cushions) {
      // Find closest point on line segment p1 -> p2
      const segVx = c.p2.x - c.p1.x;
      const segVy = c.p2.y - c.p1.y;
      const segLenSq = segVx * segVx + segVy * segVy;
      if (segLenSq === 0) continue;

      const ptVx = ball.pos.x - c.p1.x;
      const ptVy = ball.pos.y - c.p1.y;

      let t = (ptVx * segVx + ptVy * segVy) / segLenSq;
      t = Math.max(0, Math.min(1, t));

      const closestX = c.p1.x + t * segVx;
      const closestY = c.p1.y + t * segVy;

      const diffX = ball.pos.x - closestX;
      const diffY = ball.pos.y - closestY;
      const distSq = diffX * diffX + diffY * diffY;

      if (distSq < ball.radius * ball.radius && distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const nx = diffX / dist;
        const ny = diffY / dist;

        // Positional correction
        const overlap = ball.radius - dist;
        ball.pos.x += nx * overlap;
        ball.pos.y += ny * overlap;

        // Velocity reflection
        const vn = ball.vel.x * nx + ball.vel.y * ny;
        if (vn < 0) {
          // Reflect velocity vector
          ball.vel.x -= (1 + this.restitutionCushion) * vn * nx;
          ball.vel.y -= (1 + this.restitutionCushion) * vn * ny;

          // Cushion friction/tangent dampening (smooth angled bank rebounds)
          const tangentX = -ny;
          const tangentY = nx;
          const vt = ball.vel.x * tangentX + ball.vel.y * tangentY;
          ball.vel.x -= vt * 0.05 * tangentX;
          ball.vel.y -= vt * 0.05 * tangentY;

          // Sidespin (English) bounce deflection
          if (ball.type === 'cue' && Math.abs(ball.spin.x) > 0.05) {
            ball.vel.x += tangentX * ball.spin.x * 2.5;
            ball.vel.y += tangentY * ball.spin.x * 2.5;
            ball.spin.x *= 0.5; // Dampen sidespin on cushion
          }

          Sound.playCushionHit(ball.vel.mag());

          if (this.onCushionCollision) {
            this.onCushionCollision(ball, c, closestX, closestY, nx, ny, Math.abs(vn));
          }
        }
      }
    }
  }

  // Check if any ball on the table is still moving
  areBallsMoving(balls) {
    for (const b of balls) {
      if (b.isBeingPlaced) continue;
      if (!b.isPotted && b.isMoving()) {
        return true;
      }
      if (b.pocketAnim && b.pocketAnim.progress < 1) {
        return true;
      }
    }
    return false;
  }
}
