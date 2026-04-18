import type { Card, GameState } from './game';
import { isRed, rankLabel, SUIT_SYMBOL, canPickUp, canDrop } from './game';

// ── Layout constants ──────────────────────────────────────────────────────────
export const CARD_W    = 72;
export const CARD_H    = 100;
const GAP              = 8;
const MARGIN           = 12;
export const SLOT      = CARD_W + GAP;       // 80
const TOP_Y            = 12;
const TAB_Y            = TOP_Y + CARD_H + 18; // 130
const FACE_DOWN_OFF    = 18;
const FACE_UP_OFF      = 26;
const RADIUS           = 6;

// Foundation slots (top-right)
const FOUND_W          = 42;
const FOUND_H          = 58;
const FOUND_GAP        = 5;

// ── Computed positions ────────────────────────────────────────────────────────

export function canvasWidth(): number {
  return MARGIN + 10 * SLOT - GAP + MARGIN; // 12 + 800 - 8 + 12 = 816
}

function foundX(i: number): number {
  // Pack 8 slots flush against the right margin
  const W = canvasWidth();
  return W - MARGIN - (8 - i) * (FOUND_W + FOUND_GAP) + FOUND_GAP;
}

export function tabX(col: number): number {
  return MARGIN + col * SLOT;
}

export function cardYInCol(col: Card[], k: number): number {
  let y = TAB_Y;
  for (let i = 0; i < k; i++) {
    y += col[i].faceUp ? FACE_UP_OFF : FACE_DOWN_OFF;
  }
  return y;
}

function colBottomY(col: Card[]): number {
  if (col.length === 0) return TAB_Y + CARD_H;
  return cardYInCol(col, col.length - 1) + CARD_H;
}

export function canvasHeight(tableau: Card[][]): number {
  return Math.max(...tableau.map(colBottomY)) + MARGIN * 2;
}

// ── Drawing primitives ────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}

function drawCardBack(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  selected = false,
) {
  ctx.fillStyle = '#f0ede4';
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.fill();
  ctx.strokeStyle = selected ? '#d4aa40' : '#ccc';
  ctx.lineWidth   = selected ? 2.5 : 1;
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.stroke();

  ctx.fillStyle = '#1a3a6a';
  roundRect(ctx, x + 4, y + 4, CARD_W - 8, CARD_H - 8, RADIUS - 1);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x + 4, y + 4, CARD_W - 8, CARD_H - 8, RADIUS - 1);
  ctx.clip();
  ctx.strokeStyle = '#2a5a9a';
  ctx.lineWidth   = 1;
  for (let d = -CARD_H; d < CARD_W + CARD_H; d += 10) {
    ctx.beginPath();
    ctx.moveTo(x + 4 + d,         y + 4);
    ctx.lineTo(x + 4 + d + CARD_H, y + 4 + CARD_H);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEmptySlot(
  ctx:         CanvasRenderingContext2D,
  x: number,   y: number,
  w: number,   h: number,
  label        = '',
  validTarget  = false,
) {
  if (validTarget) {
    ctx.fillStyle = 'rgba(80,200,80,0.12)';
    roundRect(ctx, x, y, w, h, RADIUS);
    ctx.fill();
  }
  ctx.strokeStyle = validTarget ? '#60c060' : '#2a5a30';
  ctx.lineWidth   = validTarget ? 2.5 : 2;
  ctx.setLineDash([5, 4]);
  roundRect(ctx, x, y, w, h, RADIUS);
  ctx.stroke();
  ctx.setLineDash([]);

  if (label) {
    ctx.fillStyle    = validTarget ? '#60c060' : '#2a5a30';
    ctx.font         = `${Math.floor(h * 0.34)}px Arial`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }
}

function drawFaceUpCard(
  ctx:       CanvasRenderingContext2D,
  card:      Card,
  x: number, y: number,
  colorMode: boolean,
  selected:  boolean,
  validDrop: boolean,
) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  roundRect(ctx, x + 2, y + 2, CARD_W, CARD_H, RADIUS);
  ctx.fill();

  // Body
  ctx.fillStyle = selected ? '#fffbe6' : '#ffffff';
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.fill();
  ctx.strokeStyle = selected ? '#d4aa40' : validDrop ? '#40a840' : '#c8c8c8';
  ctx.lineWidth   = (selected || validDrop) ? 2.5 : 1;
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.stroke();

  // Face-card tint
  if (card.rank >= 11) {
    const tints: Record<number, string> = { 11: '#e8f0ff', 12: '#ffe8f4', 13: '#fff8e0' };
    ctx.fillStyle = tints[card.rank];
    roundRect(ctx, x + 1, y + 1, CARD_W - 2, CARD_H - 2, RADIUS - 1);
    ctx.fill();
  }

  const color = (colorMode && isRed(card.suit)) ? '#cc2222' : '#111111';
  const lbl   = rankLabel(card.rank);
  const sym   = SUIT_SYMBOL[card.suit];

  // Top-left
  ctx.fillStyle    = color;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';
  ctx.font         = 'bold 13px Arial';
  ctx.fillText(lbl, x + 5, y + 4);
  ctx.font         = '11px Arial';
  ctx.fillText(sym, x + 5, y + 19);

  // Bottom-right (rotated)
  ctx.save();
  ctx.translate(x + CARD_W - 5, y + CARD_H - 4);
  ctx.rotate(Math.PI);
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle    = color;
  ctx.font         = 'bold 13px Arial';
  ctx.fillText(lbl, 0, 0);
  ctx.font         = '11px Arial';
  ctx.fillText(sym, 0, 15);
  ctx.restore();

  // Centre
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = color;
  ctx.font         = card.rank >= 11 ? 'bold 32px Arial' : '26px Arial';
  ctx.fillText(sym, x + CARD_W / 2, y + CARD_H / 2 + 4);
}

