// ============================================================
//  CURVEBALL  –  TypeScript / Canvas 2D
// ============================================================

// ──────────────────────────────────────────────────────────
//  Canvas & screen
// ──────────────────────────────────────────────────────────
const CANVAS_W = 800;
const CANVAS_H = 600;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

// ──────────────────────────────────────────────────────────
//  3-D world  (world units)
//    x : -TW … +TW   (left / right)
//    y : -TH … +TH   (up   / down)
//    z :   0 … TD    (player side … AI side)
// ──────────────────────────────────────────────────────────
const TW = 260;   // tunnel half-width
const TH = 190;   // tunnel half-height
const TD = 1000;  // tunnel depth

// Camera sits behind the player along –z
const CAM_Z = -500;
const FOCAL  = 500;

// Paddle z-planes
const PLAYER_Z = 30;
const AI_Z     = 970;

// Paddle half-sizes (world units)
const PPW = 85;  const PPH = 62;   // player
const APW = 78;  const APH = 56;   // AI

// Ball radius (world units)
const BR = 14;

// ──────────────────────────────────────────────────────────
//  Physics  (world units / second)
// ──────────────────────────────────────────────────────────
const SPD_MIN  = 650;   // minimum ball z-speed
const SPD_MAX  = 1400;  // maximum ball z-speed
const SPD_STEP = 45;    // speed increase per hit

// Lateral velocity factor from paddle-offset:
//   vx = offset_fraction * CURVE * vz
const CURVE = 0.42;

// ──────────────────────────────────────────────────────────
//  AI
// ──────────────────────────────────────────────────────────
const AI_SPD_BASE  = 240;   // base lateral speed (u/s)
const AI_SPD_SCALE = 0.38;  // fraction of ball speed the AI can match
const AI_ERR_X     = 120;   // random x prediction error (±half)
const AI_ERR_Y     = 90;    // random y prediction error (±half)
const AI_RETARGET  = 0.12;  // seconds between AI target recalculations

// ──────────────────────────────────────────────────────────
//  Rules
// ──────────────────────────────────────────────────────────
const WIN_SCORE = 7;

// ──────────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────────
interface V3 { x: number; y: number; z: number; }
type State = 'menu' | 'playing' | 'scored' | 'over';

// ──────────────────────────────────────────────────────────
//  Perspective projection
// ──────────────────────────────────────────────────────────
function project(v: V3): { sx: number; sy: number; sc: number } {
  const sc = FOCAL / (v.z - CAM_Z);
  return { sx: CX + v.x * sc, sy: CY + v.y * sc, sc };
}

// ──────────────────────────────────────────────────────────
//  Game
// ──────────────────────────────────────────────────────────
class Game {
  private ctx: CanvasRenderingContext2D;
  private state: State = 'menu';

  // Ball
  private ball: V3  = { x: 0, y: 0, z: 200 };
  private vel: V3   = { x: 0, y: 0, z: 0 };
  private prevBallZ = 200;
  private spd       = SPD_MIN;
  private trail: V3[] = [];

  // Paddles
  private player: V3 = { x: 0, y: 0, z: PLAYER_Z };
  private ai: V3     = { x: 0, y: 0, z: AI_Z };

  // AI internals
  private aiTarget = { x: 0, y: 0 };
  private aiRetargetTimer = 0;

  // Mouse (canvas coords)
  private mx = CX;
  private my = CY;

  // Scores
  private playerScore = 0;
  private aiScore     = 0;

  // Visual effects
  private flashFrames = 0;
  private flashColor  = '#ffffff';

  // Timing
  private prevTs = 0;

  // ────────────────────────────────────────────────────────
  constructor(cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d')!;

    cv.addEventListener('mousemove', (e) => {
      const r = cv.getBoundingClientRect();
      this.mx = e.clientX - r.left;
      this.my = e.clientY - r.top;
    });

    cv.addEventListener('click', () => this.onClick());

    requestAnimationFrame((ts) => { this.prevTs = ts; this.loop(ts); });
  }

