// ── Canvas renderer for Mahjong Solitaire ────────────────────────────────────
import { type GameState, type Tile, isFree } from './game';
import { ALL_TILE_TYPES, type TileSuit } from './tiles';

// Tile dimensions in canvas pixels
const TW    = 72;   // tile width
const TH    = 96;   // tile height
const DEPTH = 8;    // 3-D shadow thickness per layer

// ── Colors ────────────────────────────────────────────────────────────────────
const COL_FACE_FREE = '#fffdf4';
const COL_FACE_SEL  = '#fff3a0';
const COL_FACE_HINT = '#c8f5c8';
const COL_LOCKED    = '#d8d4c8';
const COL_TOP       = '#e8e0d0';
const COL_SIDE_R    = '#b8a890';
const COL_SIDE_B    = '#a09080';
const COL_BORDER    = '#6a5a48';

// Suit colors
const COLOR_CHAR   = '#cc1a1a';   // characters → red
const COLOR_BAMBOO = '#1a7a1a';   // bamboo → green
const COLOR_CIRCLE = '#1a3acc';   // circles → blue
const COLOR_WIND   = '#1a1a1a';   // winds → black
const COLOR_DRAGON_RED   = '#cc1a1a';
const COLOR_DRAGON_GREEN = '#1a7a1a';
const COLOR_DRAGON_WHITE = '#aaaaaa';
const COLOR_FLOWER = '#cc4499';
const COLOR_SEASON = '#8844cc';

// Chinese numerals 1-9
const ZH_NUM = ['一','二','三','四','五','六','七','八','九'];
// Wind characters: East South West North
const WIND_CHAR  = ['東','南','西','北'];
// Dragon characters
const DRAGON_CHAR = ['中','發','白'];
const DRAGON_COL  = [COLOR_DRAGON_RED, COLOR_DRAGON_GREEN, COLOR_DRAGON_WHITE];
// Flower/Season characters
const FLOWER_CHAR = ['梅','蘭','菊','竹'];
const SEASON_CHAR = ['春','夏','秋','冬'];

export interface RenderOptions {
  hint: [number, number] | null;
}

