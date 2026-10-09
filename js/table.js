/**
 * Table Class - Manages pool table geometry, cushion boundary segments, pockets, and rendering.
 */
class Table {
  static THEMES = {
    classic: {
      felt: '#0f6838',
      feltShadow: '#0a4b27',
      cushion: '#0b522c',
      wood: '#3e2723',
      woodHighlight: '#5d4037',
      metal: '#d4af37'
    },
    royal: {
      felt: '#1d4ed8',
      feltShadow: '#1e40af',
      cushion: '#173f9e',
      wood: '#1e293b',
      woodHighlight: '#334155',
      metal: '#94a3b8'
    },
    burgundy: {
      felt: '#881337',
      feltShadow: '#4c0519',
      cushion: '#6e0f2d',
      wood: '#2a1215',
      woodHighlight: '#4a2428',
      metal: '#d4af37'
    },
    slate: {
      felt: '#334155',
      feltShadow: '#1e293b',
      cushion: '#273444',
      wood: '#0f172a',
      woodHighlight: '#1e293b',
      metal: '#64748b'
    }
  };

  constructor(playWidth = 920, playHeight = 460) {
    this.playWidth = playWidth;
    this.playHeight = playHeight;
    this.railWidth = 46;
    this.cornerPocketRadius = 24;
    this.sidePocketRadius = 21;
    this.cornerJawCut = 24;
    this.sideJawCut = 18;

    this.theme = 'classic';

    // Total table dimensions including rails
    this.width = playWidth + this.railWidth * 2;
    this.height = playHeight + this.railWidth * 2;

    this.setupGeometry();
  }

  setTheme(themeKey) {
    if (Table.THEMES[themeKey]) {
      this.theme = themeKey;
    }
  }

