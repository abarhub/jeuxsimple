// ── Canvas renderer for Mahjong Solitaire ────────────────────────────────────
import { type GameState, type Tile, isFree } from './game';
import { ALL_TILE_TYPES } from './tiles';

// Tile dimensions in canvas pixels
const TW = 48;   // tile width  (corresponds to 2 half-units)
const TH = 60;   // tile height (corresponds to 2 half-units)
const DEPTH = 6; // 3-D shadow offset per layer

// Colors
const COL_FACE_FREE = '#fffef8';
const COL_FACE_SEL  = '#ffe680';
const COL_FACE_HINT = '#b8f0b8';
const COL_TOP       = '#ddd8cc';
const COL_SIDE      = '#b0a898';
const COL_BORDER    = '#7a6a5a';
const COL_TEXT      = '#1a1a1a';
const COL_LOCKED    = '#ccc8bc';  // face of a locked tile

export interface RenderOptions {
  hint: [number, number] | null;
}

// ── Coordinate mapping ────────────────────────────────────────────────────────
// Each position [col, row, layer] in half-tile units maps to canvas coords.
// Half a tile = TW/2 in x, TH/2 in y.
// Layer shifts tile up-left (3-D effect).
function tileX(col: number, layer: number): number {
  return col * (TW / 2) + (DEPTH * layer);
}
function tileY(row: number, layer: number): number {
  return row * (TH / 2) - (DEPTH * layer);
}

// ── Drawing a single tile ─────────────────────────────────────────────────────
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

  const free = isFree(tile, state.tiles);
  const sel  = state.selected === tile.id;
  const hinted = hint.has(tile.id);

  // ── 3-D side (right + bottom strips) ──
  if (tile.layer > 0 || true) {
    ctx.fillStyle = COL_SIDE;
    // Right face
    ctx.fillRect(x + TW, y + DEPTH, DEPTH, TH);
    // Bottom face
    ctx.fillRect(x + DEPTH, y + TH, TW, DEPTH);
  }

  // ── Top face (3-D top-left offset) ──
  ctx.fillStyle = COL_TOP;
  ctx.fillRect(x, y, TW + DEPTH, DEPTH);
  ctx.fillRect(x, y, DEPTH, TH + DEPTH);

  // ── Main face ──
  ctx.fillStyle = sel ? COL_FACE_SEL
                : hinted ? COL_FACE_HINT
                : free ? COL_FACE_FREE
                : COL_LOCKED;
  ctx.fillRect(x + DEPTH, y + DEPTH, TW - DEPTH, TH - DEPTH);

  // ── Border ──
  ctx.strokeStyle = COL_BORDER;
  ctx.lineWidth   = 1;
  ctx.strokeRect(x + DEPTH + 0.5, y + DEPTH + 0.5, TW - DEPTH - 1, TH - DEPTH - 1);

  // ── Tile symbol ──
  const label = ALL_TILE_TYPES[tile.typeIdx].label;
  const faceW = TW - DEPTH;
  const faceH = TH - DEPTH;
  ctx.fillStyle = COL_TEXT;
  ctx.font = `${Math.round(faceH * 0.55)}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + DEPTH + faceW / 2, y + DEPTH + faceH / 2);
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
  const boardW = maxX - minX + 32;
  const boardH = maxY - minY + 32;

  // Resize canvas if needed
  const cssW = canvas.clientWidth  || boardW;
  const cssH = canvas.clientHeight || boardH;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.scale(dpr, dpr);
  }

  ctx.clearRect(0, 0, cssW, cssH);

  // Center board in canvas
  const ox = (cssW - boardW) / 2 - minX + 16;
  const oy = (cssH - boardH) / 2 - minY + 16;

  // Sort: paint back layers first, then left→right within same layer
  const sorted = [...state.tiles].sort((a, b) =>
    a.layer !== b.layer ? a.layer - b.layer : a.col !== b.col ? a.col - b.col : a.row - b.row
  );

  const hintSet = new Set<number>(opts.hint ?? []);

  for (const tile of sorted) {
    drawTile(ctx, tile, state, hintSet, ox, oy);
  }
}

// ── Hit testing ───────────────────────────────────────────────────────────────
/**
 * Given a click at (cx, cy) in canvas CSS coordinates, returns the topmost tile id
 * (highest layer wins, then rightmost col for same layer).
 */
export function hitTest(
  canvas: HTMLCanvasElement,
  state:  GameState,
  cx:     number,
  cy:     number,
): number | null {
  const tiles = state.tiles.filter(t => !t.removed);
  if (tiles.length === 0) return null;

  const { minX, minY, maxX, maxY } = computeBounds(tiles);
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const boardW = maxX - minX + 32;
  const boardH = maxY - minY + 32;
  const ox = (cssW - boardW) / 2 - minX + 16;
  const oy = (cssH - boardH) / 2 - minY + 16;

  // Collect all tiles containing the click point, pick topmost
  let best: Tile | null = null;
  for (const tile of tiles) {
    const x = tileX(tile.col, tile.layer) + ox + DEPTH;
    const y = tileY(tile.row, tile.layer) + oy + DEPTH;
    const w = TW - DEPTH;
    const h = TH - DEPTH;
    if (cx >= x && cx < x + w && cy >= y && cy < y + h) {
      if (!best || tile.layer > best.layer || (tile.layer === best.layer && tile.col > best.col)) {
        best = tile;
      }
    }
  }
  return best ? best.id : null;
}
