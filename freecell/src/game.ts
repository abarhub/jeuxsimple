// ── FreeCell game logic ───────────────────────────────────────────────────────

export type Suit  = 'S' | 'H' | 'D' | 'C';   // Spades Hearts Diamonds Clubs
export type Color = 'black' | 'red';

export interface Card {
  rank: number;   // 1 = Ace, 13 = King
  suit: Suit;
}

export function cardColor(card: Card): Color {
  return card.suit === 'H' || card.suit === 'D' ? 'red' : 'black';
}

// ── Game state ────────────────────────────────────────────────────────────────

export interface GameState {
  /** 8 tableau columns */
  tableau:     Card[][];
  /** 4 free cells (null = empty) */
  freecells:   (Card | null)[];
  /** 4 foundation piles, indexed by suit order S H D C — top rank (0 = empty) */
  foundations: number[];          // [topS, topH, topD, topC]
  /** Undo stack */
  history:     Snapshot[];
  /** true when all cards are on foundations */
  won:         boolean;
}

export interface Snapshot {
  tableau:     Card[][];
  freecells:   (Card | null)[];
  foundations: number[];
}

// Suit index helper
const SUIT_IDX: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

// ── Deal ──────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(): GameState {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const deck: Card[]  = suits.flatMap(suit =>
    Array.from({ length: 13 }, (_, i) => ({ rank: i + 1, suit }))
  );
  const shuffled = shuffle(deck);

  // Deal: columns 0-3 get 7 cards, columns 4-7 get 6 cards
  const tableau: Card[][] = Array.from({ length: 8 }, () => []);
  shuffled.forEach((card, i) => tableau[i % 8].push(card));

  return {
    tableau:     tableau.map(col => [...col]),
    freecells:   [null, null, null, null],
    foundations: [0, 0, 0, 0],
    history:     [],
    won:         false,
  };
}

// ── Rules ─────────────────────────────────────────────────────────────────────

/** Can card be placed on top of `onto` in the tableau? */
export function canStack(card: Card, onto: Card): boolean {
  return card.rank === onto.rank - 1 && cardColor(card) !== cardColor(onto);
}

/** How many cards can be moved at once (supermove rule)? */
export function maxMovable(state: GameState, destIsEmpty: boolean): number {
  const freeFree  = state.freecells.filter(c => c === null).length;
  const freeCols  = state.tableau.filter(col => col.length === 0).length;
  const emptyCols = destIsEmpty ? freeCols - 1 : freeCols;
  return (freeFree + 1) * Math.pow(2, Math.max(0, emptyCols));
}

