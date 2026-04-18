import type { Card, GameState, ColorMode } from './game';
import { isRed, rankLabel, SUIT_SYMBOL } from './game';

// ── Dimensions ────────────────────────────────────────────────────────────────
export const CARD_W  = 82;
export const CARD_H  = 118;
const GAP            = 10;
const SLOT           = CARD_W + GAP;
const MARGIN         = 12;
const TOP_Y          = MARGIN;
const TAB_Y          = TOP_Y + CARD_H + GAP * 3;
const FACE_DOWN_OFF  = 22;
const FACE_UP_OFF    = 36;
const RADIUS         = 7;

// ── Positions ─────────────────────────────────────────────────────────────────
export const STOCK_X = MARGIN;
export const WASTE_X = MARGIN + SLOT;
// Slot 2 (MARGIN + 2*SLOT) = vide (séparateur)
export function foundX(i: number): number { return MARGIN + (3 + i) * SLOT; }
export function tabX(col: number): number { return MARGIN + col * SLOT; }
export function canvasWidth(): number     { return MARGIN + 7 * SLOT - GAP + MARGIN; }

/** Y de la carte k dans une colonne (base = TAB_Y) */
export function cardYInCol(col: Card[], k: number): number {
  let y = TAB_Y;
  for (let i = 0; i < k; i++) y += col[i].faceUp ? FACE_UP_OFF : FACE_DOWN_OFF;
  return y;
}

function colBottomY(col: Card[]): number {
  if (col.length === 0) return TAB_Y + CARD_H;
  return cardYInCol(col, col.length - 1) + CARD_H;
}

export function canvasHeight(tableau: Card[][]): number {
  return Math.max(...tableau.map(colBottomY)) + MARGIN * 2;
}

// ── Utilitaires canvas ────────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Dessin des cartes ─────────────────────────────────────────────────────────
function drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number, selected = false) {
  // Fond blanc
  ctx.fillStyle = '#f8f4ec';
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.fill();
  ctx.strokeStyle = selected ? '#d4aa40' : '#ccc';
  ctx.lineWidth   = selected ? 3 : 1;
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.stroke();

  // Partie intérieure bleue avec motif
  ctx.fillStyle = '#1a3a6a';
  roundRect(ctx, x + 5, y + 5, CARD_W - 10, CARD_H - 10, RADIUS - 2);
  ctx.fill();

  // Motif de lignes diagonales
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x + 5, y + 5, CARD_W - 10, CARD_H - 10, RADIUS - 2);
  ctx.clip();
  ctx.strokeStyle = '#2a5a9a';
  ctx.lineWidth   = 1;
  for (let d = -(CARD_H); d < CARD_W + CARD_H; d += 10) {
    ctx.beginPath();
    ctx.moveTo(x + 5 + d, y + 5);
    ctx.lineTo(x + 5 + d + CARD_H, y + 5 + CARD_H);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEmptySlot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  label = '',
  color = '#2a5a30'
) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.setLineDash([6, 4]);
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.stroke();
  ctx.setLineDash([]);
  if (label) {
    ctx.fillStyle  = color;
    ctx.font       = '26px Arial';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + CARD_W / 2, y + CARD_H / 2);
  }
}

function drawFaceUpCard(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number, y: number,
  mode: ColorMode,
  selected: boolean
) {
  // Ombre
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  roundRect(ctx, x + 3, y + 3, CARD_W, CARD_H, RADIUS);
  ctx.fill();

  // Fond
  ctx.fillStyle = selected ? '#fffbe6' : '#ffffff';
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.fill();
  ctx.strokeStyle = selected ? '#d4aa40' : '#c8c8c8';
  ctx.lineWidth   = selected ? 2.5 : 1;
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.stroke();

  // Bande colorée pour les figures (J, Q, K)
  if (card.rank >= 11) {
    const faceColors: Record<number, string> = { 11: '#e8f0ff', 12: '#ffe8f0', 13: '#fff8e0' };
    ctx.fillStyle = faceColors[card.rank];
    roundRect(ctx, x + 1, y + 1, CARD_W - 2, CARD_H - 2, RADIUS - 1);
    ctx.fill();
  }

  const color = (mode === 'normal' && isRed(card)) ? '#cc1111' : '#111111';
  const lbl   = rankLabel(card.rank);
  const sym   = SUIT_SYMBOL[card.suit];

  // Coin haut-gauche
  ctx.fillStyle    = color;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';
  ctx.font         = 'bold 16px Arial';
  ctx.fillText(lbl, x + 6, y + 5);
  ctx.font         = '14px Arial';
  ctx.fillText(sym, x + 6, y + 22);

  // Coin bas-droite (retourné)
  ctx.save();
  ctx.translate(x + CARD_W - 6, y + CARD_H - 5);
  ctx.rotate(Math.PI);
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle    = color;
  ctx.font         = 'bold 16px Arial';
  ctx.fillText(lbl, 0, 0);
  ctx.font         = '14px Arial';
  ctx.fillText(sym, 0, 17);
  ctx.restore();

  // Symbole central grand
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = color;
  ctx.font         = card.rank >= 11 ? 'bold 42px Arial' : '34px Arial';
  ctx.fillText(sym, x + CARD_W / 2, y + CARD_H / 2 + 4);
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number, y: number,
  mode: ColorMode,
  selected: boolean
) {
  if (!card.faceUp) {
    drawCardBack(ctx, x, y, selected);
  } else {
    drawFaceUpCard(ctx, card, x, y, mode, selected);
  }
}