  // ────────────────────────────────────────────────────────
  //  Input
  // ────────────────────────────────────────────────────────
  private onClick() {
    if (this.state === 'menu' || this.state === 'scored') {
      this.state = 'playing';
      this.serve();
    } else if (this.state === 'over') {
      this.playerScore = 0;
      this.aiScore     = 0;
      this.state       = 'menu';
      this.resetBall();
    }
  }

  // ────────────────────────────────────────────────────────
  //  Ball management
  // ────────────────────────────────────────────────────────
  private resetBall() {
    this.spd       = SPD_MIN;
    this.ball      = { x: 0, y: 0, z: 150 };
    this.vel       = { x: 0, y: 0, z: 0 };
    this.prevBallZ = 150;
    this.trail     = [];
  }

  private serve() {
    this.spd       = SPD_MIN;
    this.ball      = { x: 0, y: 0, z: 80 };
    this.vel       = { x: 0, y: 0, z: this.spd };
    this.prevBallZ = 80;
    this.trail     = [];
  }

  // ────────────────────────────────────────────────────────
  //  Update
  // ────────────────────────────────────────────────────────
  private update(dt: number) {
    if (this.state !== 'playing') return;

    // ── Player paddle: unproject mouse to world at PLAYER_Z ──
    const sc = FOCAL / (PLAYER_Z - CAM_Z);
    this.player.x = Math.max(-TW + PPW, Math.min(TW - PPW, (this.mx - CX) / sc));
    this.player.y = Math.max(-TH + PPH, Math.min(TH - PPH, (this.my - CY) / sc));

    // ── Move ball ──
    this.prevBallZ = this.ball.z;

    this.trail.unshift({ ...this.ball });
    if (this.trail.length > 10) this.trail.pop();

    this.ball.x += this.vel.x * dt;
    this.ball.y += this.vel.y * dt;
    this.ball.z += this.vel.z * dt;

    // ── Wall bounces ──
    if (this.ball.x > TW - BR) { this.ball.x = TW - BR; this.vel.x = -Math.abs(this.vel.x); }
    if (this.ball.x < -TW + BR) { this.ball.x = -TW + BR; this.vel.x =  Math.abs(this.vel.x); }
    if (this.ball.y > TH - BR) { this.ball.y = TH - BR; this.vel.y = -Math.abs(this.vel.y); }
    if (this.ball.y < -TH + BR) { this.ball.y = -TH + BR; this.vel.y =  Math.abs(this.vel.y); }

    // ── AI ──
    this.updateAI(dt);

    // ── Paddle collision: player side ──
    if (this.prevBallZ > PLAYER_Z && this.ball.z <= PLAYER_Z) {
      if (Math.abs(this.ball.x - this.player.x) <= PPW &&
          Math.abs(this.ball.y - this.player.y) <= PPH) {
        // Hit — apply curve based on where on the paddle ball lands
        const ox = (this.ball.x - this.player.x) / PPW;  // −1 … +1
        const oy = (this.ball.y - this.player.y) / PPH;
        this.spd     = Math.min(SPD_MAX, this.spd + SPD_STEP);
        this.vel.z   =  this.spd;
        this.vel.x   = ox * CURVE * this.spd;
        this.vel.y   = oy * CURVE * this.spd;
        this.ball.z  = PLAYER_Z + 1;
        this.aiRetargetTimer = 0; // force AI to re-predict immediately
      } else {
        this.onScore('ai');
        return;
      }
    }

    // ── Paddle collision: AI side ──
    if (this.prevBallZ < AI_Z && this.ball.z >= AI_Z) {
      if (Math.abs(this.ball.x - this.ai.x) <= APW &&
          Math.abs(this.ball.y - this.ai.y) <= APH) {
        const ox = (this.ball.x - this.ai.x) / APW;
        const oy = (this.ball.y - this.ai.y) / APH;
        this.spd    = Math.min(SPD_MAX, this.spd + SPD_STEP);
        this.vel.z  = -this.spd;
        this.vel.x  = ox * CURVE * this.spd * 0.55; // AI curves less
        this.vel.y  = oy * CURVE * this.spd * 0.55;
        this.ball.z = AI_Z - 1;
      } else {
        this.onScore('player');
        return;
      }
    }

    // Safety net (should not normally be reached)
    if (this.ball.z < PLAYER_Z - 80) { this.onScore('ai');     return; }
    if (this.ball.z > AI_Z    + 80)  { this.onScore('player'); return; }
  }