  setupGeometry() {
    const rw = this.railWidth;
    const pw = this.playWidth;
    const ph = this.playHeight;

    // Playing surface boundaries (interior)
    this.bounds = {
      left: rw,
      right: rw + pw,
      top: rw,
      bottom: rw + ph
    };

    // 6 Pockets
    this.pockets = [
      { id: 'tl', pos: new Vector2D(rw, rw), radius: this.cornerPocketRadius, isCorner: true },
      { id: 'tc', pos: new Vector2D(rw + pw / 2, rw - 4), radius: this.sidePocketRadius, isCorner: false },
      { id: 'tr', pos: new Vector2D(rw + pw, rw), radius: this.cornerPocketRadius, isCorner: true },
      { id: 'bl', pos: new Vector2D(rw, rw + ph), radius: this.cornerPocketRadius, isCorner: true },
      { id: 'bc', pos: new Vector2D(rw + pw / 2, rw + ph + 4), radius: this.sidePocketRadius, isCorner: false },
      { id: 'br', pos: new Vector2D(rw + pw, rw + ph), radius: this.cornerPocketRadius, isCorner: true }
    ];

    // Cushion line segments with angled pocket jaws
    // Each segment is defined by p1 and p2 (clockwise or directed along cushion edge)
    const cj = this.cornerJawCut;
    const sj = this.sideJawCut;

    this.cushions = [
      // Top Rail (Left section): between TL and TC pockets
      {
        p1: new Vector2D(rw + cj, rw),
        p2: new Vector2D(rw + pw / 2 - sj, rw),
        normal: new Vector2D(0, 1),
        type: 'top'
      },
      // Top Rail (Right section): between TC and TR pockets
      {
        p1: new Vector2D(rw + pw / 2 + sj, rw),
        p2: new Vector2D(rw + pw - cj, rw),
        normal: new Vector2D(0, 1),
        type: 'top'
      },
      // Bottom Rail (Left section): between BL and BC pockets
      {
        p1: new Vector2D(rw + cj, rw + ph),
        p2: new Vector2D(rw + pw / 2 - sj, rw + ph),
        normal: new Vector2D(0, -1),
        type: 'bottom'
      },
      // Bottom Rail (Right section): between BC and BR pockets
      {
        p1: new Vector2D(rw + pw / 2 + sj, rw + ph),
        p2: new Vector2D(rw + pw - cj, rw + ph),
        normal: new Vector2D(0, -1),
        type: 'bottom'
      },
      // Left Rail: between TL and BL pockets
      {
        p1: new Vector2D(rw, rw + cj),
        p2: new Vector2D(rw, rw + ph - cj),
        normal: new Vector2D(1, 0),
        type: 'left'
      },
      // Right Rail: between TR and BR pockets
      {
        p1: new Vector2D(rw + pw, rw + cj),
        p2: new Vector2D(rw + pw, rw + ph - cj),
        normal: new Vector2D(-1, 0),
        type: 'right'
      }
    ];

    // Angled corner jaws for smooth ball funnels into pockets
    // TL pocket jaws
    this.cushions.push(
      { p1: new Vector2D(rw, rw + cj), p2: new Vector2D(rw - 10, rw + 5), normal: new Vector2D(1, -1).normalize() },
      { p1: new Vector2D(rw + cj, rw), p2: new Vector2D(rw + 5, rw - 10), normal: new Vector2D(-1, 1).normalize() }
    );
    // TR pocket jaws
    this.cushions.push(
      { p1: new Vector2D(rw + pw, rw + cj), p2: new Vector2D(rw + pw + 10, rw + 5), normal: new Vector2D(-1, -1).normalize() },
      { p1: new Vector2D(rw + pw - cj, rw), p2: new Vector2D(rw + pw - 5, rw - 10), normal: new Vector2D(1, 1).normalize() }
    );
    // BL pocket jaws
    this.cushions.push(
      { p1: new Vector2D(rw, rw + ph - cj), p2: new Vector2D(rw - 10, rw + ph - 5), normal: new Vector2D(1, 1).normalize() },
      { p1: new Vector2D(rw + cj, rw + ph), p2: new Vector2D(rw + 5, rw + ph + 10), normal: new Vector2D(-1, -1).normalize() }
    );
    // BR pocket jaws
    this.cushions.push(
      { p1: new Vector2D(rw + pw, rw + ph - cj), p2: new Vector2D(rw + pw + 10, rw + ph - 5), normal: new Vector2D(-1, 1).normalize() },
      { p1: new Vector2D(rw + pw - cj, rw + ph), p2: new Vector2D(rw + pw - 5, rw + ph + 10), normal: new Vector2D(1, -1).normalize() }
    );
    // TC pocket jaws
    this.cushions.push(
      { p1: new Vector2D(rw + pw / 2 - sj, rw), p2: new Vector2D(rw + pw / 2 - sj + 4, rw - 12), normal: new Vector2D(1, 1).normalize() },
      { p1: new Vector2D(rw + pw / 2 + sj, rw), p2: new Vector2D(rw + pw / 2 + sj - 4, rw - 12), normal: new Vector2D(-1, 1).normalize() }
    );
    // BC pocket jaws
    this.cushions.push(
      { p1: new Vector2D(rw + pw / 2 - sj, rw + ph), p2: new Vector2D(rw + pw / 2 - sj + 4, rw + ph + 12), normal: new Vector2D(1, -1).normalize() },
      { p1: new Vector2D(rw + pw / 2 + sj, rw + ph), p2: new Vector2D(rw + pw / 2 + sj - 4, rw + ph + 12), normal: new Vector2D(-1, -1).normalize() }
    );

    // Head String (Break Line) and Foot Spot coordinates
    this.headStringX = rw + pw * 0.25;
    this.footSpot = new Vector2D(rw + pw * 0.75, rw + ph * 0.5);
    this.centerSpot = new Vector2D(rw + pw * 0.5, rw + ph * 0.5);
  }

  // Check if ball center has entered pocket opening
  checkPocketDrop(ball) {
    for (const pocket of this.pockets) {
      const dropRadius = pocket.radius * 0.95;
      if (ball.pos.distSq(pocket.pos) < dropRadius * dropRadius) {
        return pocket;
      }
    }
    return null;
  }