/** Is a sequence of cards (bottom→top) a valid movable run? */
export function isRun(cards: Card[]): boolean {
  for (let i = 0; i < cards.length - 1; i++) {
    if (!canStack(cards[i + 1], cards[i])) return false;
  }
  return true;
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

function snapshot(state: GameState): Snapshot {
  return {
    tableau:     state.tableau.map(col => [...col]),
    freecells:   [...state.freecells],
    foundations: [...state.foundations],
  };
}

function restore(state: GameState, snap: Snapshot): GameState {
  return {
    ...state,
    tableau:     snap.tableau.map(col => [...col]),
    freecells:   [...snap.freecells],
    foundations: [...snap.foundations],
    won:         false,
  };
}

function checkWon(foundations: number[]): boolean {
  return foundations.every(f => f === 13);
}

function pushHistory(state: GameState): GameState {
  return { ...state, history: [...state.history, snapshot(state)] };
}

// ── Auto-foundation ───────────────────────────────────────────────────────────

/**
 * Auto-move safe cards to foundations.
 * A card is "safe" to auto-move if all cards of lower rank and opposite color
 * are already on their foundations (classic Windows FreeCell heuristic).
 */
export function autoFoundation(state: GameState): GameState {
  let changed = true;
  while (changed) {
    changed = false;
    // Check tableau tops
    for (let col = 0; col < 8; col++) {
      const pile = state.tableau[col];
      if (pile.length === 0) continue;
      const card = pile[pile.length - 1];
      if (canAutoFoundation(card, state.foundations)) {
        state = {
          ...state,
          tableau: state.tableau.map((c, i) => i === col ? c.slice(0, -1) : [...c]),
          foundations: state.foundations.map((f, i) => i === SUIT_IDX[card.suit] ? f + 1 : f),
        };
        if (checkWon(state.foundations)) return { ...state, won: true };
        changed = true;
      }
    }
    // Check freecells
    for (let fc = 0; fc < 4; fc++) {
      const card = state.freecells[fc];
      if (!card) continue;
      if (canAutoFoundation(card, state.foundations)) {
        state = {
          ...state,
          freecells: state.freecells.map((c, i) => i === fc ? null : c),
          foundations: state.foundations.map((f, i) => i === SUIT_IDX[card.suit] ? f + 1 : f),
        };
        if (checkWon(state.foundations)) return { ...state, won: true };
        changed = true;
      }
    }
  }
  return state;
}

function canAutoFoundation(card: Card, foundations: number[]): boolean {
  if (card.rank !== foundations[SUIT_IDX[card.suit]] + 1) return false;
  // Safe if all cards of value (rank-1) in opposite colors are already on foundations
  const opposites: Suit[] = (card.suit === 'H' || card.suit === 'D')
    ? ['S', 'C'] : ['H', 'D'];
  return opposites.every(s => foundations[SUIT_IDX[s]] >= card.rank - 1);
}

// ── Move: tableau → foundation ────────────────────────────────────────────────
export function moveToFoundation(state: GameState, source: { from: 'tableau' | 'freecell', idx: number }): GameState | null {
  let card: Card | null;
  if (source.from === 'tableau') {
    const col = state.tableau[source.idx];
    if (col.length === 0) return null;
    card = col[col.length - 1];
  } else {
    card = state.freecells[source.idx];
  }
  if (!card) return null;
  const fi = SUIT_IDX[card.suit];
  if (state.foundations[fi] !== card.rank - 1) return null;

  state = pushHistory(state);
  const foundations = state.foundations.map((f, i) => i === fi ? f + 1 : f);
  let next: GameState;
  if (source.from === 'tableau') {
    next = {
      ...state,
      tableau: state.tableau.map((col, i) => i === source.idx ? col.slice(0, -1) : [...col]),
      foundations,
    };
  } else {
    next = {
      ...state,
      freecells: state.freecells.map((c, i) => i === source.idx ? null : c),
      foundations,
    };
  }
  if (checkWon(foundations)) return { ...next, won: true };
  return autoFoundation(next);
}

// ── Move: tableau → freecell ──────────────────────────────────────────────────
export function moveToFreecell(state: GameState, colIdx: number): GameState | null {
  const col = state.tableau[colIdx];
  if (col.length === 0) return null;
  const freeIdx = state.freecells.indexOf(null);
  if (freeIdx === -1) return null;

  state = pushHistory(state);
  return autoFoundation({
    ...state,
    tableau:   state.tableau.map((c, i) => i === colIdx ? c.slice(0, -1) : [...c]),
    freecells: state.freecells.map((c, i) => i === freeIdx ? col[col.length - 1] : c),
  });
}

// ── Move: freecell → tableau ──────────────────────────────────────────────────
export function moveFreecellToTableau(state: GameState, fcIdx: number, colIdx: number): GameState | null {
  const card = state.freecells[fcIdx];
  if (!card) return null;
  const col = state.tableau[colIdx];
  if (col.length > 0 && !canStack(card, col[col.length - 1])) return null;

  state = pushHistory(state);
  return autoFoundation({
    ...state,
    freecells: state.freecells.map((c, i) => i === fcIdx ? null : c),
    tableau:   state.tableau.map((c, i) => i === colIdx ? [...c, card] : [...c]),
  });
}

// ── Move: freecell → freecell ─────────────────────────────────────────────────
export function moveFreecellToFreecell(state: GameState, fromIdx: number, toIdx: number): GameState | null {
  if (fromIdx === toIdx) return null;
  const card = state.freecells[fromIdx];
  if (!card || state.freecells[toIdx] !== null) return null;

  state = pushHistory(state);
  return autoFoundation({
    ...state,
    freecells: state.freecells.map((c, i) =>
      i === fromIdx ? null : i === toIdx ? card : c
    ),
  });
}

// ── Move: tableau → tableau (supermove) ───────────────────────────────────────
export function moveTableauToTableau(
  state:   GameState,
  fromCol: number,
  cardIdx: number,   // index of the bottom card of the sequence to move
  toCol:   number,
): GameState | null {
  const src  = state.tableau[fromCol];
  const dst  = state.tableau[toCol];
  const cards = src.slice(cardIdx);   // cards to move (bottom-first)

  if (cards.length === 0) return null;
  if (!isRun(cards)) return null;

  // Check destination compatibility
  if (dst.length > 0 && !canStack(cards[0], dst[dst.length - 1])) return null;
  if (dst.length === 0 && cards[0].rank === 13 && cards.length === src.length) {
    // Moving a complete column to an empty column — allow but pointless; still legal
  }

  // Check supermove limit
  const max = maxMovable(state, dst.length === 0);
  if (cards.length > max) return null;

  state = pushHistory(state);
  return autoFoundation({
    ...state,
    tableau: state.tableau.map((col, i) => {
      if (i === fromCol) return col.slice(0, cardIdx);
      if (i === toCol)   return [...col, ...cards];
      return [...col];
    }),
  });
}

// ── Undo ──────────────────────────────────────────────────────────────────────
export function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const history = [...state.history];
  const snap    = history.pop()!;
  return restore({ ...state, history }, snap);
}

