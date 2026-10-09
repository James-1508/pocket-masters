/**
 * Pocket Masters - Main Game Controller
 * Manages game loop, user interactions, aim guide projection, cue rendering, and UI.
 */
class Game {
  constructor() {
    this.canvas = document.getElementById('poolCanvas');
    this.ctx = this.canvas.getContext('2d');

    // High DPI scaling support
    this.dpr = window.devicePixelRatio || 1;

    // Core instances
    this.table = new Table(920, 460);
    this.physics = new PhysicsEngine(this.table);
    this.rules = new RulesEngine();

    // Game state
    this.state = 'AIMING'; // 'AIMING', 'PULLBACK', 'STRIKING', 'SIMULATING', 'BALL_IN_HAND', 'GAME_OVER'
    this.aimAngle = 0; // Radians
    this.showAimLine = true; // Toggleable aiming line feature
    this.power = 45; // 0 - 100
    this.isDraggingCue = false;
    this.dragStartPos = new Vector2D(0, 0);
    this.dragPower = 0;
    this.cuePullDistance = 0; // Pixels pulled back visually

    // Spin / English offset (-1.0 to +1.0)
    this.cueSpinX = 0;
    this.cueSpinY = 0;

    // Mouse coordinates in canvas space
    this.mouse = new Vector2D(0, 0);

    // Ball-in-hand placement state
    this.isValidPlacement = true;

    // Ball collection
    this.balls = [];
    this.cueBall = null;

    // Initialize systems
    this.setupCanvas();
    this.initBalls();
    this.bindEvents();
    this.bindUI();
    this.setupPhysicsCallbacks();
    this.updateHUD();

    // Start render & physics loop
    this.isRunning = true;
    this.animFrameId = null;
    this.lastTime = performance.now();
    this.animFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  setupCanvas() {
    // Sizing canvas to match table dimensions
    const width = this.table.width;
    const height = this.table.height;

    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.maxWidth = '100%';
    this.canvas.style.maxHeight = '100%';
    this.canvas.style.width = '100%';
    this.canvas.style.height = 'auto';
    this.canvas.style.aspectRatio = `${width} / ${height}`;

    this.ctx.scale(this.dpr, this.dpr);
    this.checkOrientationHint();
  }

  checkOrientationHint() {
    const hint = document.getElementById('rotate-hint');
    if (!hint) return;
    const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 850;
    if (isPortrait) {
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  }

  setupPhysicsCallbacks() {
    this.physics.onBallBallCollision = (b1, b2) => {
      this.rules.recordBallCollision(b1, b2);
    };

    this.physics.onCushionCollision = (ball, cushion) => {
      this.rules.recordCushionCollision(ball);
    };

    this.physics.onBallPotted = (ball, pocket) => {
      this.rules.recordBallPotted(ball);
      this.updateHUD();
    };
  }

  initBalls() {
    this.balls = [];
    const r = 13.5;

    // 1. Cue Ball placed behind the head string
    this.cueBall = new Ball(0, this.table.headStringX, this.table.bounds.top + this.table.playHeight / 2, r);
    this.balls.push(this.cueBall);

    // 2. Standard 15-ball triangular rack
    // Ball sequence ensuring alternating suits & 8-ball in center
    // Row 1 (apex): 1 (Solid)
    // Row 2: 9 (Stripe), 2 (Solid)
    // Row 3: 10 (Stripe), 8 (Eight), 3 (Solid)
    // Row 4: 4 (Solid), 11 (Stripe), 12 (Stripe), 5 (Solid)
    // Row 5: 13 (Stripe), 6 (Solid), 14 (Stripe), 7 (Solid), 15 (Stripe)
    const rackOrder = [
      1,
      9, 2,
      10, 8, 3,
      4, 11, 12, 5,
      13, 6, 14, 7, 15
    ];

    const apexX = this.table.footSpot.x;
    const apexY = this.table.footSpot.y;
    const colSpacing = r * Math.sqrt(3) + 0.4;
    const rowSpacing = r * 2 + 0.4;

    let index = 0;
    for (let row = 0; row < 5; row++) {
      const colX = apexX + row * colSpacing;
      const startY = apexY - (row * rowSpacing) / 2;

      for (let col = 0; col <= row; col++) {
        const ballNum = rackOrder[index++];
        const bY = startY + col * rowSpacing;
        const ball = new Ball(ballNum, colX, bY, r);
        this.balls.push(ball);
      }
    }

    // Default aim angle toward the rack
    this.aimAngle = Math.atan2(apexY - this.cueBall.pos.y, apexX - this.cueBall.pos.x);
  }

  rerack() {
    this.rules.reset();
    this.initBalls();
    this.state = 'AIMING';
    document.getElementById('ball-in-hand-overlay').classList.add('hidden');
    const gameOverModal = document.getElementById('game-over-modal');
    if (gameOverModal) {
      gameOverModal.classList.add('hidden');
    }
    this.updateHUD();
    this.showToast('Balls Re-racked & Ready!');

    // Ensure loop is actively running and render immediately
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      this.animFrameId = requestAnimationFrame(this.loop.bind(this));
    }
    this.render();
  }

  // =========================================================================
  // Input & Event Binding
  // =========================================================================
  bindEvents() {
    const getCanvasPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.table.width / (rect.width || this.table.width);
      const scaleY = this.table.height / (rect.height || this.table.height);
      const touch = (e.touches && e.touches.length > 0)
        ? e.touches[0]
        : ((e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : e);
      return new Vector2D(
        (touch.clientX - rect.left) * scaleX,
        (touch.clientY - rect.top) * scaleY
      );
    };

    // --- Mouse Events ---
    this.canvas.addEventListener('mousemove', (e) => {
      this.mouse = getCanvasPos(e);

      if (this.state === 'BALL_IN_HAND') {
        this.cueBall.pos.x = this.mouse.x;
        this.cueBall.pos.y = this.mouse.y;
        this.cueBall.vel.set(0, 0);
        this.cueBall.isBeingPlaced = true;
        this.validateBallPlacement();
      } else if (this.state === 'AIMING') {
        if (!this.isDraggingCue && this.cueBall && !this.cueBall.isPotted) {
          const dx = this.mouse.x - this.cueBall.pos.x;
          const dy = this.mouse.y - this.cueBall.pos.y;
          if (dx * dx + dy * dy > 25) {
            this.aimAngle = Math.atan2(dy, dx);
          }
        }
      } else if (this.state === 'PULLBACK' && this.isDraggingCue) {
        const aimDir = new Vector2D(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
        const mouseOffset = Vector2D.sub(this.dragStartPos, this.mouse);
        const pullDist = mouseOffset.dot(aimDir);

        this.cuePullDistance = Math.max(0, Math.min(130, pullDist));
        this.power = Math.round((this.cuePullDistance / 130) * 95 + 5);
        this.updatePowerUI();
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      Sound.init();

      if (this.state === 'BALL_IN_HAND') {
        if (this.isValidPlacement) {
          this.cueBall.isBeingPlaced = false;
          this.cueBall.vel.set(0, 0);
          this.state = 'AIMING';
          this.rules.ballInHand = false;
          document.getElementById('ball-in-hand-overlay').classList.add('hidden');
          this.showToast('Cue ball placed!');
          this.updateHUD();
        }
        return;
      }

      if (this.state === 'AIMING' && this.cueBall && !this.cueBall.isPotted) {
        this.isDraggingCue = true;
        this.dragStartPos = getCanvasPos(e);
        this.state = 'PULLBACK';
        this.cuePullDistance = 0;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.state === 'PULLBACK') {
        this.isDraggingCue = false;
        if (this.cuePullDistance > 8) {
          this.executeShot(this.power);
        } else {
          this.state = 'AIMING';
          this.cuePullDistance = 0;
        }
      }
    });

    // --- Touch Events (Mobile & Tablet Support) ---
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      Sound.init();

      const touchPos = getCanvasPos(e);
      this.mouse = touchPos;

      if (this.state === 'BALL_IN_HAND') {
        this.cueBall.pos.x = touchPos.x;
        this.cueBall.pos.y = touchPos.y;
        this.cueBall.vel.set(0, 0);
        this.cueBall.isBeingPlaced = true;
        this.validateBallPlacement();
        return;
      }

      if (this.state === 'AIMING' && this.cueBall && !this.cueBall.isPotted) {
        const aimDir = new Vector2D(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
        const toTouch = Vector2D.sub(touchPos, this.cueBall.pos);
        const distAlongAim = toTouch.dot(aimDir);
        const distPerp = Math.abs(toTouch.x * aimDir.y - toTouch.y * aimDir.x);

        // If touching behind the cue ball along the cue stick axis, initiate pullback
        if (distAlongAim < -15 && distAlongAim > -320 && distPerp < 70) {
          this.isDraggingCue = true;
          this.dragStartPos = touchPos;
          this.state = 'PULLBACK';
          this.cuePullDistance = 0;
        } else {
          // Touching on table felt: rotate aim line directly towards finger
          const dx = touchPos.x - this.cueBall.pos.x;
          const dy = touchPos.y - this.cueBall.pos.y;
          if (dx * dx + dy * dy > 25) {
            this.aimAngle = Math.atan2(dy, dx);
          }
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touchPos = getCanvasPos(e);
      this.mouse = touchPos;

      if (this.state === 'BALL_IN_HAND') {
        this.cueBall.pos.x = touchPos.x;
        this.cueBall.pos.y = touchPos.y;
        this.cueBall.vel.set(0, 0);
        this.cueBall.isBeingPlaced = true;
        this.validateBallPlacement();
      } else if (this.state === 'AIMING') {
        if (!this.isDraggingCue && this.cueBall && !this.cueBall.isPotted) {
          const dx = touchPos.x - this.cueBall.pos.x;
          const dy = touchPos.y - this.cueBall.pos.y;
          if (dx * dx + dy * dy > 25) {
            this.aimAngle = Math.atan2(dy, dx);
          }
        }
      } else if (this.state === 'PULLBACK' && this.isDraggingCue) {
        const aimDir = new Vector2D(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
        const mouseOffset = Vector2D.sub(this.dragStartPos, touchPos);
        const pullDist = mouseOffset.dot(aimDir);

        this.cuePullDistance = Math.max(0, Math.min(130, pullDist));
        this.power = Math.round((this.cuePullDistance / 130) * 95 + 5);
        this.updatePowerUI();
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      if (this.state === 'BALL_IN_HAND') {
        if (this.isValidPlacement) {
          this.cueBall.isBeingPlaced = false;
          this.cueBall.vel.set(0, 0);
          this.state = 'AIMING';
          this.rules.ballInHand = false;
          document.getElementById('ball-in-hand-overlay').classList.add('hidden');
          this.showToast('Cue ball placed!');
          this.updateHUD();
        }
        return;
      }

      if (this.state === 'PULLBACK') {
        this.isDraggingCue = false;
        if (this.cuePullDistance > 8) {
          this.executeShot(this.power);
        } else {
          this.state = 'AIMING';
          this.cuePullDistance = 0;
        }
      }
    });

    window.addEventListener('touchcancel', () => {
      if (this.state === 'PULLBACK') {
        this.isDraggingCue = false;
        this.state = 'AIMING';
        this.cuePullDistance = 0;
      }
    });

    // Window resize & orientation change
    window.addEventListener('resize', () => {
      this.checkOrientationHint();
    });

    // Tap rotate hint to dismiss
    const rotateHint = document.getElementById('rotate-hint');
    if (rotateHint) {
      rotateHint.addEventListener('click', () => rotateHint.classList.add('hidden'));
    }

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      Sound.init();

      // Aim Line Toggle shortcut: [A] or [L]
      if (e.key === 'a' || e.key === 'A' || e.key === 'l' || e.key === 'L') {
        this.toggleAimLine();
      }
      // Strike shortcut: Spacebar
      else if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'AIMING' && this.cueBall && !this.cueBall.isPotted) {
          this.executeShot(this.power);
        }
      }
      // Fine-tune aiming: Left/Right arrows
      else if (e.key === 'ArrowLeft') {
        this.aimAngle -= 0.015;
      } else if (e.key === 'ArrowRight') {
        this.aimAngle += 0.015;
      }
      // Rerack: [R]
      else if (e.key === 'r' || e.key === 'R') {
        this.rerack();
      }
    });
  }

  bindUI() {
    // Aim Line Toggle Button
    const btnToggleAim = document.getElementById('btn-toggle-aim');
    btnToggleAim.addEventListener('click', () => {
      this.toggleAimLine();
    });

    // Aim Nudge buttons (Mobile friendly fine-tuning)
    const btnAimLeft = document.getElementById('btn-aim-left');
    const btnAimRight = document.getElementById('btn-aim-right');
    if (btnAimLeft) {
      btnAimLeft.addEventListener('click', () => {
        this.aimAngle -= 0.012;
      });
    }
    if (btnAimRight) {
      btnAimRight.addEventListener('click', () => {
        this.aimAngle += 0.012;
      });
    }

    // Power slider
    const powerSlider = document.getElementById('power-slider');
    powerSlider.addEventListener('input', (e) => {
      this.power = parseInt(e.target.value, 10);
      this.updatePowerUI();
    });

    // Shoot button
    const btnShoot = document.getElementById('btn-shoot');
    btnShoot.addEventListener('click', () => {
      if (this.state === 'AIMING' && this.cueBall && !this.cueBall.isPotted) {
        this.executeShot(this.power);
      }
    });

    // Mode segmented buttons
    const btn2P = document.getElementById('mode-2p');
    const btnPractice = document.getElementById('mode-practice');

    btn2P.addEventListener('click', () => {
      if (this.rules.mode !== '2player') {
        btn2P.classList.add('active');
        btnPractice.classList.remove('active');
        this.rules.setMode('2player');
        this.rerack();
      }
    });

    btnPractice.addEventListener('click', () => {
      if (this.rules.mode !== 'practice') {
        btnPractice.classList.add('active');
        btn2P.classList.remove('active');
        this.rules.setMode('practice');
        this.rerack();
      }
    });

    // Felt dropdown
    const feltSelect = document.getElementById('felt-select');
    feltSelect.addEventListener('change', (e) => {
      this.table.setTheme(e.target.value);
    });

    // Cloth Speed / Friction dropdown
    const clothSelect = document.getElementById('cloth-speed-select');
    if (clothSelect) {
      clothSelect.addEventListener('change', (e) => {
        this.physics.setClothProfile(e.target.value);
        const preset = PhysicsEngine.CLOTH_PRESETS[e.target.value];
        this.showToast(`Cloth Friction: ${preset ? preset.name : e.target.value}`);
      });
    }

    // Rerack button
    const btnRerack = document.getElementById('btn-rerack');
    btnRerack.addEventListener('click', () => {
      this.rerack();
    });

    // Place Cue Ball button
    const btnPlaceCue = document.getElementById('btn-place-cue');
    btnPlaceCue.addEventListener('click', () => {
      this.enterBallInHandMode();
    });

    // Spin / English widget interaction
    const spinWidget = document.getElementById('spin-widget');
    const spinMarker = document.getElementById('spin-marker');
    const btnResetSpin = document.getElementById('btn-reset-spin');

    const handleSpinSet = (e) => {
      const rect = spinWidget.querySelector('.spin-ball').getBoundingClientRect();
      const clickX = e.clientX - rect.left - rect.width / 2;
      const clickY = e.clientY - rect.top - rect.height / 2;
      const maxR = rect.width / 2 - 4;

      const dist = Math.sqrt(clickX * clickX + clickY * clickY);
      let nx = clickX;
      let ny = clickY;

      if (dist > maxR) {
        nx = (clickX / dist) * maxR;
        ny = (clickY / dist) * maxR;
      }

      this.cueSpinX = nx / maxR;
      this.cueSpinY = -ny / maxR; // Invert Y so up is topspin

      spinMarker.style.left = `${50 + (this.cueSpinX * 42)}%`;
      spinMarker.style.top = `${50 - (this.cueSpinY * 42)}%`;
    };

    const spinBallEl = spinWidget.querySelector('.spin-ball');
    spinBallEl.addEventListener('click', handleSpinSet);

    const handleSpinTouch = (e) => {
      e.preventDefault();
      if (e.touches && e.touches.length > 0) {
        handleSpinSet(e.touches[0]);
      }
    };
    spinBallEl.addEventListener('touchstart', handleSpinTouch, { passive: false });
    spinBallEl.addEventListener('touchmove', handleSpinTouch, { passive: false });

    btnResetSpin.addEventListener('click', () => {
      this.cueSpinX = 0;
      this.cueSpinY = 0;
      spinMarker.style.left = '50%';
      spinMarker.style.top = '50%';
    });

    // Sound toggle
    const btnSound = document.getElementById('btn-sound');
    const soundOnIcon = document.getElementById('sound-icon-on');
    const soundOffIcon = document.getElementById('sound-icon-off');

    btnSound.addEventListener('click', () => {
      const isMuted = Sound.toggleMute();
      if (isMuted) {
        soundOnIcon.classList.add('hidden');
        soundOffIcon.classList.remove('hidden');
      } else {
        soundOnIcon.classList.remove('hidden');
        soundOffIcon.classList.add('hidden');
      }
    });

    // Rules & Help Modal
    const btnRules = document.getElementById('btn-rules');
    const rulesModal = document.getElementById('rules-modal');
    const btnCloseRules = document.getElementById('btn-close-rules');
    const btnOkRules = document.getElementById('btn-ok-rules');

    btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
    btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));
    btnOkRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

    // Game Over Rematch
    const gameOverModal = document.getElementById('game-over-modal');
    const btnRematch = document.getElementById('btn-rematch');
    const btnSwitchPractice = document.getElementById('btn-switch-practice');

    btnRematch.addEventListener('click', () => {
      gameOverModal.classList.add('hidden');
      this.rerack();
    });

    btnSwitchPractice.addEventListener('click', () => {
      gameOverModal.classList.add('hidden');
      btnPractice.click();
    });
  }