  render(ctx) {
    const t = Table.THEMES[this.theme] || Table.THEMES.classic;
    const rw = this.railWidth;
    const pw = this.playWidth;
    const ph = this.playHeight;

    // 1. Outer Wood Rails
    ctx.save();
    ctx.fillStyle = t.wood;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(0, 0, this.width, this.height, 16);
    } else {
      ctx.rect(0, 0, this.width, this.height);
    }
    ctx.fill();

    // Wood border highlight & grain sheen
    ctx.strokeStyle = t.woodHighlight;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Subtle wood bevel
    const woodBevel = ctx.createLinearGradient(0, 0, 0, rw);
    woodBevel.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    woodBevel.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = woodBevel;
    ctx.fill();

    // 2. Diamond Sights (Inlaid pearl markers along rails)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const renderDiamond = (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };

    // Diamonds on top & bottom rails (4 segments each)
    for (let i = 1; i < 4; i++) {
      const x1 = rw + (pw / 2) * (i / 4);
      const x2 = rw + pw / 2 + (pw / 2) * (i / 4);
      renderDiamond(x1, rw / 2);
      renderDiamond(x2, rw / 2);
      renderDiamond(x1, this.height - rw / 2);
      renderDiamond(x2, this.height - rw / 2);
    }
    // Diamonds on left & right rails
    for (let i = 1; i < 4; i++) {
      const y = rw + ph * (i / 4);
      renderDiamond(rw / 2, y);
      renderDiamond(this.width - rw / 2, y);
    }

    // 3. Slate & Felt Playing Surface
    ctx.fillStyle = t.felt;
    ctx.fillRect(rw, rw, pw, ph);

    // Felt shadow near cushions for depth
    const feltShadowGrad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, ph * 0.4,
      this.width / 2, this.height / 2, pw * 0.6
    );
    feltShadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    feltShadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
    ctx.fillStyle = feltShadowGrad;
    ctx.fillRect(rw, rw, pw, ph);

    // 4. Subtle Table Markings (Head string line & Foot spot)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.headStringX, rw);
    ctx.lineTo(this.headStringX, rw + ph);
    ctx.stroke();
    ctx.setLineDash([]);

    // Foot spot
    ctx.beginPath();
    ctx.arc(this.footSpot.x, this.footSpot.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();

    // 5. Cushions (Rubber bumper edges)
    ctx.fillStyle = t.cushion;
    // Top cushion
    ctx.fillRect(rw, rw - 8, pw, 8);
    // Bottom cushion
    ctx.fillRect(rw, rw + ph, pw, 8);
    // Left cushion
    ctx.fillRect(rw - 8, rw, 8, ph);
    // Right cushion
    ctx.fillRect(rw + pw, rw, 8, ph);

    // Cushion edge highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rw, rw, pw, ph);

    // 6. Pockets
    for (const pocket of this.pockets) {
      // Outer brass/chrome pocket bezel
      ctx.beginPath();
      ctx.arc(pocket.pos.x, pocket.pos.y, pocket.radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = t.metal;
      ctx.fill();

      // Pocket bevel shadow
      ctx.beginPath();
      ctx.arc(pocket.pos.x, pocket.pos.y, pocket.radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      // Pocket interior hole (deep black)
      ctx.beginPath();
      ctx.arc(pocket.pos.x, pocket.pos.y, pocket.radius, 0, Math.PI * 2);
      const holeGrad = ctx.createRadialGradient(
        pocket.pos.x - 2, pocket.pos.y - 2, 2,
        pocket.pos.x, pocket.pos.y, pocket.radius
      );
      holeGrad.addColorStop(0, '#050505');
      holeGrad.addColorStop(0.8, '#111111');
      holeGrad.addColorStop(1, '#1f1f1f');
      ctx.fillStyle = holeGrad;
      ctx.fill();

      // Pocket inner lip
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }
}
