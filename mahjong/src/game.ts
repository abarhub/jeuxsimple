// ── Mahjong Solitaire game logic ──────────────────────────────────────────────
import { buildTileSet, tilesMatch } from './tiles';
import { LAYOUTS, type LayoutDef } from './layouts';

export interface Tile {
  id:       number;           // unique id in the game
  typeIdx:  number;           // index into ALL_TILE_TYPES
  col:      number;           // position in half-tile units
  row:      number;
  layer:    number;
  removed:  boolean;
}

export interface GameState {
  tiles:       Tile[];
  layoutName:  string;
  selected:    number | null; // id of selected tile
  history:     [number, number][];  // pairs of removed tile ids (for undo)
  won:         boolean;
  noMoves:     boolean;
}

// ── Free-tile logic ───────────────────────────────────────────────────────────

/**
 * A tile is "free" (can be selected) if:
 * 1. Not removed
 * 2. Nothing is stacked on top of it (no tile covers it from above on same or overlapping position)
 * 3. It has at least one open side (left OR right) — no adjacent tile on one side
 */
export function isFree(tile: Tile, all: Tile[]): boolean {
  if (tile.removed) return false;

  const active = all.filter(t => !t.removed && t.id !== tile.id);

  // Check: nothing on top (layer+1, overlapping in col/row by at least 1 half-unit in each axis)
  const coveredAbove = active.some(t =>
    t.layer === tile.layer + 1 &&
    t.col < tile.col + 2 && t.col + 2 > tile.col &&
    t.row < tile.row + 2 && t.row + 2 > tile.row
  );
  if (coveredAbove) return false;

  // Check sides: a tile "blocks" the left if it's on the same layer,
  // exactly adjacent on the col axis (col+2 === tile.col) and overlapping in row
  const blockedLeft  = active.some(t =>
    t.layer === tile.layer &&
    t.col + 2 === tile.col &&
    t.row < tile.row + 2 && t.row + 2 > tile.row
  );
  const blockedRight = active.some(t =>
    t.layer === tile.layer &&
    t.col === tile.col + 2 &&
    t.row < tile.row + 2 && t.row + 2 > tile.row
  );

  return !blockedLeft || !blockedRight;
}

// ── Find all matching free pairs ──────────────────────────────────────────────
export function findFreePairs(state: GameState): [number, number][] {
  const free = state.tiles.filter(t => isFree(t, state.tiles));
  const pairs: [number, number][] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (tilesMatch(free[i].typeIdx, free[j].typeIdx)) {
        pairs.push([free[i].id, free[j].id]);
      }
    }
  }
  return pairs;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function selectTile(state: GameState, id: number): GameState {
  const tile = state.tiles.find(t => t.id === id);
  if (!tile || tile.removed || !isFree(tile, state.tiles)) return state;

  // Deselect if clicking the same tile
  if (state.selected === id) return { ...state, selected: null };

  // No previous selection → select this tile
  if (state.selected === null) return { ...state, selected: id };

  // Previous selection exists
  const prev = state.tiles.find(t => t.id === state.selected)!;
  if (!tilesMatch(prev.typeIdx, tile.typeIdx)) {
    // No match → switch selection
    return { ...state, selected: id };
  }

  // Match! Remove both tiles
  const tiles = state.tiles.map(t =>
    t.id === id || t.id === state.selected ? { ...t, removed: true } : t
  );
  const history = [...state.history, [state.selected, id] as [number, number]];
  const remaining = tiles.filter(t => !t.removed).length;
  const won = remaining === 0;
  const noMoves = !won && findFreePairs({ ...state, tiles, selected: null, history, won, noMoves: false }).length === 0;

  return { ...state, tiles, selected: null, history, won, noMoves };
}

export function undoLast(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const history = [...state.history];
  const last    = history.pop()!;
  const tiles   = state.tiles.map(t =>
    last.includes(t.id) ? { ...t, removed: false } : t
  );
  return { ...state, tiles, history, selected: null, won: false, noMoves: false };
}

export function hintPair(state: GameState): [number, number] | null {
  const pairs = findFreePairs(state);
  return pairs.length > 0 ? pairs[Math.floor(Math.random() * pairs.length)] : null;
}

// ── New game ──────────────────────────────────────────────────────────────────

export function newGame(layoutName: string): GameState {
  const def: LayoutDef | undefined = LAYOUTS.find(l => l.name === layoutName) ?? LAYOUTS[0];
  const tileSet = buildTileSet();

  // Take only as many tiles as positions (positions may be less than 144)
  // Positions must be even count; trim to even if needed
  let positions = def.positions.slice(0, Math.min(def.positions.length, tileSet.length));
  if (positions.length % 2 !== 0) positions = positions.slice(0, positions.length - 1);

  const tiles: Tile[] = positions.map(([col, row, layer], i) => ({
    id: i,
    typeIdx: tileSet[i],
    col, row, layer,
    removed: false,
  }));

  const state: GameState = {
    tiles,
    layoutName: def.name,
    selected: null,
    history: [],
    won: false,
    noMoves: false,
  };
  // Check immediately if solvable (any free pair)
  const hasPairs = findFreePairs(state).length > 0;
  return { ...state, noMoves: !hasPairs };
}