  // ────────────────────────────────────────────────────────
  //  AI logic
  // ────────────────────────────────────────────────────────
  private updateAI(dt: number) {
    this.aiRetargetTimer -= dt;

    if (this.vel.z > 0) {
      // Ball heading toward AI — predict landing position
      if (this.aiRetargetTimer <= 0) {
        this.aiRetargetTimer = AI_RETARGET;
        const t = (AI_Z - this.ball.z) / this.vel.z;
        if (t > 0) {
          // Straight-line prediction (no wall-bounce modelling = AI weakness)
          const lateralMag = Math.hypot(this.vel.x, this.vel.y);
          const errScale   = Math.min(lateralMag / 300, 1.4);
          this.aiTarget.x  = this.ball.x + this.vel.x * t
            + (Math.random() - 0.5) * AI_ERR_X * errScale;
          this.aiTarget.y  = this.ball.y + this.vel.y * t
            + (Math.random() - 0.5) * AI_ERR_Y * errScale;
        }
      }
    } else {
      // Ball heading toward player — AI drifts back to center
      this.aiTarget.x = 0;
      this.aiTarget.y = 0;
      this.aiRetargetTimer = 0;
    }

    const maxMove = (AI_SPD_BASE + AI_SPD_SCALE * this.spd) * dt;
    const dx = this.aiTarget.x - this.ai.x;
    const dy = this.aiTarget.y - this.ai.y;

    this.ai.x += Math.sign(dx) * Math.min(Math.abs(dx), maxMove);
    this.ai.y += Math.sign(dy) * Math.min(Math.abs(dy), maxMove);
    this.ai.x  = Math.max(-TW + APW, Math.min(TW - APW, this.ai.x));
    this.ai.y  = Math.max(-TH + APH, Math.min(TH - APH, this.ai.y));
  }

  // ────────────────────────────────────────────────────────
  //  Scoring
  // ────────────────────────────────────────────────────────
  private onScore(who: 'player' | 'ai') {
    if (who === 'player') {
      this.playerScore++;
      this.flashColor  = '#00ff88';
    } else {
      this.aiScore++;
      this.flashColor  = '#ff4444';
    }
    this.flashFrames = 45;
    this.resetBall();
    this.state = (this.playerScore >= WIN_SCORE || this.aiScore >= WIN_SCORE) ? 'over' : 'scored';
  }

  // ────────────────────────────────────────────────────────
  //  Render
  // ────────────────────────────────────────────────────────
  private render() {
    const c = this.ctx;

    c.fillStyle = '#000510';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this.drawTunnel();
    this.drawPaddle(this.ai, APW, APH, '#ff3333', '#ff6666');

    // Landing indicator (ball coming toward player)
    if (this.state === 'playing' && this.vel.z < 0) {
      this.drawLandingIndicator();
    }

    this.drawTrail();
    this.drawBall();
    this.drawPaddle(this.player, PPW, PPH, '#00ff88', '#00cc66');
    this.drawCursor();
    this.drawHUD();

    if (this.flashFrames > 0) {
      c.fillStyle = this.flashColor + '18';
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      this.flashFrames--;
    }

    if (this.state === 'menu')   this.drawMenu();
    if (this.state === 'scored') this.drawServePrompt();
    if (this.state === 'over')   this.drawGameOver();
  }