// ── Sélection ─────────────────────────────────────────────────────────────────
export type Selection =
  | { src: 'waste' }
  | { src: 'tableau';    col: number; cardIndex: number }
  | { src: 'foundation'; foundIdx: number }
  | null;

function isSelected(sel: Selection, area: string, col?: number, k?: number, fi?: number): boolean {
  if (!sel) return false;
  if (area === 'waste'       && sel.src === 'waste') return true;
  if (area === 'foundation'  && sel.src === 'foundation' && sel.foundIdx === fi) return true;
  if (area === 'tableau'     && sel.src === 'tableau' && sel.col === col && k !== undefined
      && sel.cardIndex !== undefined && k >= sel.cardIndex) return true;
  return false;
}

// ── Rendu principal ────────────────────────────────────────────────────────────
export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  sel: Selection
): void {
  const { stock, waste, foundations, tableau, mode } = state;
  const W = canvasWidth();
  const H = canvasHeight(tableau);

  if (ctx.canvas.width !== W || ctx.canvas.height !== H) {
    ctx.canvas.width  = W;
    ctx.canvas.height = H;
  }

  // Fond tapis vert
  ctx.fillStyle = '#1a5c2a';
  ctx.fillRect(0, 0, W, H);

  // ── Talon (stock) ──
  if (stock.length > 0) {
    drawCardBack(ctx, STOCK_X, TOP_Y);
    ctx.fillStyle    = 'rgba(255,255,255,0.55)';
    ctx.font         = 'bold 13px Arial';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(stock.length), STOCK_X + CARD_W / 2, TOP_Y + CARD_H / 2);
  } else {
    drawEmptySlot(ctx, STOCK_X, TOP_Y, waste.length > 0 ? '↺' : '×');
  }

  // ── Défausse (waste) ──
  if (waste.length > 0) {
    const top = waste[waste.length - 1];
    drawCard(ctx, top, WASTE_X, TOP_Y, mode, isSelected(sel, 'waste'));
    if (waste.length > 1) {
      ctx.fillStyle    = 'rgba(255,255,255,0.35)';
      ctx.font         = '11px Arial';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`+${waste.length - 1}`, WASTE_X + 2, TOP_Y + CARD_H + 6);
    }
  } else {
    drawEmptySlot(ctx, WASTE_X, TOP_Y);
  }

  // ── Fondations ──
  const foundSymbols = ['♠', '♣', '♥', '♦'];
  const foundColors  = mode === 'normal'
    ? ['#888', '#888', '#c44', '#c44']
    : ['#888', '#888', '#888', '#888'];

  for (let i = 0; i < 4; i++) {
    const fx = foundX(i);
    if (foundations[i].length > 0) {
      drawCard(ctx, foundations[i][foundations[i].length - 1], fx, TOP_Y, mode,
               isSelected(sel, 'foundation', undefined, undefined, i));
    } else {
      drawEmptySlot(ctx, fx, TOP_Y, foundSymbols[i], foundColors[i]);
    }
  }

  // ── Tableau ──
  for (let col = 0; col < 7; col++) {
    const cx = tabX(col);
    if (tableau[col].length === 0) {
      drawEmptySlot(ctx, cx, TAB_Y, '♔', '#2a5a30');
      continue;
    }
    for (let k = 0; k < tableau[col].length; k++) {
      drawCard(
        ctx, tableau[col][k], cx, cardYInCol(tableau[col], k), mode,
        isSelected(sel, 'tableau', col, k)
      );
    }
  }
}

// ── Hit-testing ───────────────────────────────────────────────────────────────
export type HitResult =
  | { area: 'stock' }
  | { area: 'waste' }
  | { area: 'foundation'; index: number }
  | { area: 'tableau';    col: number; cardIndex: number }
  | { area: 'none' };

export function hitTest(mx: number, my: number, state: GameState): HitResult {
  const { stock, waste, tableau } = state;

  function inRect(x: number, y: number) {
    return mx >= x && mx <= x + CARD_W && my >= y && my <= y + CARD_H;
  }

  // Talon
  if (inRect(STOCK_X, TOP_Y) && (stock.length > 0 || waste.length > 0)) {
    return { area: 'stock' };
  }

  // Défausse
  if (waste.length > 0 && inRect(WASTE_X, TOP_Y)) {
    return { area: 'waste' };
  }

  // Fondations
  for (let i = 0; i < 4; i++) {
    if (inRect(foundX(i), TOP_Y)) return { area: 'foundation', index: i };
  }

  // Tableau
  for (let col = 0; col < 7; col++) {
    const cx = tabX(col);
    if (mx < cx || mx > cx + CARD_W) continue;

    const cards = tableau[col];

    // Colonne vide : zone de dépôt
    if (cards.length === 0) {
      if (my >= TAB_Y && my <= TAB_Y + CARD_H) {
        return { area: 'tableau', col, cardIndex: 0 };
      }
      continue;
    }

    // Chercher la carte cliquée (de haut en bas visuellement = du dernier au premier)
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
