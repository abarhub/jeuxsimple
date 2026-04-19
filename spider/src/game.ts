// ── Types ─────────────────────────────────────────────────────────────────────

export type Suit     = 'S' | 'C' | 'H' | 'D';
export type Rank     = 1|2|3|4|5|6|7|8|9|10|11|12|13;
export type SuitMode = 'black' | 'color';

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', C: '♣', H: '♥', D: '♦' };

export function isRed(suit: Suit): boolean { return suit === 'H' || suit === 'D'; }

export function rankLabel(rank: Rank): string {
  if (rank === 1)  return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

export interface Card {
  suit:   Suit;
  rank:   Rank;
  faceUp: boolean;
}

export interface GameState {
  tableau:        Card[][];   // 10 columns
  stock:          Card[][];   // remaining deals (each = 10 cards, last is next)
  completedSuits: Suit[];     // suits of removed complete sets (length 0–8)
  moves:          number;
  won:            boolean;
  mode:           SuitMode;
}

// ── Deck construction ─────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDeck(mode: SuitMode): Card[] {
  // 104 cards = 8 sets of 13 ranks
  // black : 8 × Spades only
  // color : 2 × Spades  + 2 × Clubs + 2 × Hearts + 2 × Diamonds
  const suitSets: Suit[] = mode === 'black'
    ? ['S','S','S','S','S','S','S','S']
    : ['S','S','C','C','H','H','D','D'];

  const cards: Card[] = [];
  for (const suit of suitSets) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push({ suit, rank: rank as Rank, faceUp: false });
    }
  }
  return cards; // 104 cards
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Return true if the 13-card slice forms K→A of the same suit */
function isCompleteSet(cards: Card[]): boolean {
  if (cards.length !== 13) return false;
  const suit = cards[0].suit;
  for (let i = 0; i < 13; i++) {
    if (cards[i].suit !== suit)    return false;
    if (cards[i].rank !== 13 - i)  return false; // K=13 … A=1
  }
  return true;
}

/** Flip the top card of a column face-up if it isn't already */
function flipTop(col: Card[]): Card[] {
  if (col.length === 0) return col;
  const last = col[col.length - 1];
  if (last.faceUp) return col;
  return [...col.slice(0, -1), { ...last, faceUp: true }];
}

/** Scan for and remove completed K→A sequences; repeat until none found */
function removeCompleteSets(
  tableau:        Card[][],
  completedSuits: Suit[],
): { tableau: Card[][], completedSuits: Suit[] } {
  completedSuits = [...completedSuits];
  let changed = true;
  while (changed) {
    changed = false;
    for (let c = 0; c < 10; c++) {
      const col = tableau[c];
      if (col.length < 13) continue;
      const top13 = col.slice(-13);
      if (isCompleteSet(top13)) {
        completedSuits = [...completedSuits, top13[0].suit];
        const newCol   = flipTop(col.slice(0, -13));
        tableau        = [...tableau.slice(0, c), newCol, ...tableau.slice(c + 1)];
        changed        = true;
        break;
      }
    }
  }
  return { tableau, completedSuits };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function newGame(mode: SuitMode): GameState {
  const deck = shuffle(makeDeck(mode));

  // Deal 54 cards: cols 0–3 get 6 each, cols 4–9 get 5 each
  const tableau: Card[][] = [];
  let idx = 0;
  for (let col = 0; col < 10; col++) {
    const count = col < 4 ? 6 : 5;
    const slice = deck.slice(idx, idx + count);
    tableau.push(slice.map((c, i) => ({ ...c, faceUp: i === count - 1 })));
    idx += count;
  }

  // Remaining 50 cards → 5 deal groups of 10 (stock[0] = first deal)
  const stock: Card[][] = [];
  for (let i = 0; i < 5; i++) {
    stock.push(deck.slice(54 + i * 10, 54 + (i + 1) * 10));
  }

  return { tableau, stock, completedSuits: [], moves: 0, won: false, mode };
}

/**
 * Can the run starting at cardIndex in a column be picked up?
 * Requires: all face-up, same suit, strictly descending.
 */
export function canPickUp(col: Card[], cardIndex: number): boolean {
  if (cardIndex < 0 || cardIndex >= col.length) return false;
  if (!col[cardIndex].faceUp) return false;
  const cards = col.slice(cardIndex);
  for (let i = 0; i < cards.length - 1; i++) {
    if (cards[i].suit !== cards[i + 1].suit)        return false;
    if (cards[i].rank !== cards[i + 1].rank + 1)    return false;
  }
  return true;
}

/**
 * Can a run (cards) land on destCol?
 * Rule: destCol empty OR top card rank === cards[0].rank + 1
 */
export function canDrop(cards: Card[], destCol: Card[]): boolean {
  if (destCol.length === 0) return true;
  const top = destCol[destCol.length - 1];
  if (!top.faceUp) return false;
  return cards[0].rank === top.rank - 1;
}

/** Move a run of cards and return the new state, or null if illegal */
export function moveCards(
  state:     GameState,
  fromCol:   number,
  cardIndex: number,
  toCol:     number,
): GameState | null {
  if (fromCol === toCol) return null;
  const col = state.tableau[fromCol];
  if (!canPickUp(col, cardIndex)) return null;
  const cards = col.slice(cardIndex);
  if (!canDrop(cards, state.tableau[toCol])) return null;

  let tableau: Card[][] = state.tableau.map((c, i) => {
    if (i === fromCol) return flipTop(c.slice(0, cardIndex));
    if (i === toCol)   return [...c, ...cards];
    return c;
  });

  const { tableau: t2, completedSuits } = removeCompleteSets(tableau, state.completedSuits);
  const won = completedSuits.length === 8;

  return { ...state, tableau: t2, completedSuits, moves: state.moves + 1, won };
}

/** Deal one row of 10 cards (one per column) from the stock */
export function dealFromStock(state: GameState): GameState | null {
  if (state.stock.length === 0) return null;

  const deal     = state.stock[state.stock.length - 1];
  const newStock = state.stock.slice(0, -1);

  const tableau: Card[][] = state.tableau.map((col, i) => [
    ...col,
    { ...deal[i], faceUp: true },
  ]);

  const { tableau: t2, completedSuits } = removeCompleteSets(tableau, state.completedSuits);

  return {
    ...state,
    tableau:        t2,
    stock:          newStock,
    completedSuits,
    moves:          state.moves + 1,
    won:            completedSuits.length === 8,
  };
}