  // ──  Tunnel  ─────────────────────────────────────────────
  private drawTunnel() {
    const c = this.ctx;

    type Quad = { tl: ReturnType<typeof project>; tr: ReturnType<typeof project>;
                  bl: ReturnType<typeof project>; br: ReturnType<typeof project>; };

    const corners = (z: number): Quad => ({
      tl: project({ x: -TW, y: -TH, z }),
      tr: project({ x:  TW, y: -TH, z }),
      bl: project({ x: -TW, y:  TH, z }),
      br: project({ x:  TW, y:  TH, z }),
    });

    const near = corners(0);
    const far  = corners(TD);

    const quad = (a: V3, b: V3, d: V3, e: V3, fill: string) => {
      const [pa, pb, pd, pe] = [project(a), project(b), project(d), project(e)];
      c.fillStyle = fill;
      c.beginPath();
      c.moveTo(pa.sx, pa.sy); c.lineTo(pb.sx, pb.sy);
      c.lineTo(pd.sx, pd.sy); c.lineTo(pe.sx, pe.sy);
      c.closePath();
      c.fill();
    };

    // Faces
    quad({ x:-TW, y:-TH, z:TD }, { x: TW, y:-TH, z:TD },
         { x: TW, y: TH, z:TD }, { x:-TW, y: TH, z:TD }, '#000820');          // back
    quad({ x:-TW, y:-TH, z:0  }, { x: TW, y:-TH, z:0  },
         { x: TW, y:-TH, z:TD }, { x:-TW, y:-TH, z:TD }, '#00082c');           // top
    quad({ x:-TW, y: TH, z:0  }, { x: TW, y: TH, z:0  },
         { x: TW, y: TH, z:TD }, { x:-TW, y: TH, z:TD }, '#00082c');           // bottom
    quad({ x:-TW, y:-TH, z:0  }, { x:-TW, y: TH, z:0  },
         { x:-TW, y: TH, z:TD }, { x:-TW, y:-TH, z:TD }, '#000624');           // left
    quad({ x: TW, y:-TH, z:0  }, { x: TW, y: TH, z:0  },
         { x: TW, y: TH, z:TD }, { x: TW, y:-TH, z:TD }, '#000624');           // right

    // Grid
    c.strokeStyle = '#001840';
    c.lineWidth = 1;
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const z = (i / N) * TD;
      const fl = project({ x:-TW, y: TH, z }); const fr = project({ x: TW, y: TH, z });
      const cl = project({ x:-TW, y:-TH, z }); const cr = project({ x: TW, y:-TH, z });
      c.beginPath(); c.moveTo(fl.sx, fl.sy); c.lineTo(fr.sx, fr.sy); c.stroke();
      c.beginPath(); c.moveTo(cl.sx, cl.sy); c.lineTo(cr.sx, cr.sy); c.stroke();
    }
    const M = 6;
    for (let i = 0; i <= M; i++) {
      const x = -TW + (i / M) * TW * 2;
      const fn = project({ x, y: TH, z: 0 }); const ff = project({ x, y: TH, z: TD });
      c.beginPath(); c.moveTo(fn.sx, fn.sy); c.lineTo(ff.sx, ff.sy); c.stroke();
    }

    // Edge rails
    c.lineWidth = 2;
    c.strokeStyle = '#003899';
    const rails: [ReturnType<typeof project>, ReturnType<typeof project>][] = [
      [near.tl, far.tl], [near.tr, far.tr], [near.bl, far.bl], [near.br, far.br],
    ];
    for (const [a, b] of rails) {
      c.beginPath(); c.moveTo(a.sx, a.sy); c.lineTo(b.sx, b.sy); c.stroke();
    }

