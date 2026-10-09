/**
 * RulesEngine - Standard 8-Ball pool rules & Practice mode controller.
 */
class RulesEngine {
  constructor() {
    this.mode = '2player'; // '2player' or 'practice'
    this.reset();
  }

  setMode(newMode) {
    this.mode = newMode;
    this.reset();
  }

  reset() {
    this.currentPlayer = 1;
    this.p1Suit = null; // 'solid' | 'stripe'
    this.p2Suit = null; // 'stripe' | 'solid'
    this.tableOpen = true;
    this.isBreakShot = true;

    // Shot tracking
    this.firstBallHit = null;
    this.cushionHitAfterContact = false;
    this.ballsPottedThisShot = [];

    // Match statistics
    this.p1PottedCount = 0;
    this.p2PottedCount = 0;
    this.totalShots = 0;

    // Game state
    this.foulOccurred = false;
    this.foulReason = '';
    this.ballInHand = false;
    this.gameOver = false;
    this.winner = null;
    this.winReason = '';
  }

  startShot() {
    this.firstBallHit = null;
    this.cushionHitAfterContact = false;
    this.ballsPottedThisShot = [];
    this.foulOccurred = false;
    this.foulReason = '';
    this.totalShots++;
  }

  recordBallCollision(b1, b2) {
    // Check if cue ball was involved
    if (b1.number === 0 || b2.number === 0) {
      if (this.firstBallHit === null) {
        this.firstBallHit = b1.number === 0 ? b2 : b1;
      }
    }
  }

  recordCushionCollision(ball) {
    if (this.firstBallHit !== null || ball.vel.mag() > 1.5) {
      this.cushionHitAfterContact = true;
    }
  }

  recordBallPotted(ball) {
    this.ballsPottedThisShot.push(ball);
  }

  getRemainingSuitCount(balls, suit) {
    return balls.filter(b => !b.isPotted && b.type === suit).length;
  }

  // Check if a ball is a legal target for the active player
  isLegalTarget(ball, balls) {
    if (!ball || ball.number === 0 || ball.isPotted) return false;

    // In solo practice mode, all balls are legal targets
    if (this.mode === 'practice') return true;

    const activePlayer = this.currentPlayer;
    const activeSuit = activePlayer === 1 ? this.p1Suit : this.p2Suit;

    // Table is open (suits not decided yet)
    if (this.tableOpen) {
      // Hitting the 8-ball first on an open table is a foul (except open break)
      if (ball.number === 8) {
        return false;
      }
      return true;
    }

    // Suits are decided (Solids vs Stripes)
    if (activeSuit) {
      const remainingSuit = this.getRemainingSuitCount(balls, activeSuit);
      if (remainingSuit > 0) {
        // Player MUST hit their own suit ball first! Opponent's suit or 8-ball is illegal
        return ball.type === activeSuit;
      } else {
        // All suit balls cleared: 8-ball is the sole legal target!
        return ball.number === 8;
      }
    }

    return true;
  }

  // Informative description of why a target is illegal
  getIllegalTargetReason(ball, balls) {
    if (!ball || ball.number === 0) return '';
    if (this.mode === 'practice') return '';

    const activePlayer = this.currentPlayer;
    const activeSuit = activePlayer === 1 ? this.p1Suit : this.p2Suit;

    if (this.tableOpen) {
      if (ball.number === 8) return 'Foul: 8-Ball on Open Table';
      return '';
    }

    if (activeSuit) {
      const remainingSuit = this.getRemainingSuitCount(balls, activeSuit);
      if (remainingSuit > 0) {
        if (ball.number === 8) return 'Foul: 8-Ball (Clear Suit First)';
        if (ball.type !== activeSuit) return "Foul: Opponent's Ball";
      } else {
        if (ball.number !== 8) return 'Foul: Must Target 8-Ball';
      }
    }

    return '';
  }