// ── Hint ─────────────────────────────────────────────────────────────────────
export type HintMove =
  | { type: 'tableau-tableau'; fromCol: number; cardIdx: number; toCol: number }
  | { type: 'tableau-freecell'; fromCol: number }
  | { type: 'freecell-tableau'; fcIdx: number; toCol: number }
  | { type: 'to-foundation'; from: 'tableau' | 'freecell'; idx: number };

export function findHint(state: GameState): HintMove | null {
  // 1. Foundation moves
  for (let col = 0; col < 8; col++) {
    const pile = state.tableau[col];
    if (pile.length === 0) continue;
    const r = moveToFoundation(state, { from: 'tableau', idx: col });
    if (r) return { type: 'to-foundation', from: 'tableau', idx: col };
  }
  for (let fc = 0; fc < 4; fc++) {
    const r = moveToFoundation(state, { from: 'freecell', idx: fc });
    if (r) return { type: 'to-foundation', from: 'freecell', idx: fc };
  }
  // 2. Tableau to tableau
  for (let from = 0; from < 8; from++) {
    const src = state.tableau[from];
    if (src.length === 0) continue;
    for (let ci = src.length - 1; ci >= 0; ci--) {
      if (!isRun(src.slice(ci))) continue;
      for (let to = 0; to < 8; to++) {
        if (to === from) continue;
        const r = moveTableauToTableau(state, from, ci, to);
        if (r) return { type: 'tableau-tableau', fromCol: from, cardIdx: ci, toCol: to };
      }
    }
  }
  // 3. Freecell to tableau
  for (let fc = 0; fc < 4; fc++) {
    for (let to = 0; to < 8; to++) {
      const r = moveFreecellToTableau(state, fc, to);
      if (r) return { type: 'freecell-tableau', fcIdx: fc, toCol: to };
    }
  }
  // 4. Tableau to freecell
  for (let col = 0; col < 8; col++) {
    const r = moveToFreecell(state, col);
    if (r) return { type: 'tableau-freecell', fromCol: col };
  }
  return null;
}