    // Far rectangle (glowing)
    c.strokeStyle = '#0055ff';
    c.lineWidth = 2;
    c.shadowColor = '#0044cc';
    c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(far.tl.sx, far.tl.sy); c.lineTo(far.tr.sx, far.tr.sy);
    c.lineTo(far.br.sx, far.br.sy); c.lineTo(far.bl.sx, far.bl.sy);
    c.closePath();
    c.stroke();
    c.shadowBlur = 0;
  }

  // ──  Paddle  ──────────────────────────────────────────────
  private drawPaddle(pos: V3, hw: number, hh: number, col: string, glow: string) {
    const c = this.ctx;
    const tl = project({ x: pos.x - hw, y: pos.y - hh, z: pos.z });
    const tr = project({ x: pos.x + hw, y: pos.y - hh, z: pos.z });
    const bl = project({ x: pos.x - hw, y: pos.y + hh, z: pos.z });
    const br = project({ x: pos.x + hw, y: pos.y + hh, z: pos.z });

    c.shadowColor = glow;
    c.shadowBlur  = 18;
    c.fillStyle   = col + '28';
    c.strokeStyle = col;
    c.lineWidth   = 2;

    c.beginPath();
    c.moveTo(tl.sx, tl.sy); c.lineTo(tr.sx, tr.sy);
    c.lineTo(br.sx, br.sy); c.lineTo(bl.sx, bl.sy);
    c.closePath();
    c.fill();
    c.stroke();

    // Center cross-hair
    const cx = (tl.sx + br.sx) / 2;
    const cy = (tl.sy + br.sy) / 2;
    const hs = Math.abs(tr.sx - tl.sx) * 0.12;
    c.strokeStyle = col + '88';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - hs, cy); c.lineTo(cx + hs, cy);
    c.moveTo(cx, cy - hs); c.lineTo(cx, cy + hs);
    c.stroke();

    c.shadowBlur = 0;
  }

  // ──  Ball  ────────────────────────────────────────────────
  private drawTrail() {
    const c = this.ctx;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = project(this.trail[i]);
      const r = Math.max(BR * p.sc * 0.65, 1);
      const a = (1 - i / this.trail.length) * 0.22;
      c.beginPath();
      c.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      c.fillStyle = `rgba(100,200,255,${a})`;
      c.fill();
    }
  }

  private drawBall() {
    const c = this.ctx;
    const p = project(this.ball);
    const r = Math.max(BR * p.sc, 3);

    c.shadowColor = '#88ccff';
    c.shadowBlur  = 22;

    const g = c.createRadialGradient(
      p.sx - r * 0.3, p.sy - r * 0.35, r * 0.05,
      p.sx, p.sy, r,
    );
    g.addColorStop(0,   '#ffffff');
    g.addColorStop(0.4, '#aaddff');
    g.addColorStop(1,   '#1166dd');

    c.beginPath();
    c.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    c.fillStyle = g;
    c.fill();

    c.shadowBlur = 0;
  }

  // ──  Landing indicator  ───────────────────────────────────
  private drawLandingIndicator() {
    const c = this.ctx;
    const t = (PLAYER_Z - this.ball.z) / this.vel.z;
    if (t <= 0) return;

    const lx = Math.max(-TW + BR, Math.min(TW - BR, this.ball.x + this.vel.x * t));
    const ly = Math.max(-TH + BR, Math.min(TH - BR, this.ball.y + this.vel.y * t));
    const p  = project({ x: lx, y: ly, z: PLAYER_Z });
    const r  = BR * p.sc * 1.6;

    c.strokeStyle = 'rgba(255,210,60,0.45)';
    c.lineWidth   = 1;

    c.beginPath();
    c.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    c.stroke();

    c.beginPath();
    c.moveTo(p.sx - r * 1.8, p.sy); c.lineTo(p.sx + r * 1.8, p.sy);
    c.moveTo(p.sx, p.sy - r * 1.8); c.lineTo(p.sx, p.sy + r * 1.8);
    c.stroke();
  }

  // ──  Custom cursor  ───────────────────────────────────────
  private drawCursor() {
    const c = this.ctx;
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth   = 1;
    const S = 10;
    c.beginPath();
    c.moveTo(this.mx - S, this.my); c.lineTo(this.mx + S, this.my);
    c.moveTo(this.mx, this.my - S); c.lineTo(this.mx, this.my + S);
    c.arc(this.mx, this.my, 4, 0, Math.PI * 2);
    c.stroke();
  }

  // ──  HUD  ─────────────────────────────────────────────────
  private drawHUD() {
    const c = this.ctx;

    // Score
    c.font = 'bold 42px "Courier New", monospace';
    c.textAlign = 'right';
    c.fillStyle = '#ff4444';
    c.fillText(String(this.aiScore), CX - 22, 58);

    c.font = 'bold 32px monospace';
    c.textAlign = 'center';
    c.fillStyle = '#444';
    c.fillText(':', CX, 58);

    c.font = 'bold 42px "Courier New", monospace';
    c.textAlign = 'left';
    c.fillStyle = '#00ff88';
    c.fillText(String(this.playerScore), CX + 22, 58);

    c.font = '11px monospace';
    c.fillStyle = '#444';
    c.textAlign = 'right'; c.fillText('CPU', CX - 22, 72);
    c.textAlign = 'left';  c.fillText('YOU', CX + 22, 72);

    // Speed bar
    const pct = (this.spd - SPD_MIN) / (SPD_MAX - SPD_MIN);
    const bx = 18, by = CANVAS_H - 26, bw = 150, bh = 8;

    c.fillStyle = '#0d0d1a';
    c.fillRect(bx, by, bw, bh);

    const sg = c.createLinearGradient(bx, 0, bx + bw, 0);
    sg.addColorStop(0,   '#00ff88');
    sg.addColorStop(0.6, '#ffcc00');
    sg.addColorStop(1,   '#ff4444');
    c.fillStyle = sg;
    c.fillRect(bx, by, bw * pct, bh);

    c.strokeStyle = '#222';
    c.lineWidth   = 1;
    c.strokeRect(bx, by, bw, bh);

    c.fillStyle   = '#555';
    c.font        = '10px monospace';
    c.textAlign   = 'left';
    c.fillText('SPEED', bx, by - 3);

    // Win target
    c.fillStyle = '#333';
    c.textAlign = 'right';
    c.font = '12px monospace';
    c.fillText(`First to ${WIN_SCORE}`, CANVAS_W - 15, CANVAS_H - 15);
  }

  // ──  Overlays  ────────────────────────────────────────────
  private drawMenu() {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,5,16,0.72)';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);

    c.textAlign = 'center';

    c.font        = 'bold 76px "Courier New", monospace';
    c.shadowColor = '#00aaff';
    c.shadowBlur  = 35;
    c.fillStyle   = '#00aaff';
    c.fillText('CURVEBALL', CX, CY - 80);
    c.shadowBlur  = 0;

    c.font      = '17px monospace';
    c.fillStyle = '#8899bb';
    c.fillText('Move your mouse to control the paddle', CX, CY - 18);
    c.fillText('Hit the ball off-center to curve it!', CX, CY + 10);
    c.fillText(`First to ${WIN_SCORE} points wins`, CX, CY + 40);

    c.font        = 'bold 27px "Courier New", monospace';
    c.fillStyle   = '#00ff88';
    c.shadowColor = '#00ff88';
    c.shadowBlur  = 12;
    c.fillText('CLICK TO START', CX, CY + 105);
    c.shadowBlur  = 0;
  }

  private drawServePrompt() {
    const c = this.ctx;
    c.font      = '19px monospace';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(200,200,200,0.75)';
    c.fillText('Click to serve', CX, CANVAS_H - 48);
  }

  private drawGameOver() {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,5,16,0.82)';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);

    c.textAlign = 'center';
    const win = this.playerScore >= WIN_SCORE;

    c.font        = 'bold 66px "Courier New", monospace';
    c.shadowBlur  = 28;
    c.fillStyle   = win ? '#00ff88' : '#ff4444';
    c.shadowColor = win ? '#00ff88' : '#ff4444';
    c.fillText(win ? 'YOU WIN!' : 'GAME OVER', CX, CY - 40);
    c.shadowBlur  = 0;

    c.font      = '30px monospace';
    c.fillStyle = '#aaaaaa';
    c.fillText(`${this.playerScore}  :  ${this.aiScore}`, CX, CY + 24);

    c.font      = '21px monospace';
    c.fillStyle = '#666';
    c.fillText('Click to play again', CX, CY + 80);
  }

  // ──  Game loop  ───────────────────────────────────────────
  private loop(ts: number) {
    const dt = Math.min((ts - this.prevTs) / 1000, 0.05); // cap at 50 ms
    this.prevTs = ts;
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}

// ──────────────────────────────────────────────────────────
//  Bootstrap
// ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const cv = document.getElementById('gameCanvas') as HTMLCanvasElement;
  cv.width  = CANVAS_W;
  cv.height = CANVAS_H;
  new Game(cv);
});