  toggleAimLine() {
    this.showAimLine = !this.showAimLine;
    const btn = document.getElementById('btn-toggle-aim');
    if (this.showAimLine) {
      btn.classList.add('active');
      btn.innerHTML = `<span class="toggle-icon">🎯</span><span class="toggle-text">Aim Line: <strong>ON</strong></span><span class="key-hint">[A]</span>`;
      this.showToast('Aiming Guide Enabled');
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<span class="toggle-icon">🎯</span><span class="toggle-text">Aim Line: <strong>OFF</strong></span><span class="key-hint">[A]</span>`;
      this.showToast('Aiming Guide Disabled');
    }
  }

  updatePowerUI() {
    const slider = document.getElementById('power-slider');
    const fill = document.getElementById('power-bar-fill');
    const label = document.getElementById('power-label');

    slider.value = this.power;
    fill.style.width = `${this.power}%`;
    label.textContent = `${this.power}%`;
  }

  enterBallInHandMode() {
    this.state = 'BALL_IN_HAND';
    const spot = this.findOpenSpot(this.table.centerSpot.x, this.table.centerSpot.y);
    this.cueBall.reset(spot.x, spot.y);
    this.cueBall.isBeingPlaced = true;
    this.cueBall.vel.set(0, 0);
    this.cueBall.spin.set(0, 0);
    document.getElementById('ball-in-hand-overlay').classList.remove('hidden');
    this.validateBallPlacement();
  }

  findOpenSpot(preferredX, preferredY) {
    const r = this.cueBall.radius;
    const testPositions = [
      new Vector2D(preferredX, preferredY),
      new Vector2D(this.table.headStringX, this.table.bounds.top + this.table.playHeight / 2),
      new Vector2D(this.table.footSpot.x - 120, this.table.bounds.top + this.table.playHeight / 2),
      new Vector2D(this.table.bounds.left + 160, this.table.bounds.top + this.table.playHeight / 2)
    ];
    for (const pos of testPositions) {
      let collides = false;
      for (const other of this.balls) {
        if (other.number === 0 || other.isPotted) continue;
        if (pos.distSq(other.pos) < (r + other.radius + 4) * (r + other.radius + 4)) {
          collides = true;
          break;
        }
      }
      if (!collides) return pos;
    }
    return new Vector2D(preferredX, preferredY);
  }

  validateBallPlacement() {
    const b = this.cueBall;
    const bounds = this.table.bounds;
    const padding = b.radius + 2;

    let valid = true;

    // Check table cushion boundaries
    if (
      b.pos.x < bounds.left + padding ||
      b.pos.x > bounds.right - padding ||
      b.pos.y < bounds.top + padding ||
      b.pos.y > bounds.bottom - padding
    ) {
      valid = false;
    }

    // Check overlap with any other active ball
    for (const other of this.balls) {
      if (other.number === 0 || other.isPotted) continue;
      const minDist = b.radius + other.radius + 1;
      if (b.pos.distSq(other.pos) < minDist * minDist) {
        valid = false;
        break;
      }
    }

    this.isValidPlacement = valid;
    return valid;
  }

  // =========================================================================
  // Shooting & Turn Execution
  // =========================================================================
  executeShot(powerPercent) {
    if ((this.state !== 'AIMING' && this.state !== 'PULLBACK') || this.cueBall.isPotted) return;

    this.state = 'STRIKING';
    const normalizedPower = powerPercent / 100;
    const shotSpeed = 3.0 + normalizedPower * 34.0;

    // Strike sound
    Sound.playCueHit(normalizedPower);

    // Apply impulse to cue ball
    this.cueBall.vel.x = Math.cos(this.aimAngle) * shotSpeed;
    this.cueBall.vel.y = Math.sin(this.aimAngle) * shotSpeed;

    // Apply cue ball spin (English)
    this.cueBall.spin.x = this.cueSpinX * normalizedPower * 3.0;
    this.cueBall.spin.y = this.cueSpinY * normalizedPower * 3.0;

    this.rules.startShot();
    this.state = 'SIMULATING';
    this.cuePullDistance = 0;
  }

  handleShotCompletion() {
    const result = this.rules.evaluateShot(this.balls, this.cueBall);

    if (result.gameOver) {
      this.state = 'GAME_OVER';
      this.showGameOverModal(result);
      Sound.playWin();
      return;
    }

    if (result.ballInHand || this.cueBall.isPotted) {
      if (result.foul) {
        Sound.playFoul();
      }
      this.enterBallInHandMode();
    } else {
      this.state = 'AIMING';
    }

    if (result.message) {
      this.showToast(result.message);
    }

    this.updateHUD();
  }

  // =========================================================================
  // Raycast Aiming Line & Trajectory Visualizer (Key Feature)
  // =========================================================================
  calculateAimTrajectory() {
    if (!this.cueBall || this.cueBall.isPotted || this.state === 'BALL_IN_HAND') {
      return null;
    }

    const cuePos = this.cueBall.pos;
    const aimDir = new Vector2D(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
    const r = this.cueBall.radius;

    let closestHit = null;
    let minT = 1500; // Max raycast length

    // 1. Raycast vs Active Balls
    for (const b of this.balls) {
      if (b.number === 0 || b.isPotted) continue;

      // Vector from cue ball to target ball
      const toBall = Vector2D.sub(b.pos, cuePos);
      const proj = toBall.dot(aimDir);

      if (proj <= 0) continue; // Behind ray

      const distSq = toBall.magSq() - proj * proj;
      const combinedRadius = r * 2;

      if (distSq < combinedRadius * combinedRadius) {
        // Hit detected: calculate collision distance t
        const t = proj - Math.sqrt(combinedRadius * combinedRadius - distSq);
        if (t > 0 && t < minT) {
          minT = t;
          const ghostPos = Vector2D.add(cuePos, Vector2D.mult(aimDir, t));

          // Normal vector from ghost ball center to target ball center
          const normal = Vector2D.sub(b.pos, ghostPos).normalize();

          // Deflection tangent for cue ball
          const dot = aimDir.dot(normal);
          const cueDeflect = Vector2D.sub(aimDir, Vector2D.mult(normal, dot)).normalize();

          closestHit = {
            type: 'ball',
            ball: b,
            distance: t,
            ghostPos: ghostPos,
            targetNormal: normal,
            cueDeflect: cueDeflect
          };
        }
      }
    }

    // 2. Raycast vs Cushions (if no ball was hit or cushion is closer)
    const bounds = this.table.bounds;
    let cushionT = Infinity;
    let cushionHitPos = null;
    let cushionNormal = null;

    // Check right / left rails
    if (aimDir.x > 0.0001) {
      const tx = (bounds.right - r - cuePos.x) / aimDir.x;
      if (tx > 0 && tx < cushionT) {
        cushionT = tx;
        cushionHitPos = new Vector2D(bounds.right - r, cuePos.y + aimDir.y * tx);
        cushionNormal = new Vector2D(-1, 0);
      }
    } else if (aimDir.x < -0.0001) {
      const tx = (bounds.left + r - cuePos.x) / aimDir.x;
      if (tx > 0 && tx < cushionT) {
        cushionT = tx;
        cushionHitPos = new Vector2D(bounds.left + r, cuePos.y + aimDir.y * tx);
        cushionNormal = new Vector2D(1, 0);
      }
    }

    // Check top / bottom rails
    if (aimDir.y > 0.0001) {
      const ty = (bounds.bottom - r - cuePos.y) / aimDir.y;
      if (ty > 0 && ty < cushionT) {
        cushionT = ty;
        cushionHitPos = new Vector2D(cuePos.x + aimDir.x * ty, bounds.bottom - r);
        cushionNormal = new Vector2D(0, -1);
      }
    } else if (aimDir.y < -0.0001) {
      const ty = (bounds.top + r - cuePos.y) / aimDir.y;
      if (ty > 0 && ty < cushionT) {
        cushionT = ty;
        cushionHitPos = new Vector2D(cuePos.x + aimDir.x * ty, bounds.top + r);
        cushionNormal = new Vector2D(0, 1);
      }
    }

    if (cushionNormal && (!closestHit || cushionT < closestHit.distance)) {
      // Ray hits cushion first
      const normalDot = aimDir.dot(cushionNormal);
      const reflectDir = Vector2D.sub(aimDir, Vector2D.mult(cushionNormal, 2 * normalDot)).normalize();
      return {
        type: 'cushion',
        hitPos: cushionHitPos,
        reflectDir: reflectDir,
        distance: cushionT
      };
    }

    return closestHit;
  }

  // =========================================================================
  // Rendering Pipeline
  // =========================================================================
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.table.width, this.table.height);

    // 1. Render Table (Felt, rails, pockets, diamonds)
    this.table.render(ctx);

    // 2. Render Aiming Projection Line (if enabled & state is aiming/pullback)
    if ((this.state === 'AIMING' || this.state === 'PULLBACK') && this.showAimLine && !this.cueBall.isPotted) {
      this.renderAimGuide(ctx);
    }

    // 3. Render Balls
    for (const b of this.balls) {
      b.render(ctx);
    }

    // 4. Render Ball-in-Hand ghost indicator
    if (this.state === 'BALL_IN_HAND') {
      this.renderBallInHandGhost(ctx);
    }

    // 5. Render Cue Stick
    if (!this.cueBall.isPotted && (this.state === 'AIMING' || this.state === 'PULLBACK' || this.state === 'STRIKING')) {
      this.renderCueStick(ctx);
    }
  }

  renderAimGuide(ctx) {
    if (!this.cueBall || this.cueBall.isPotted) return;
    const trajectory = this.calculateAimTrajectory();
    if (!trajectory) return;

    ctx.save();
    const cuePos = this.cueBall.pos;
    const r = this.cueBall.radius;

    if (trajectory.type === 'ball') {
      const gPos = trajectory.ghostPos;
      const tBall = trajectory.ball;
      const tNormal = trajectory.targetNormal;
      const cueDeflect = trajectory.cueDeflect;

      // Check whether target ball is legal for the active player
      const isLegal = this.rules.isLegalTarget(tBall, this.balls);
      const illegalReason = !isLegal ? this.rules.getIllegalTargetReason(tBall, this.balls) : '';

      if (isLegal) {
        // =====================================================================
        // LEGAL TARGET: Vibrant White / Cyan Aim Trajectory
        // =====================================================================

        // 1. Line from cue ball to ghost ball
        ctx.beginPath();
        ctx.moveTo(cuePos.x, cuePos.y);
        ctx.lineTo(gPos.x, gPos.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. Ghost Ball Circle (Where cue ball will make contact)
        ctx.beginPath();
        ctx.arc(gPos.x, gPos.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fill();
        ctx.stroke();

        // Ghost ball center point
        ctx.beginPath();
        ctx.arc(gPos.x, gPos.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // 3. Target Ball Projected Trajectory Line (Shortened clean guide)
        const bounds = this.table.bounds;
        let targetDistToCushion = 140;
        if (tNormal.x > 0.001) targetDistToCushion = Math.min(targetDistToCushion, (bounds.right - r - tBall.pos.x) / tNormal.x);
        else if (tNormal.x < -0.001) targetDistToCushion = Math.min(targetDistToCushion, (bounds.left + r - tBall.pos.x) / tNormal.x);
        if (tNormal.y > 0.001) targetDistToCushion = Math.min(targetDistToCushion, (bounds.bottom - r - tBall.pos.y) / tNormal.y);
        else if (tNormal.y < -0.001) targetDistToCushion = Math.min(targetDistToCushion, (bounds.top + r - tBall.pos.y) / tNormal.y);
        const targetLineLen = Math.max(45, Math.min(135, targetDistToCushion));
        const targetEnd = Vector2D.add(tBall.pos, Vector2D.mult(tNormal, targetLineLen));

        const gradTarget = ctx.createLinearGradient(tBall.pos.x, tBall.pos.y, targetEnd.x, targetEnd.y);
        gradTarget.addColorStop(0, '#38bdf8');
        gradTarget.addColorStop(0.7, 'rgba(56, 189, 248, 0.6)');
        gradTarget.addColorStop(1, 'rgba(56, 189, 248, 0)');

        ctx.beginPath();
        ctx.moveTo(tBall.pos.x, tBall.pos.y);
        ctx.lineTo(targetEnd.x, targetEnd.y);
        ctx.strokeStyle = gradTarget;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Directional arrow head on target trajectory
        const arrowPoint = Vector2D.add(tBall.pos, Vector2D.mult(tNormal, 42));
        const arrowPerp = tNormal.perp();
        ctx.beginPath();
        ctx.moveTo(arrowPoint.x + tNormal.x * 9, arrowPoint.y + tNormal.y * 9);
        ctx.lineTo(arrowPoint.x - arrowPerp.x * 5, arrowPoint.y - arrowPerp.y * 5);
        ctx.lineTo(arrowPoint.x + arrowPerp.x * 5, arrowPoint.y + arrowPerp.y * 5);
        ctx.closePath();
        ctx.fillStyle = '#38bdf8';
        ctx.fill();

        // 4. Cue Ball Deflection / Tangent Line (Shortened)
        if (cueDeflect.magSq() > 0.001) {
          const cueEnd = Vector2D.add(gPos, Vector2D.mult(cueDeflect, 55));
          ctx.beginPath();
          ctx.moveTo(gPos.x, gPos.y);
          ctx.lineTo(cueEnd.x, cueEnd.y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        // =====================================================================
        // ILLEGAL / OPPONENT TARGET: Grayed Out Line + Prohibition Circle
        // =====================================================================

        // 1. Grayed out line from cue ball to ghost ball
        ctx.beginPath();
        ctx.moveTo(cuePos.x, cuePos.y);
        ctx.lineTo(gPos.x, gPos.y);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)'; // Muted gray
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. Grayed out Ghost Ball Circle
        ctx.beginPath();
        ctx.arc(gPos.x, gPos.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fill();
        ctx.stroke();

        // 3. Grayed out target ball trajectory line (Shortened)
        const bounds = this.table.bounds;
        let targetDistToCushion = 100;
        if (tNormal.x > 0.001) targetDistToCushion = Math.min(targetDistToCushion, (bounds.right - r - tBall.pos.x) / tNormal.x);
        else if (tNormal.x < -0.001) targetDistToCushion = Math.min(targetDistToCushion, (bounds.left + r - tBall.pos.x) / tNormal.x);
        if (tNormal.y > 0.001) targetDistToCushion = Math.min(targetDistToCushion, (bounds.bottom - r - tBall.pos.y) / tNormal.y);
        else if (tNormal.y < -0.001) targetDistToCushion = Math.min(targetDistToCushion, (bounds.top + r - tBall.pos.y) / tNormal.y);
        const targetLineLen = Math.max(35, Math.min(95, targetDistToCushion));
        const targetEnd = Vector2D.add(tBall.pos, Vector2D.mult(tNormal, targetLineLen));

        ctx.beginPath();
        ctx.moveTo(tBall.pos.x, tBall.pos.y);
        ctx.lineTo(targetEnd.x, targetEnd.y);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)'; // Dim gray line
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Grayed out arrowhead
        const arrowPoint = Vector2D.add(tBall.pos, Vector2D.mult(tNormal, 30));
        const arrowPerp = tNormal.perp();
        ctx.beginPath();
        ctx.moveTo(arrowPoint.x + tNormal.x * 7, arrowPoint.y + tNormal.y * 7);
        ctx.lineTo(arrowPoint.x - arrowPerp.x * 4, arrowPoint.y - arrowPerp.y * 4);
        ctx.lineTo(arrowPoint.x + arrowPerp.x * 4, arrowPoint.y + arrowPerp.y * 4);
        ctx.closePath();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.fill();

        // 4. Circle with line through it (🚫 Prohibition Icon) over Opponent Ball
        const prohR = tBall.radius + 6;
        ctx.save();
        ctx.translate(tBall.pos.x, tBall.pos.y);

        // Warning soft red background glow
        ctx.beginPath();
        ctx.arc(0, 0, prohR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.fill();

        // Red outer prohibition circle
        ctx.beginPath();
        ctx.arc(0, 0, prohR, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.2;
        ctx.stroke();

        // Diagonal slash through the circle (top-left to bottom-right)
        const slashD = prohR * Math.SQRT1_2;
        ctx.beginPath();
        ctx.moveTo(-slashD, -slashD);
        ctx.lineTo(slashD, slashD);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.2;
        ctx.stroke();

        ctx.restore();
      }
    } else if (trajectory.type === 'cushion') {
      const hitPos = trajectory.hitPos;
      // Line from cue ball to cushion
      ctx.beginPath();
      ctx.moveTo(cuePos.x, cuePos.y);
      ctx.lineTo(hitPos.x, hitPos.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      // Cushion bounce reflection ray (Shortened)
      const reflectEnd = Vector2D.add(hitPos, Vector2D.mult(trajectory.reflectDir, 50));
      ctx.beginPath();
      ctx.moveTo(hitPos.x, hitPos.y);
      ctx.lineTo(reflectEnd.x, reflectEnd.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  renderCueStick(ctx) {
    if (!this.cueBall || this.cueBall.isPotted) return;
    ctx.save();

    const cuePos = this.cueBall.pos;
    const r = this.cueBall.radius;
    const angle = this.aimAngle;

    // Visual pullback offset
    const pullOffset = this.cuePullDistance + 12;

    // Cue stick dimensions
    const cueLength = 360;
    const tipWidth = 5;
    const buttWidth = 11;

    // Translate and rotate to cue ball position and aim direction
    ctx.translate(cuePos.x, cuePos.y);
    ctx.rotate(angle + Math.PI); // Position behind cue ball

    // Start of stick (tip)
    const startX = r + pullOffset;

    // 1. Cue stick drop shadow
    ctx.save();
    ctx.translate(0, 8);
    ctx.beginPath();
    ctx.moveTo(startX, -tipWidth / 2);
    ctx.lineTo(startX + cueLength, -buttWidth / 2);
    ctx.lineTo(startX + cueLength, buttWidth / 2);
    ctx.lineTo(startX, tipWidth / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    ctx.restore();

    // 2. Leather Cue Tip
    ctx.fillStyle = '#38bdf8'; // Blue master chalk tip
    ctx.fillRect(startX, -tipWidth / 2, 4, tipWidth);

    // 3. Brass Ferrule
    ctx.fillStyle = '#eab308';
    ctx.fillRect(startX + 4, -tipWidth / 2, 8, tipWidth);

    // 4. Wooden Shaft & Butt
    const cueGrad = ctx.createLinearGradient(startX + 12, 0, startX + cueLength, 0);
    cueGrad.addColorStop(0, '#fde68a'); // Maple wood shaft
    cueGrad.addColorStop(0.55, '#d97706');
    cueGrad.addColorStop(0.7, '#1e293b'); // Dark composite wrap
    cueGrad.addColorStop(1, '#0f172a'); // Butt cap

    ctx.beginPath();
    ctx.moveTo(startX + 12, -tipWidth / 2);
    ctx.lineTo(startX + cueLength, -buttWidth / 2);
    ctx.lineTo(startX + cueLength, buttWidth / 2);
    ctx.lineTo(startX + 12, tipWidth / 2);
    ctx.closePath();
    ctx.fillStyle = cueGrad;
    ctx.fill();

    // Subtle edge highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  renderBallInHandGhost(ctx) {
    if (!this.cueBall) return;
    ctx.save();
    const b = this.cueBall;

    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, b.radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = this.isValidPlacement ? '#10b981' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    ctx.fillStyle = this.isValidPlacement ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
    ctx.fill();
    ctx.restore();
  }

  // =========================================================================
  // Game Loop
  // =========================================================================
  loop(currentTime) {
    if (!this.isRunning) return;

    try {
      const dt = Math.min((currentTime - this.lastTime) / 16.67, 2.0); // Normalized to 60fps
      this.lastTime = currentTime;

      // Physics step
      this.physics.update(this.balls, dt);

      // Check if shot has finished
      if (this.state === 'SIMULATING') {
        if (!this.physics.areBallsMoving(this.balls)) {
          this.handleShotCompletion();
        }
      }

      // Render frame
      this.render();
    } catch (err) {
      console.error('Error in pool game loop:', err);
    } finally {
      if (this.isRunning) {
        this.animFrameId = requestAnimationFrame(this.loop.bind(this));
      }
    }
  }

  // =========================================================================
  // UI & HUD Synchronization
  // =========================================================================
  updateHUD() {
    const r = this.rules;

    // Mode Badge
    const modeBadge = document.getElementById('mode-badge');
    modeBadge.textContent = r.mode === '2player' ? '2-Player 8-Ball' : 'Solo Practice';

    // Player Cards Active States
    const p1Card = document.getElementById('p1-card');
    const p2Card = document.getElementById('p2-card');

    if (r.mode === '2player') {
      p2Card.style.display = 'flex';
      if (r.currentPlayer === 1) {
        p1Card.classList.add('active');
        p2Card.classList.remove('active');
      } else {
        p1Card.classList.remove('active');
        p2Card.classList.add('active');
      }
    } else {
      p1Card.classList.add('active');
      p2Card.style.display = 'none';
    }

    // Suits label
    const p1Suit = document.getElementById('p1-suit');
    const p2Suit = document.getElementById('p2-suit');

    if (r.tableOpen) {
      p1Suit.textContent = 'Open Table';
      p2Suit.textContent = 'Open Table';
    } else {
      p1Suit.textContent = r.p1Suit === 'solid' ? 'Solids (1-7)' : 'Stripes (9-15)';
      p2Suit.textContent = r.p2Suit === 'solid' ? 'Solids (1-7)' : 'Stripes (9-15)';
    }

    // Status message
    const statusMsg = document.getElementById('status-msg');
    const subMsg = document.getElementById('sub-msg');

    if (r.mode === 'practice') {
      statusMsg.textContent = 'Practice Mode';
      subMsg.textContent = 'Take your time & practice shots';
    } else {
      if (r.isBreakShot) {
        statusMsg.textContent = `Player ${r.currentPlayer} to Break`;
        subMsg.textContent = 'Aim & drag cue stick backward';
      } else {
        statusMsg.textContent = `Player ${r.currentPlayer}'s Turn`;
        const activeSuit = r.currentPlayer === 1 ? r.p1Suit : r.p2Suit;
        if (r.tableOpen) {
          subMsg.textContent = 'Table is Open &mdash; Pocket any ball';
        } else if (activeSuit) {
          const rem = r.getRemainingSuitCount(this.balls, activeSuit);
          if (rem === 0) {
            subMsg.textContent = 'TARGET: Legally pocket the 8-Ball to WIN!';
          } else {
            subMsg.textContent = `Target: ${activeSuit.toUpperCase()}S (${rem} remaining)`;
          }
        }
      }
    }

