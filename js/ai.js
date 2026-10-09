/**
 * AIOpponent - Smart AI Bot for Solo 8-Ball Matches
 * Features Novice, Club, and Pro difficulty tiers with geometric raycasting,
 * obstacle path-checking, cut-angle scoring, and smooth aiming animations.
 */
class AIOpponent {
  constructor(game) {
    this.game = game;
    this.difficulty = 'medium'; // 'easy' | 'medium' | 'hard'
    this.isThinking = false;
    this.animationTimer = null;
  }

  setDifficulty(level) {
    this.difficulty = level;
  }

  // Evaluate candidate pots and find the best geometric shot
  findBestShot() {
    const balls = this.game.balls;
    const cueBall = this.game.cueBall;
    const table = this.game.table;
    const rules = this.game.rules;

    // 1. Gather all legal target balls for Player 2 (Computer)
    const legalBalls = balls.filter(b => b.number !== 0 && !b.isPotted && rules.isLegalTarget(b, balls));

    if (legalBalls.length === 0) return null;

    const candidateShots = [];

    // 2. Evaluate each legal ball against all 6 pockets
    for (const targetBall of legalBalls) {
      for (const pocket of table.pockets) {
        const toPocket = Vector2D.sub(pocket.pos, targetBall.pos);
        const distToPocket = toPocket.mag();
        if (distToPocket < 10) continue;

        const pocketDir = Vector2D.mult(toPocket, 1 / distToPocket);

        // Required ghost ball position where cue ball must impact target ball
        const contactDist = cueBall.radius + targetBall.radius;
        const ghostPos = Vector2D.sub(targetBall.pos, Vector2D.mult(pocketDir, contactDist));

        // Check if ghost position is within table cushion bounds
        const b = table.bounds;
        if (
          ghostPos.x < b.left + cueBall.radius ||
          ghostPos.x > b.right - cueBall.radius ||
          ghostPos.y < b.top + cueBall.radius ||
          ghostPos.y > b.bottom - cueBall.radius
        ) {
          continue;
        }

        // Vector from cue ball to ghost position
        const cueToGhost = Vector2D.sub(ghostPos, cueBall.pos);
        const distCueToGhost = cueToGhost.mag();
        if (distCueToGhost < 1) continue;

        const cueDir = Vector2D.mult(cueToGhost, 1 / distCueToGhost);

        // Cut angle alignment: dot product between cue direction and pocket direction
        const cutDot = cueDir.dot(pocketDir);
        // Exclude extreme back-cuts (> 80 degrees)
        if (cutDot < 0.18) continue;

        // Obstacle line-of-sight checks:
        // A. Is path from target ball to pocket blocked by another active ball?
        if (this.isPathBlocked(targetBall.pos, pocket.pos, targetBall.radius, [targetBall.number, 0])) {
          continue;
        }

        // B. Is path from cue ball to ghost ball blocked by another active ball?
        if (this.isPathBlocked(cueBall.pos, ghostPos, cueBall.radius, [0, targetBall.number])) {
          continue;
        }

        // Calculate aim angle from cue ball to ghost ball
        const baseAngle = Math.atan2(cueToGhost.y, cueToGhost.x);

        // Calculate recommended power
        const totalDist = distCueToGhost + distToPocket;
        let recommendedPower = Math.min(95, Math.max(25, (totalDist / 1100) * 65 + (1 - cutDot) * 25));

        // Score this shot: prefer straight shots, short distances, and clean pockets
        let score = (cutDot * 350) - (distToPocket * 0.35) - (distCueToGhost * 0.25);
        if (targetBall.number === 8) score += 150; // High priority on winning 8-ball

        candidateShots.push({
          targetBall: targetBall,
          pocket: pocket,
          angle: baseAngle,
          power: Math.round(recommendedPower),
          score: score,
          cutDot: cutDot
        });
      }
    }

    // 3. Select shot based on difficulty
    if (candidateShots.length > 0) {
      candidateShots.sort((a, b) => b.score - a.score);

      let chosen = candidateShots[0];
      let angleNoise = 0;
      let powerNoise = 0;

      if (this.difficulty === 'easy') {
        // Novice: picks from top 3 with human-like aiming inaccuracy
        const pickIndex = Math.min(candidateShots.length - 1, Math.floor(Math.random() * 3));
        chosen = candidateShots[pickIndex];
        angleNoise = (Math.random() - 0.5) * 0.085; // +/- ~2.4 deg
        powerNoise = (Math.random() - 0.5) * 18;
      } else if (this.difficulty === 'medium') {
        // Club: picks 1st or 2nd best with slight angle noise
        const pickIndex = Math.random() < 0.75 ? 0 : Math.min(candidateShots.length - 1, 1);
        chosen = candidateShots[pickIndex];
        angleNoise = (Math.random() - 0.5) * 0.024; // +/- ~0.7 deg
        powerNoise = (Math.random() - 0.5) * 8;
      } else {
        // Pro / Shark: near-perfect aiming
        chosen = candidateShots[0];
        angleNoise = (Math.random() - 0.5) * 0.006;
        powerNoise = (Math.random() - 0.5) * 3;
      }

      return {
        angle: chosen.angle + angleNoise,
        power: Math.min(95, Math.max(22, Math.round(chosen.power + powerNoise))),
        spinX: 0,
        spinY: chosen.cutDot > 0.8 ? 0.3 : -0.2 // Follow on straight, draw on cut
      };
    }

    // 4. Safety Fallback: No clear pot found; aim directly at the closest legal ball
    let closestLegal = legalBalls[0];
    let minDist = Infinity;
    for (const b of legalBalls) {
      const d = cueBall.pos.distSq(b.pos);
      if (d < minDist) {
        minDist = d;
        closestLegal = b;
      }
    }

    const toBall = Vector2D.sub(closestLegal.pos, cueBall.pos);
    const safetyAngle = Math.atan2(toBall.y, toBall.x) + (Math.random() - 0.5) * 0.05;

    return {
      angle: safetyAngle,
      power: 38 + Math.round(Math.random() * 20),
      spinX: 0,
      spinY: 0
    };
  }