// ── Coordinate mapping ────────────────────────────────────────────────────────
function tileX(col: number, layer: number): number {
  return col * (TW / 2) + DEPTH * layer;
}
function tileY(row: number, layer: number): number {
  return row * (TH / 2) - DEPTH * layer;
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Tile face content ─────────────────────────────────────────────────────────
function drawTileFace(
  ctx:    CanvasRenderingContext2D,
  typeIdx: number,
  fx: number,   // face origin x
  fy: number,   // face origin y
  fw: number,   // face width
  fh: number,   // face height
): void {
  const t    = ALL_TILE_TYPES[typeIdx];
  const cx   = fx + fw / 2;
  const cy   = fy + fh / 2;

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  switch (t.suit as TileSuit) {

    // ── Characters (萬子) ─────────────────────────────────────────────────────
    case 'characters': {
      // Large Chinese numeral
      ctx.fillStyle = COLOR_CHAR;
      ctx.font      = `bold ${Math.round(fh * 0.46)}px 'Noto Serif SC', 'SimSun', serif`;
      ctx.fillText(ZH_NUM[t.value - 1], cx, cy - fh * 0.08);
      // Small 萬 below
      ctx.font      = `${Math.round(fh * 0.20)}px 'Noto Serif SC', 'SimSun', serif`;
      ctx.fillText('萬', cx, cy + fh * 0.30);
      break;
    }

    // ── Circles (筒子) ────────────────────────────────────────────────────────
    case 'circles': {
      drawCircles(ctx, t.value, fx, fy, fw, fh);
      // Number top-left
      ctx.fillStyle = COLOR_CIRCLE;
      ctx.font      = `bold ${Math.round(fh * 0.18)}px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(String(t.value), fx + 4, fy + fh * 0.16);
      break;
    }

    // ── Bamboo (索子) ─────────────────────────────────────────────────────────
    case 'bamboo': {
      drawBamboo(ctx, t.value, fx, fy, fw, fh);
      // Number top-left
      ctx.fillStyle = COLOR_BAMBOO;
      ctx.font      = `bold ${Math.round(fh * 0.18)}px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(String(t.value), fx + 4, fy + fh * 0.16);
      break;
    }

    // ── Winds ─────────────────────────────────────────────────────────────────
    case 'wind': {
      ctx.fillStyle = COLOR_WIND;
      ctx.font      = `bold ${Math.round(fh * 0.48)}px 'Noto Serif SC', 'SimSun', serif`;
      ctx.fillText(WIND_CHAR[t.value - 1], cx, cy);
      // Small wind label
      const WIND_LABEL = ['Est','Sud','Ouest','Nord'];
      ctx.font      = `${Math.round(fh * 0.14)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillStyle = '#555';
      ctx.fillText(WIND_LABEL[t.value - 1], cx, fy + fh * 0.88);
      break;
    }

    // ── Dragons ───────────────────────────────────────────────────────────────
    case 'dragon': {
      const col = DRAGON_COL[t.value - 1];
      if (t.value === 3) {
        // Haku (白) — white tile with thick border rect
        ctx.strokeStyle = '#888';
        ctx.lineWidth   = 3;
        ctx.strokeRect(fx + fw * 0.15, fy + fh * 0.2, fw * 0.7, fh * 0.6);
        ctx.fillStyle = col;
        ctx.font = `bold ${Math.round(fh * 0.44)}px 'Noto Serif SC', 'SimSun', serif`;
        ctx.fillText(DRAGON_CHAR[t.value - 1], cx, cy);
      } else {
        ctx.fillStyle = col;
        ctx.font      = `bold ${Math.round(fh * 0.50)}px 'Noto Serif SC', 'SimSun', serif`;
        ctx.fillText(DRAGON_CHAR[t.value - 1], cx, cy);
      }
      break;
    }

    // ── Flowers ───────────────────────────────────────────────────────────────
    case 'flower': {
      ctx.fillStyle = COLOR_FLOWER;
      ctx.font      = `bold ${Math.round(fh * 0.42)}px 'Noto Serif SC', 'SimSun', serif`;
      ctx.fillText(FLOWER_CHAR[t.value - 1], cx, cy - fh * 0.06);
      ctx.font      = `${Math.round(fh * 0.16)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillStyle = '#aa4488';
      ctx.fillText('花', cx, fy + fh * 0.88);
      break;
    }

    // ── Seasons ───────────────────────────────────────────────────────────────
    case 'season': {
      ctx.fillStyle = COLOR_SEASON;
      ctx.font      = `bold ${Math.round(fh * 0.42)}px 'Noto Serif SC', 'SimSun', serif`;
      ctx.fillText(SEASON_CHAR[t.value - 1], cx, cy - fh * 0.06);
      ctx.font      = `${Math.round(fh * 0.16)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillStyle = '#6633aa';
      ctx.fillText('季', cx, fy + fh * 0.88);
      break;
    }
  }
  ctx.restore();
}

// ── Draw circles pattern ──────────────────────────────────────────────────────
function drawCircles(
  ctx: CanvasRenderingContext2D,
  count: number,
  fx: number, fy: number, fw: number, fh: number,
): void {
  // Layout grids for 1-9 circles
  const grids: [number, number][][] = [
    [[0.5, 0.5]],
    [[0.5, 0.32], [0.5, 0.68]],
    [[0.5, 0.22], [0.5, 0.5], [0.5, 0.78]],
    [[0.3, 0.32], [0.7, 0.32], [0.3, 0.68], [0.7, 0.68]],
    [[0.3, 0.25], [0.7, 0.25], [0.5, 0.5], [0.3, 0.75], [0.7, 0.75]],
    [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
    [[0.25,0.22],[0.5,0.22],[0.75,0.22],[0.25,0.5],[0.75,0.5],[0.25,0.78],[0.75,0.78]],
    [[0.25,0.22],[0.5,0.22],[0.75,0.22],[0.25,0.5],[0.75,0.5],[0.25,0.78],[0.5,0.78],[0.75,0.78]],
    [[0.25,0.22],[0.5,0.22],[0.75,0.22],[0.25,0.5],[0.5,0.5],[0.75,0.5],[0.25,0.78],[0.5,0.78],[0.75,0.78]],
  ];
  const positions = grids[count - 1];
  const r = Math.min(fw, fh) * 0.10;
  // Use area below the number label
  const areaY = fy + fh * 0.25;
  const areaH = fh * 0.68;

  ctx.save();
  for (const [px, py] of positions) {
    const cx = fx + fw * px;
    const cy = areaY + areaH * py;
    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_CIRCLE;
    ctx.fill();
    // Inner highlight
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#e8f0ff';
    ctx.fill();
  }
  ctx.restore();
}

// ── Draw bamboo stalk pattern ─────────────────────────────────────────────────
function drawBamboo(
  ctx: CanvasRenderingContext2D,
  count: number,
  fx: number, fy: number, fw: number, fh: number,
): void {
  // How many columns of stalks and rows
  const cols = count <= 3 ? 1 : count <= 6 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const colW = fw / (cols + 1);
  const rowH = (fh * 0.65) / (rows + 0.5);
  const startY = fy + fh * 0.26;
  const sw = colW * 0.30;  // stalk width

  ctx.save();
  let drawn = 0;
  outer:
  for (let c = 0; c < cols; c++) {
    const sx = fx + colW * (c + 0.8);
    for (let r = 0; r < rows; r++) {
      if (drawn >= count) break outer;
      const sy = startY + rowH * (r + 0.5);
      const sh = rowH * 0.82;

      // Stalk body
      ctx.fillStyle = COLOR_BAMBOO;
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);

      // Stalk node (horizontal bar)
      ctx.fillStyle = '#0d5c0d';
      ctx.fillRect(sx - sw * 0.7, sy, sw * 1.4, sh * 0.08);

      // Lighter highlight on stalk
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw * 0.3, sh);

      drawn++;
    }
  }
  ctx.restore();
}

// ── Draw a single tile ────────────────────────────────────────────────────────
function drawTile(
  ctx:    CanvasRenderingContext2D,
  tile:   Tile,
  state:  GameState,
  hint:   Set<number>,
  ox:     number,
  oy:     number,
): void {
  if (tile.removed) return;

  const x = tileX(tile.col, tile.layer) + ox;
  const y = tileY(tile.row, tile.layer) + oy;

  const free   = isFree(tile, state.tiles);
  const sel    = state.selected === tile.id;
  const hinted = hint.has(tile.id);

  // ── Right face (3-D) ──
  ctx.fillStyle = COL_SIDE_R;
  ctx.beginPath();
  ctx.moveTo(x + TW,         y + DEPTH);
  ctx.lineTo(x + TW + DEPTH, y);
  ctx.lineTo(x + TW + DEPTH, y + TH);
  ctx.lineTo(x + TW,         y + TH + DEPTH);
  ctx.closePath();
  ctx.fill();

  // ── Bottom face (3-D) ──
  ctx.fillStyle = COL_SIDE_B;
  ctx.beginPath();
  ctx.moveTo(x + DEPTH,        y + TH + DEPTH);
  ctx.lineTo(x + TW + DEPTH,   y + TH);
  ctx.lineTo(x + TW + DEPTH,   y + TH + DEPTH);  // not needed but keeps shape
  ctx.moveTo(x + DEPTH,        y + TH + DEPTH);
  ctx.lineTo(x + TW + DEPTH,   y + TH);
  ctx.lineTo(x + TW,           y + TH + DEPTH);
  ctx.closePath();
  ctx.fill();
  // simpler bottom strip
  ctx.fillStyle = COL_SIDE_B;
  ctx.fillRect(x + DEPTH, y + TH, TW - DEPTH, DEPTH);

  // ── Top face highlight (3-D) ──
  ctx.fillStyle = COL_TOP;
  ctx.fillRect(x, y, TW + DEPTH, DEPTH);
  ctx.fillRect(x, y, DEPTH, TH + DEPTH);

  // ── Main face ──
  const faceColor = sel    ? COL_FACE_SEL
                  : hinted ? COL_FACE_HINT
                  : free   ? COL_FACE_FREE
                  : COL_LOCKED;
  ctx.fillStyle = faceColor;
  roundRect(ctx, x + DEPTH, y + DEPTH, TW - DEPTH, TH - DEPTH, 4);
  ctx.fill();

  // ── Inner border ──
  ctx.strokeStyle = sel || hinted ? (sel ? '#b89800' : '#2a8a2a') : COL_BORDER;
  ctx.lineWidth   = sel || hinted ? 2 : 0.8;
  roundRect(ctx, x + DEPTH + 1, y + DEPTH + 1, TW - DEPTH - 2, TH - DEPTH - 2, 4);
  ctx.stroke();

  // ── Thin inner inset line (decorative) ──
  if (!sel && !hinted) {
    ctx.strokeStyle = 'rgba(120,100,80,0.25)';
    ctx.lineWidth   = 0.5;
    roundRect(ctx, x + DEPTH + 3, y + DEPTH + 3, TW - DEPTH - 6, TH - DEPTH - 6, 3);
    ctx.stroke();
  }

  // ── Tile face content ──
  if (free || sel || hinted) {
    drawTileFace(ctx, tile.typeIdx, x + DEPTH + 2, y + DEPTH + 2, TW - DEPTH - 4, TH - DEPTH - 4);
  } else {
    // Locked tiles: show a subtle pattern
    drawLockedFace(ctx, x + DEPTH, y + DEPTH, TW - DEPTH, TH - DEPTH);
  }
}

// ── Locked tile back pattern ──────────────────────────────────────────────────
function drawLockedFace(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(120,100,80,0.18)';
  ctx.lineWidth   = 1;
  const step = 10;
  for (let i = -h; i < w; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + Math.max(0, i), y);
    ctx.lineTo(x + Math.min(w, i + h), y + Math.min(h, h - Math.max(0, -i)));
    ctx.stroke();
  }
  ctx.restore();
}

// ── Compute bounding box ──────────────────────────────────────────────────────
export function computeBounds(tiles: Tile[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tiles) {
    const x = tileX(t.col, t.layer);
    const y = tileY(t.row, t.layer);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + TW + DEPTH > maxX) maxX = x + TW + DEPTH;
    if (y + TH + DEPTH > maxY) maxY = y + TH + DEPTH;
  }
  return { minX, minY, maxX, maxY };
}

// ── Main render ───────────────────────────────────────────────────────────────
export function render(
  canvas:  HTMLCanvasElement,
  state:   GameState,
  opts:    RenderOptions,
): void {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  const tiles = state.tiles.filter(t => !t.removed);
  if (tiles.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const { minX, minY, maxX, maxY } = computeBounds(tiles);
  const boardW = maxX - minX + 40;
  const boardH = maxY - minY + 40;

  const cssW = canvas.clientWidth  || boardW;
  const cssH = canvas.clientHeight || boardH;

  // Scale board to fit canvas if needed
  const scaleX = cssW / boardW;
  const scaleY = cssH / boardH;
  const scale  = Math.min(1, scaleX, scaleY);

  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.scale(dpr, dpr);
  }

  ctx.clearRect(0, 0, cssW, cssH);

  // Center & scale
  const ox = (cssW - boardW * scale) / 2 - minX * scale + 20 * scale;
  const oy = (cssH - boardH * scale) / 2 - minY * scale + 20 * scale;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // Sort: back layers first, then col left→right, then row top→bottom
  const sorted = [...state.tiles].sort((a, b) =>
    a.layer !== b.layer ? a.layer - b.layer : a.col !== b.col ? a.col - b.col : a.row - b.row
  );

  const hintSet = new Set<number>(opts.hint ?? []);

  for (const tile of sorted) {
    drawTile(ctx, tile, state, hintSet, 0, 0);
  }
  ctx.restore();
}

// ── Hit testing ───────────────────────────────────────────────────────────────
export function hitTest(
  canvas: HTMLCanvasElement,
  state:  GameState,
  cx:     number,
  cy:     number,
): number | null {
  const tiles = state.tiles.filter(t => !t.removed);
  if (tiles.length === 0) return null;

  const { minX, minY, maxX, maxY } = computeBounds(tiles);
  const cssW   = canvas.clientWidth;
  const cssH   = canvas.clientHeight;
  const boardW = maxX - minX + 40;
  const boardH = maxY - minY + 40;
  const scale  = Math.min(1, cssW / boardW, cssH / boardH);
  const ox     = (cssW - boardW * scale) / 2 - minX * scale + 20 * scale;
  const oy     = (cssH - boardH * scale) / 2 - minY * scale + 20 * scale;

  // Convert click to board coordinates
  const bx = (cx - ox) / scale;
  const by = (cy - oy) / scale;

  let best: Tile | null = null;
  for (const tile of tiles) {
    const tx = tileX(tile.col, tile.layer) + DEPTH;
    const ty = tileY(tile.row, tile.layer) + DEPTH;
    const tw = TW - DEPTH;
    const th = TH - DEPTH;
    if (bx >= tx && bx < tx + tw && by >= ty && by < ty + th) {
      if (!best || tile.layer > best.layer || (tile.layer === best.layer && tile.col > best.col)) {
        best = tile;
      }
    }
  }
  return best ? best.id : null;
}