// ── Selection type ────────────────────────────────────────────────────────────

export type Selection = { col: number; cardIndex: number } | null;

// ── Main render ───────────────────────────────────────────────────────────────

export function render(
  ctx:   CanvasRenderingContext2D,
  state: GameState,
  sel:   Selection,
): void {
  const { tableau, stock, completedSuits, mode } = state;
  const W = canvasWidth();
  const H = canvasHeight(tableau);
  const colorMode = mode === 'color';

  if (ctx.canvas.width !== W || ctx.canvas.height !== H) {
    ctx.canvas.width  = W;
    ctx.canvas.height = H;
  }

  // Felt background
  ctx.fillStyle = '#1a5c2a';
  ctx.fillRect(0, 0, W, H);

  // ── Stock pile ──
  if (stock.length > 0) {
    drawCardBack(ctx, MARGIN, TOP_Y);
    ctx.fillStyle    = 'rgba(255,255,255,0.60)';
    ctx.font         = 'bold 15px Arial';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(stock.length), MARGIN + CARD_W / 2, TOP_Y + CARD_H / 2);
  } else {
    drawEmptySlot(ctx, MARGIN, TOP_Y, CARD_W, CARD_H, '×');
  }

  // ── Info labels (centre-top) ──
  const infoX = MARGIN + CARD_W + 16;
  const fy0   = TOP_Y + (CARD_H - FOUND_H) / 2; // vertical centre for foundations
  ctx.fillStyle    = 'rgba(255,255,255,0.55)';
  ctx.font         = '13px Arial';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Séries : ${completedSuits.length} / 8`, infoX, fy0 + 4);
  ctx.fillText(`Coups  : ${state.moves}`,               infoX, fy0 + 22);

  // ── Foundation slots (top-right) ──
  for (let i = 0; i < 8; i++) {
    const fx = foundX(i);
    if (i < completedSuits.length) {
      const suit  = completedSuits[i];
      const color = (colorMode && isRed(suit)) ? '#aa2020' : '#1a3a6a';
      ctx.fillStyle = '#f0ede4';
      roundRect(ctx, fx, fy0, FOUND_W, FOUND_H, 4);
      ctx.fill();
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth   = 1;
      roundRect(ctx, fx, fy0, FOUND_W, FOUND_H, 4);
      ctx.stroke();
      ctx.fillStyle    = color;
      ctx.font         = '22px Arial';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SUIT_SYMBOL[suit], fx + FOUND_W / 2, fy0 + FOUND_H / 2);
    } else {
      drawEmptySlot(ctx, fx, fy0, FOUND_W, FOUND_H, '♠');
    }
  }

  // ── Separator line ──
  ctx.strokeStyle = 'rgba(0,0,0,0.20)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(MARGIN, TAB_Y - 8);
  ctx.lineTo(W - MARGIN, TAB_Y - 8);
  ctx.stroke();

  // ── Valid-drop columns (computed before drawing tableau) ──
  const validCols = new Set<number>();
  if (sel !== null) {
    const pickedCards = tableau[sel.col].slice(sel.cardIndex);
    for (let c = 0; c < 10; c++) {
      if (c !== sel.col && canDrop(pickedCards, tableau[c])) {
        validCols.add(c);
      }
    }
  }

  // ── Tableau ──
  for (let col = 0; col < 10; col++) {
    const cx = tabX(col);

    if (tableau[col].length === 0) {
      drawEmptySlot(ctx, cx, TAB_Y, CARD_W, CARD_H, '', validCols.has(col));
      continue;
    }

    for (let k = 0; k < tableau[col].length; k++) {
      const card   = tableau[col][k];
      const cy     = cardYInCol(tableau[col], k);
      const isSel  = sel !== null && sel.col === col && k >= sel.cardIndex;
      // Highlight the top card of a valid destination column
      const isDrop = !isSel && k === tableau[col].length - 1 && validCols.has(col);

      if (!card.faceUp) {
        drawCardBack(ctx, cx, cy, isSel);
      } else {
        drawFaceUpCard(ctx, card, cx, cy, colorMode, isSel, isDrop);
      }
    }
  }
}

// ── Hit-testing ───────────────────────────────────────────────────────────────

export type HitResult =
  | { area: 'stock' }
  | { area: 'tableau'; col: number; cardIndex: number }
  | { area: 'none' };

export function hitTest(mx: number, my: number, state: GameState): HitResult {
  const { tableau, stock } = state;

  function inRect(x: number, y: number, w: number, h: number) {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  // Stock
  if (stock.length > 0 && inRect(MARGIN, TOP_Y, CARD_W, CARD_H)) {
    return { area: 'stock' };
  }

  // Tableau
  for (let col = 0; col < 10; col++) {
    const cx = tabX(col);
    if (mx < cx || mx > cx + CARD_W) continue;

    const cards = tableau[col];

    if (cards.length === 0) {
      if (my >= TAB_Y && my <= TAB_Y + CARD_H) {
        return { area: 'tableau', col, cardIndex: 0 };
      }
      continue;
    }

    // Iterate from top (last) to bottom (first) to find the clicked card
    for (let k = cards.length - 1; k >= 0; k--) {
      const top    = cardYInCol(cards, k);
      const bottom = k === cards.length - 1 ? top + CARD_H : cardYInCol(cards, k + 1);
      if (my >= top && my <= bottom) {
        return { area: 'tableau', col, cardIndex: k };
      }
    }
  }

  return { area: 'none' };
}

// ── Sequence analysis (for visual hint on tableau) ───────────────────────────

/**
 * Returns the index of the first card in the longest same-suit descending
 * run at the bottom of a column (useful for highlighting moveable groups).
 */
export function mobileRunStart(col: Card[]): number {
  if (col.length === 0) return 0;
  let start = col.length - 1;
  while (
    start > 0 &&
    col[start].faceUp &&
    col[start - 1].faceUp &&
    col[start - 1].suit === col[start].suit &&
    col[start - 1].rank === col[start].rank + 1
  ) {
    start--;
  }
  return start;
}

export { canPickUp };
