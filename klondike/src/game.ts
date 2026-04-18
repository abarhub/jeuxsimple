// ── Types ──────────────────────────────────────────────────────────────────────
export type Suit      = 'S' | 'C' | 'H' | 'D';
export type Rank      = 1|2|3|4|5|6|7|8|9|10|11|12|13;
export type ColorMode = 'normal' | 'mono';

export interface Card {
  suit:   Suit;
  rank:   Rank;
  faceUp: boolean;
}

export interface GameState {
  stock:       Card[];
  waste:       Card[];
  foundations: Card[][];   // 4 piles : S, C, H, D
  tableau:     Card[][];   // 7 colonnes
  moves:       number;
  won:         boolean;
  mode:        ColorMode;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const SUITS: Suit[] = ['S', 'C', 'H', 'D'];
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', C: '♣', H: '♥', D: '♦' };

export function isRed(card: Card): boolean {
  return card.suit === 'H' || card.suit === 'D';
}

export function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

export function rankLabel(rank: Rank): string {
  if (rank === 1)  return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return rank.toString();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function flipTopIfNeeded(col: Card[]): Card[] {
  if (col.length === 0) return col;
  const last = col[col.length - 1];
  if (last.faceUp) return col;
  return [...col.slice(0, -1), { ...last, faceUp: true }];
}

function checkWon(state: GameState): boolean {
  return state.foundations.every(f => f.length === 13);
}

// ── Création d'une partie ──────────────────────────────────────────────────────
export function newGame(mode: ColorMode): GameState {
  const deck: Card[] = shuffle(
    SUITS.flatMap(suit =>
      Array.from({ length: 13 }, (_, i) => ({ suit, rank: (i + 1) as Rank, faceUp: false }))
    )
  );

  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      tableau[col].push({ ...deck[idx++], faceUp: row === col });
    }
  }

  return {
    stock:       deck.slice(idx).map(c => ({ ...c, faceUp: false })),
    waste:       [],
    foundations: [[], [], [], []],
    tableau,
    moves:       0,
    won:         false,
    mode,
  };
}

// ── Règles ────────────────────────────────────────────────────────────────────
export function canPlaceOnTableau(card: Card, col: Card[], mode: ColorMode): boolean {
  if (col.length === 0) return card.rank === 13; // seul un Roi sur colonne vide
  const top = col[col.length - 1];
  if (!top.faceUp) return false;
  if (card.rank !== top.rank - 1) return false;
  // Mode normal : couleurs alternées. Mode mono : toutes couleurs acceptées.
  return mode === 'mono' || isRed(card) !== isRed(top);
}

export function canPlaceOnFoundation(card: Card, foundation: Card[]): boolean {
  if (foundation.length === 0) return card.rank === 1;
  const top = foundation[foundation.length - 1];
  return card.suit === top.suit && card.rank === top.rank + 1;
}

// ── Actions ────────────────────────────────────────────────────────────────────

/** Retourner une carte du talon */
export function drawFromStock(state: GameState): GameState {
  if (state.stock.length === 0) {
    // Recycler la défausse
    if (state.waste.length === 0) return state;
    return {
      ...state,
      stock: [...state.waste].reverse().map(c => ({ ...c, faceUp: false })),
      waste: [],
      moves: state.moves + 1,
    };
  }
  const card = { ...state.stock[state.stock.length - 1], faceUp: true };
  return {
    ...state,
    stock: state.stock.slice(0, -1),
    waste: [...state.waste, card],
    moves: state.moves + 1,
  };
}

/** Défausse → tableau */
export function moveWasteToTableau(state: GameState, toCol: number): GameState | null {
  if (state.waste.length === 0) return null;
  const card = state.waste[state.waste.length - 1];
  if (!canPlaceOnTableau(card, state.tableau[toCol], state.mode)) return null;
  return {
    ...state,
    waste:   state.waste.slice(0, -1),
    tableau: state.tableau.map((col, i) => i === toCol ? [...col, card] : col),
    moves:   state.moves + 1,
  };
}

/** Défausse → fondation */
export function moveWasteToFoundation(state: GameState): GameState | null {
  if (state.waste.length === 0) return null;
  const card = state.waste[state.waste.length - 1];
  const fi = suitIndex(card.suit);
  if (!canPlaceOnFoundation(card, state.foundations[fi])) return null;
  const ns = {
    ...state,
    waste:       state.waste.slice(0, -1),
    foundations: state.foundations.map((f, i) => i === fi ? [...f, card] : f),
    moves:       state.moves + 1,
  };
  return { ...ns, won: checkWon(ns) };
}

/** Tableau → tableau (déplace cardIndex..end) */
export function moveTableauToTableau(
  state: GameState, fromCol: number, cardIdx: number, toCol: number
): GameState | null {
  const col = state.tableau[fromCol];
  if (cardIdx >= col.length || !col[cardIdx].faceUp) return null;
  const cards = col.slice(cardIdx);
  if (!canPlaceOnTableau(cards[0], state.tableau[toCol], state.mode)) return null;
  const newFrom = flipTopIfNeeded(col.slice(0, cardIdx));
  return {
    ...state,
    tableau: state.tableau.map((c, i) => {
      if (i === fromCol) return newFrom;
      if (i === toCol)   return [...c, ...cards];
      return c;
    }),
    moves: state.moves + 1,
  };
}

/** Tableau (top) → fondation */
export function moveTableauToFoundation(state: GameState, fromCol: number): GameState | null {
  const col = state.tableau[fromCol];
  if (col.length === 0) return null;
  const card = col[col.length - 1];
  if (!card.faceUp) return null;
  const fi = suitIndex(card.suit);
  if (!canPlaceOnFoundation(card, state.foundations[fi])) return null;
  const newFrom = flipTopIfNeeded(col.slice(0, -1));
  const ns = {
    ...state,
    tableau:     state.tableau.map((c, i) => i === fromCol ? newFrom : c),
    foundations: state.foundations.map((f, i) => i === fi ? [...f, card] : f),
    moves:       state.moves + 1,
  };
  return { ...ns, won: checkWon(ns) };
}

/** Fondation → tableau */
export function moveFoundationToTableau(
  state: GameState, foundIdx: number, toCol: number
): GameState | null {
  const f = state.foundations[foundIdx];
  if (f.length === 0) return null;
  const card = f[f.length - 1];
  if (!canPlaceOnTableau(card, state.tableau[toCol], state.mode)) return null;
  return {
    ...state,
    foundations: state.foundations.map((fi, i) => i === foundIdx ? fi.slice(0, -1) : fi),
    tableau:     state.tableau.map((col, i) => i === toCol ? [...col, card] : col),
    moves:       state.moves + 1,
  };
}

/** Essaie de tout envoyer sur les fondations automatiquement */
export function autoComplete(state: GameState): GameState {
  let s = state;
  let changed = true;
  while (changed && !s.won) {
    changed = false;
    const w = moveWasteToFoundation(s);
    if (w) { s = w; changed = true; continue; }
    for (let col = 0; col < 7; col++) {
      const t = moveTableauToFoundation(s, col);
      if (t) { s = t; changed = true; break; }
    }
  }
  return s;
}