    // Ball Trays (visual rack dots)
    this.updateBallTrays();
  }

  updateBallTrays() {
    const p1Tray = document.getElementById('p1-tray');
    const p2Tray = document.getElementById('p2-tray');
    p1Tray.innerHTML = '';
    p2Tray.innerHTML = '';

    const renderBalls = (container, startNum, endNum, isStripe = false) => {
      for (let i = startNum; i <= endNum; i++) {
        const ball = this.balls.find(b => b.number === i);
        const dot = document.createElement('span');
        dot.className = 'tray-ball';
        if (isStripe) {
          dot.classList.add('is-stripe');
          dot.style.background = `linear-gradient(to bottom, #ffffff 22%, ${Ball.COLORS[i]} 22%, ${Ball.COLORS[i]} 78%, #ffffff 78%)`;
        } else {
          dot.style.backgroundColor = Ball.COLORS[i];
        }
        if (ball && ball.isPotted) {
          dot.classList.add('potted');
        }
        container.appendChild(dot);
      }
    };

    if (this.rules.p1Suit === 'solid') {
      renderBalls(p1Tray, 1, 7, false);
      renderBalls(p2Tray, 9, 15, true);
    } else if (this.rules.p1Suit === 'stripe') {
      renderBalls(p1Tray, 9, 15, true);
      renderBalls(p2Tray, 1, 7, false);
    } else {
      // Open table: show 7 gray dots
      for (let i = 0; i < 7; i++) {
        const dot1 = document.createElement('span');
        dot1.className = 'tray-ball';
        dot1.style.backgroundColor = 'rgba(255,255,255,0.2)';
        p1Tray.appendChild(dot1);

        const dot2 = document.createElement('span');
        dot2.className = 'tray-ball';
        dot2.style.backgroundColor = 'rgba(255,255,255,0.2)';
        p2Tray.appendChild(dot2);
      }
    }
  }

  showToast(text) {
    const toast = document.getElementById('toast-banner');
    const toastText = document.getElementById('toast-text');
    toastText.innerHTML = text;
    toast.classList.remove('hidden');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }

  showGameOverModal(result) {
    const modal = document.getElementById('game-over-modal');
    const title = document.getElementById('winner-title');
    const desc = document.getElementById('winner-desc');
    const p1Pots = document.getElementById('stat-p1-pots');
    const p2Pots = document.getElementById('stat-p2-pots');
    const totalShots = document.getElementById('stat-shots');

    title.textContent = `Player ${result.winner} Wins!`;
    desc.textContent = result.message;

    p1Pots.textContent = this.rules.p1PottedCount;
    p2Pots.textContent = this.rules.p2PottedCount;
    totalShots.textContent = this.rules.totalShots;

    modal.classList.remove('hidden');
  }
}

// Instantiate game on page load
window.addEventListener('DOMContentLoaded', () => {
  window.poolGame = new Game();
});