  evaluateShot(balls, cueBall) {
    // Solo Practice Mode
    if (this.mode === 'practice') {
      if (cueBall.isPotted) {
        this.ballInHand = true;
        return {
          foul: false,
          ballInHand: true,
          switchTurn: false,
          message: 'Cue ball scratched &mdash; Ball in hand',
          potted: this.ballsPottedThisShot
        };
      }
      return {
        foul: false,
        ballInHand: false,
        switchTurn: false,
        message: this.ballsPottedThisShot.length > 0
          ? `Potted ${this.ballsPottedThisShot.map(b => b.number).join(', ')}!`
          : 'Ready for next shot',
        potted: this.ballsPottedThisShot
      };
    }

    // 2-Player 8-Ball Mode
    const activePlayer = this.currentPlayer;
    const opponentPlayer = activePlayer === 1 ? 2 : 1;
    const activeSuit = activePlayer === 1 ? this.p1Suit : this.p2Suit;
    const cueScratched = cueBall.isPotted;
    const eightBallPotted = this.ballsPottedThisShot.some(b => b.number === 8);
    const wasTableOpen = this.tableOpen;

    // Remaining suit count at start of shot (before balls were potted on this shot)
    const pottedSuitCount = activeSuit ? this.ballsPottedThisShot.filter(b => b.type === activeSuit).length : 0;
    const remainingSuitBeforeShot = activeSuit ? (this.getRemainingSuitCount(balls, activeSuit) + pottedSuitCount) : 7;

    // 1. Check 8-Ball Pocketed
    if (eightBallPotted) {
      // 8-Ball potted on break shot: re-spot 8-ball (WPA break rule friendly resolution)
      if (this.isBreakShot) {
        const eightBall = balls.find(b => b.number === 8);
        if (eightBall) {
          eightBall.reset(balls[0].pos.x + 300, 276); // Respot near foot spot
        }
        this.ballsPottedThisShot = this.ballsPottedThisShot.filter(b => b.number !== 8);
        return {
          foul: false,
          switchTurn: false,
          message: '8-Ball potted on break! Re-spotted.',
          potted: this.ballsPottedThisShot
        };
      }

      if (cueScratched) {
        // Scratched on 8-ball = LOSS
        this.gameOver = true;
        this.winner = opponentPlayer;
        this.winReason = `Player ${activePlayer} scratched while potting the 8-ball!`;
        return { foul: true, gameOver: true, winner: this.winner, message: this.winReason };
      } else if (remainingSuitBeforeShot > 0 || wasTableOpen) {
        // 8-ball potted prematurely = LOSS
        this.gameOver = true;
        this.winner = opponentPlayer;
        this.winReason = `Player ${activePlayer} potted the 8-ball prematurely!`;
        return { foul: true, gameOver: true, winner: this.winner, message: this.winReason };
      } else {
        // Legal 8-ball pot = WIN!
        this.gameOver = true;
        this.winner = activePlayer;
        this.winReason = `Player ${activePlayer} legally potted the 8-ball to WIN!`;
        return { foul: false, gameOver: true, winner: this.winner, message: this.winReason };
      }
    }

    // 2. Foul Checks
    let isFoul = false;
    let foulText = '';

    if (cueScratched) {
      isFoul = true;
      foulText = `Foul: Scratch! Cue ball pocketed.`;
    } else if (!this.firstBallHit) {
      isFoul = true;
      foulText = `Foul: Cue ball failed to contact any ball.`;
    } else if (!wasTableOpen && activeSuit) {
      if (remainingSuitBeforeShot > 0) {
        // Must hit player's suit first
        if (this.firstBallHit && this.firstBallHit.type !== activeSuit) {
          isFoul = true;
          foulText = `Foul: Hit ${this.firstBallHit.type === '8ball' ? '8-ball' : "opponent's ball"} first.`;
        }
      } else {
        // Player had ALREADY cleared all suit balls prior to this shot: legal target was 8-ball
        if (this.firstBallHit && this.firstBallHit.number !== 8) {
          isFoul = true;
          foulText = `Foul: Must target 8-ball (hit ball ${this.firstBallHit.number} first).`;
        }
      }
    } else if (wasTableOpen && !this.isBreakShot) {
      // Table is open: hitting 8-ball first is a foul
      if (this.firstBallHit && this.firstBallHit.number === 8) {
        isFoul = true;
        foulText = `Foul: Hit 8-ball first on an open table.`;
      }
    }

    // 3. Assign Suits if Open Table
    let suitJustAssigned = false;
    if (wasTableOpen && !this.isBreakShot && !isFoul) {
      const legalPotted = this.ballsPottedThisShot.filter(b => b.number >= 1 && b.number <= 15 && b.number !== 8);
      if (legalPotted.length > 0) {
        const firstPottedSuit = legalPotted[0].type;
        if (activePlayer === 1) {
          this.p1Suit = firstPottedSuit;
          this.p2Suit = firstPottedSuit === 'solid' ? 'stripe' : 'solid';
        } else {
          this.p2Suit = firstPottedSuit;
          this.p1Suit = firstPottedSuit === 'solid' ? 'stripe' : 'solid';
        }
        this.tableOpen = false;
        suitJustAssigned = true;
      }
    }

    // Update potted counters
    if (this.p1Suit) {
      this.p1PottedCount = 7 - this.getRemainingSuitCount(balls, this.p1Suit);
      this.p2PottedCount = 7 - this.getRemainingSuitCount(balls, this.p2Suit);
    }

    // 4. Determine Turn Progression
    this.isBreakShot = false;
    let switchTurn = false;
    let toastMessage = '';

    if (isFoul) {
      this.foulOccurred = true;
      this.foulReason = foulText;
      this.ballInHand = true;
      switchTurn = true;
      this.currentPlayer = opponentPlayer;
      toastMessage = foulText;
    } else {
      // Current active suit after possible assignment
      const currentSuit = activePlayer === 1 ? this.p1Suit : this.p2Suit;

      // Legal shot: did active player pot at least one of their own balls?
      let pottedOwn = false;
      if (wasTableOpen) {
        // On an open table (break shot or suit-assigning shot), potting any object ball continues turn
        pottedOwn = this.ballsPottedThisShot.some(b => b.number >= 1 && b.number <= 15 && b.number !== 8);
      } else {
        pottedOwn = this.ballsPottedThisShot.some(b => b.type === currentSuit);
      }

      if (pottedOwn) {
        // Player potted own ball: continues turn!
        switchTurn = false;
        const remainingNow = currentSuit ? this.getRemainingSuitCount(balls, currentSuit) : 7;
        if (suitJustAssigned) {
          const suitName = currentSuit === 'solid' ? 'Solids (1-7)' : 'Stripes (9-15)';
          toastMessage = `Player ${activePlayer} claimed ${suitName}! Continue shooting.`;
        } else if (remainingNow === 0 && remainingSuitBeforeShot > 0) {
          toastMessage = `Player ${activePlayer} cleared their suit! Target the 8-Ball to WIN!`;
        } else {
          toastMessage = `Player ${activePlayer} potted a ball! Continue shooting.`;
        }
      } else {
        // No ball of own suit potted: switch turn
        switchTurn = true;
        this.currentPlayer = opponentPlayer;
        toastMessage = `Turn passes to Player ${opponentPlayer}.`;
      }
    }

    return {
      foul: isFoul,
      foulReason: this.foulReason,
      switchTurn: switchTurn,
      currentPlayer: this.currentPlayer,
      ballInHand: this.ballInHand,
      tableOpen: this.tableOpen,
      message: toastMessage,
      potted: this.ballsPottedThisShot
    };
  }
}
