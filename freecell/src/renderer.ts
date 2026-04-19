// ── FreeCell canvas renderer ──────────────────────────────────────────────────
import { type GameState, type Card, cardColor } from './game';

// Card dimensions
export const CW  = 71;   // card width
export const CH  = 96;   // card height
export const RAD = 6;    // corner radius
const PAD    = 10;        // outer padding
const HGAP   = 8;         // horizontal gap between columns
const SPREAD  = 28;       // vertical spread for face-up tableau cards

// Top row y
const TOP_Y  = PAD;
// Tableau y
const TAB_Y  = TOP_Y + CH + PAD + 8;

// Suit symbols & colors
const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_LABEL  = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Selection / hint highlight ids
export type Zone =
  | { area: 'freecell'; idx: number }
  | { area: 'foundation'; idx: number }
  | { area: 'tableau'; col: number; cardIdx: number };

// ── Geometry helpers ──────────────────────────────────────────────────────────

function colX(col: number, canvasW: number): number {
  const totalW = 8 * CW + 7 * HGAP;
  const left   = (canvasW - totalW) / 2;
  return left + col * (CW + HGAP);
}

function freecellX(idx: number, canvasW: number): number {
  const totalW = 8 * CW + 7 * HGAP;
  const left   = (canvasW - totalW) / 2;
  return left + idx * (CW + HGAP);
}

function foundationX(idx: number, canvasW: number): number {
  const totalW = 8 * CW + 7 * HGAP;
  const left   = (canvasW - totalW) / 2;
  return left + (4 + idx) * (CW + HGAP);
}

// ── Drawing primitives ────────────────────────────────────────────────────────

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