  // Check if a direct path between p1 and p2 is obstructed by any active balls
  isPathBlocked(p1, p2, ballRadius, ignoreNumbers = []) {
    const balls = this.game.balls;
    const seg = Vector2D.sub(p2, p1);
    const segLenSq = seg.magSq();
    if (segLenSq < 1) return false;

    const segLen = Math.sqrt(segLenSq);
    const segDir = Vector2D.mult(seg, 1 / segLen);

    for (const b of balls) {
      if (b.isPotted || ignoreNumbers.includes(b.number)) continue;

      const toBall = Vector2D.sub(b.pos, p1);
      const proj = toBall.dot(segDir);

      // Must be between start and end
      if (proj <= 0 || proj >= segLen) continue;

      const perpDistSq = toBall.magSq() - proj * proj;
      const combinedRadius = ballRadius + b.radius + 1.5;

      if (perpDistSq < combinedRadius * combinedRadius) {
        return true; // Collision detected
      }
    }
    return false;
  }

  // Automated Ball-in-Hand placement for AI
  computeBallInHandPlacement() {
    const balls = this.game.balls;
    const rules = this.game.rules;
    const table = this.game.table;
    const legalBalls = balls.filter(b => b.number !== 0 && !b.isPotted && rules.isLegalTarget(b, balls));

    if (legalBalls.length === 0) {
      return new Vector2D(table.centerSpot.x, table.centerSpot.y);
    }

    // Try positions that provide a straight line to the easiest legal ball & pocket
    const target = legalBalls[0];
    const pocket = table.pockets[0];
    const toPocket = Vector2D.sub(pocket.pos, target.pos).normalize();
    const candidateSpot = Vector2D.sub(target.pos, Vector2D.mult(toPocket, 100));

    // Ensure candidate spot is legal and inside boundaries
    const b = table.bounds;
    const r = this.game.cueBall.radius + 4;
    if (
      candidateSpot.x > b.left + r &&
      candidateSpot.x < b.right - r &&
      candidateSpot.y > b.top + r &&
      candidateSpot.y < b.bottom - r
    ) {
      let overlaps = false;
      for (const other of balls) {
        if (other.number === 0 || other.isPotted) continue;
        if (candidateSpot.distSq(other.pos) < (r + other.radius + 4) * (r + other.radius + 4)) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) return candidateSpot;
    }

    return this.game.findOpenSpot(table.headStringX, table.centerSpot.y);
  }

  // Trigger AI turn sequence with visual animation
  takeTurn() {
    if (this.isThinking || this.game.state === 'SIMULATING') return;
    this.isThinking = true;

    // 1. Handle Ball-in-Hand if awarded to AI
    if (this.game.state === 'BALL_IN_HAND') {
      setTimeout(() => {
        const spot = this.computeBallInHandPlacement();
        this.game.cueBall.pos.set(spot.x, spot.y);
        this.game.cueBall.isBeingPlaced = false;
        this.game.state = 'AIMING';
        this.game.rules.ballInHand = false;
        document.getElementById('ball-in-hand-overlay').classList.add('hidden');
        this.game.showToast('Computer placed cue ball');
        this.game.updateHUD();
        this.planAndShoot();
      }, 700);
      return;
    }

    this.planAndShoot();
  }

  planAndShoot() {
    const shot = this.findBestShot();
    if (!shot) {
      this.isThinking = false;
      return;
    }

    // Phase 1: Thinking delay (displays AI thought state)
    this.game.showToast(`🤖 Computer is planning shot (${this.difficulty.toUpperCase()})...`);

    setTimeout(() => {
      // Phase 2: Smoothly swivel aim angle to target angle
      const startAngle = this.game.aimAngle;
      let targetAngle = shot.angle;

      // Ensure shortest angular interpolation path
      while (targetAngle - startAngle > Math.PI) targetAngle -= Math.PI * 2;
      while (targetAngle - startAngle < -Math.PI) targetAngle += Math.PI * 2;

      const duration = 850; // ms
      const startTime = performance.now();

      const animateAim = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        // Smooth ease-out cubic
        const ease = 1 - Math.pow(1 - progress, 3);

        this.game.aimAngle = startAngle + (targetAngle - startAngle) * ease;

        if (progress < 1.0) {
          requestAnimationFrame(animateAim);
        } else {
          // Phase 3: Pull back cue stick
          this.game.state = 'PULLBACK';
          const pullbackStart = performance.now();
          const targetPower = shot.power;
          const pullDuration = 450;

          const animatePull = (t) => {
            const pullElapsed = t - pullbackStart;
            const pullProg = Math.min(1.0, pullElapsed / pullDuration);
            const pullEase = Math.sin((pullProg * Math.PI) / 2);

            this.game.cuePullDistance = pullEase * (targetPower / 100) * 120;
            this.game.power = Math.round(targetPower * pullEase);
            this.game.updatePowerUI();

            if (pullProg < 1.0) {
              requestAnimationFrame(animatePull);
            } else {
              // Phase 4: Execute Shot!
              this.game.cueSpinX = shot.spinX || 0;
              this.game.cueSpinY = shot.spinY || 0;
              this.game.executeShot(targetPower);
              this.isThinking = false;
            }
          };
          requestAnimationFrame(animatePull);
        }
      };

      requestAnimationFrame(animateAim);
    }, 600);
  }
}