function drawEmptySlot(ctx: CanvasRenderingContext2D, x: number, y: number, label = ''): void {
  ctx.save();
  roundRect(ctx, x, y, CW, CH, RAD);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.fillStyle   = 'rgba(0,0,0,0.15)';
  ctx.fill();
  if (label) {
    ctx.fillStyle   = 'rgba(255,255,255,0.25)';
    ctx.font        = `bold 18px serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + CW / 2, y + CH / 2);
  }
  ctx.restore();
}

function drawCard(
  ctx:       CanvasRenderingContext2D,
  card:      Card,
  x:         number,
  y:         number,
  selected:  boolean,
  hinted:    boolean,
): void {
  const isRed = cardColor(card) === 'red';
  const fg    = isRed ? '#c8000a' : '#0a0a0a';

  ctx.save();
  roundRect(ctx, x, y, CW, CH, RAD);

  // Shadow
  ctx.shadowColor   = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur    = 6;
  ctx.shadowOffsetY = 2;

  // Face
  ctx.fillStyle = selected ? '#fff9c4'
                : hinted   ? '#c8f0c8'
                : '#f8f6f2';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Border
  ctx.strokeStyle = selected ? '#c8a800'
                  : hinted   ? '#2a9a2a'
                  : 'rgba(0,0,0,0.25)';
  ctx.lineWidth   = selected || hinted ? 2.5 : 1;
  ctx.stroke();

  // Rank + suit (top-left)
  const suit   = SUIT_SYMBOL[card.suit];
  const rank   = RANK_LABEL[card.rank];
  ctx.fillStyle    = fg;
  ctx.font         = `bold 13px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(rank, x + 4, y + 3);
  ctx.font = `13px serif`;
  ctx.fillText(suit, x + 4, y + 17);

  // Center suit
  ctx.font         = `bold 32px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(suit, x + CW / 2, y + CH / 2);

  // Bottom-right (rotated)
  ctx.save();
  ctx.translate(x + CW - 4, y + CH - 3);
  ctx.rotate(Math.PI);
  ctx.font         = `bold 13px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(rank, 0, 0);
  ctx.font = `13px serif`;
  ctx.fillText(suit, 0, 14);
  ctx.restore();

  ctx.restore();
}

// ── Hit zones (for click detection) ──────────────────────────────────────────

export interface HitZone {
  zone: Zone;
  x: number; y: number; w: number; h: number;
}

function buildHitZones(state: GameState, canvasW: number): HitZone[] {
  const zones: HitZone[] = [];

  // Freecells
  for (let i = 0; i < 4; i++) {
    zones.push({ zone: { area: 'freecell', idx: i }, x: freecellX(i, canvasW), y: TOP_Y, w: CW, h: CH });
  }
  // Foundations
  for (let i = 0; i < 4; i++) {
    zones.push({ zone: { area: 'foundation', idx: i }, x: foundationX(i, canvasW), y: TOP_Y, w: CW, h: CH });
  }
  // Tableau (bottom card of each visible pile is the hit target for the whole pile)
  for (let col = 0; col < 8; col++) {
    const pile = state.tableau[col];
    const x    = colX(col, canvasW);
    if (pile.length === 0) {
      zones.push({ zone: { area: 'tableau', col, cardIdx: 0 }, x, y: TAB_Y, w: CW, h: CH });
    } else {
      pile.forEach((_, ci) => {
        const y  = TAB_Y + ci * SPREAD;
        const h  = ci < pile.length - 1 ? SPREAD : CH;
        zones.push({ zone: { area: 'tableau', col, cardIdx: ci }, x, y, w: CW, h });
      });
    }
  }
  return zones;
}

export function hitTest(state: GameState, canvasW: number, cx: number, cy: number): Zone | null {
  const zones = buildHitZones(state, canvasW).reverse(); // top-most first
  for (const hz of zones) {
    if (cx >= hz.x && cx < hz.x + hz.w && cy >= hz.y && cy < hz.y + hz.h) {
      return hz.zone;
    }
  }
  return null;
}

// ── Render ────────────────────────────────────────────────────────────────────

export interface RenderOptions {
  selected: Zone | null;
  hint:     Zone | null;
}

export function computeCanvasHeight(state: GameState): number {
  const maxLen = Math.max(...state.tableau.map(col => col.length), 1);
  return TAB_Y + (maxLen - 1) * SPREAD + CH + PAD;
}

export function render(canvas: HTMLCanvasElement, state: GameState, opts: RenderOptions): void {
  const ctx  = canvas.getContext('2d')!;
  const dpr  = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;

  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.scale(dpr, dpr);
  }
  ctx.clearRect(0, 0, cssW, cssH);

  const SUIT_FOUND = ['♠', '♥', '♦', '♣'];

  // ── Freecells ──
  for (let i = 0; i < 4; i++) {
    const x    = freecellX(i, cssW);
    const card = state.freecells[i];
    const sel  = opts.selected?.area === 'freecell' && opts.selected.idx === i;
    const hint = opts.hint?.area === 'freecell' && opts.hint.idx === i;
    if (!card) {
      drawEmptySlot(ctx, x, TOP_Y);
    } else {
      drawCard(ctx, card, x, TOP_Y, sel, hint);
    }
  }

  // ── Foundations ──
  for (let i = 0; i < 4; i++) {
    const x    = foundationX(i, cssW);
    const top  = state.foundations[i];
    const hint = opts.hint?.area === 'foundation' && opts.hint.idx === i;
    drawEmptySlot(ctx, x, TOP_Y, SUIT_FOUND[i]);
    if (top > 0) {
      const card: Card = { rank: top, suit: (['S','H','D','C'] as const)[i] };
      drawCard(ctx, card, x, TOP_Y, false, hint);
    }
  }

  // ── Tableau ──
  for (let col = 0; col < 8; col++) {
    const pile = state.tableau[col];
    const x    = colX(col, cssW);
    drawEmptySlot(ctx, x, TAB_Y);

    pile.forEach((card, ci) => {
      const y    = TAB_Y + ci * SPREAD;
      const sel  = opts.selected?.area === 'tableau' && opts.selected.col === col && opts.selected.cardIdx === ci;
      const hint = opts.hint?.area === 'tableau' && opts.hint.col === col && opts.hint.cardIdx === ci;
      // Highlight the whole selected sequence
      const selSeq = opts.selected?.area === 'tableau' && opts.selected.col === col && ci >= opts.selected.cardIdx;
      drawCard(ctx, card, x, y, sel || selSeq, hint);
    });
  }
}
