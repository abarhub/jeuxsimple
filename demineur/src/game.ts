// ── Types ─────────────────────────────────────────────────────────────────────

/** 'wrongFlag' = flagged cell that turned out not to be a mine (shown on loss) */
export type CellState  = 'hidden' | 'revealed' | 'flagged' | 'wrongFlag';
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface Cell {
  mine:          boolean;
  state:         CellState;
  adjacentMines: number;   // -1 for mine cells (unused)
}

export interface GameConfig {
  rows:   number;
  cols:   number;
  mines:  number;
  preset: 'beginner' | 'intermediate' | 'expert' | 'custom';
}

export interface GameState {
  grid:       Cell[][];
  config:     GameConfig;
  status:     GameStatus;
  /** Date.now() at the start of the current play session (null when not playing) */
  startTime:  number | null;
  /** Accumulated ms from previous sessions (does NOT include the current session) */
  elapsed:    number;
  flagCount:  number;
  /** Row/col of the mine the player clicked on */
  exploded:   [number, number] | null;
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const PRESETS: Record<string, GameConfig> = {
  beginner:     { rows: 9,  cols: 9,  mines: 10, preset: 'beginner'     },
  intermediate: { rows: 16, cols: 16, mines: 40, preset: 'intermediate' },
  expert:       { rows: 16, cols: 30, mines: 99, preset: 'expert'       },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function getNeighbors(r: number, c: number, rows: number, cols: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
    }
  }
  return out;
}

function placeMines(grid: Cell[][], config: GameConfig, safeR: number, safeC: number): void {
  const { rows, cols, mines } = config;

  // Safe zone: clicked cell + all its neighbours
  const safe = new Set<string>([`${safeR},${safeC}`]);
  for (const [nr, nc] of getNeighbors(safeR, safeC, rows, cols)) safe.add(`${nr},${nc}`);

  // Candidates = every non-safe cell
  const candidates: number[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!safe.has(`${r},${c}`)) candidates.push(r * cols + c);

  // Fisher-Yates partial shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const count = Math.min(mines, candidates.length);
  for (let i = 0; i < count; i++) {
    const r = Math.floor(candidates[i] / cols);
    const c = candidates[i] % cols;
    grid[r][c].mine = true;
  }

  // Adjacent-mine counts for non-mine cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c].mine) {
        grid[r][c].adjacentMines = getNeighbors(r, c, rows, cols)
          .filter(([nr, nc]) => grid[nr][nc].mine).length;
      }
    }
  }
}

function floodReveal(grid: Cell[][], r: number, c: number, rows: number, cols: number): void {
  const stack: [number, number][] = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    if (grid[cr][cc].state !== 'hidden') continue;
    grid[cr][cc].state = 'revealed';
    if (grid[cr][cc].adjacentMines === 0) {
      for (const [nr, nc] of getNeighbors(cr, cc, rows, cols))
        if (grid[nr][nc].state === 'hidden') stack.push([nr, nc]);
    }
  }
}

function checkWon(grid: Cell[][], config: GameConfig): boolean {
  for (let r = 0; r < config.rows; r++)
    for (let c = 0; c < config.cols; c++)
      if (!grid[r][c].mine && grid[r][c].state !== 'revealed') return false;
  return true;
}

function deepCopy(grid: Cell[][]): Cell[][] {
  return grid.map(row => row.map(cell => ({ ...cell })));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function newGame(config: GameConfig): GameState {
  const grid: Cell[][] = Array.from({ length: config.rows }, () =>
    Array.from({ length: config.cols }, () => ({
      mine: false, state: 'hidden' as CellState, adjacentMines: 0,
    }))
  );
  return { grid, config, status: 'idle', startTime: null, elapsed: 0, flagCount: 0, exploded: null };
}

/** Reveal a hidden cell. Handles: first-click mine placement, flood fill, win/loss. */
export function reveal(state: GameState, row: number, col: number): GameState {
  if (state.status === 'won' || state.status === 'lost') return state;
  if (state.grid[row][col].state !== 'hidden') return state;

  let grid       = deepCopy(state.grid);
  let status     = state.status;
  let startTime  = state.startTime;
  let elapsed    = state.elapsed;
  let exploded   = state.exploded;

  // First click → place mines and start timer
  if (status === 'idle') {
    placeMines(grid, state.config, row, col);
    startTime = Date.now();
    status    = 'playing';
  }

  const { rows, cols } = state.config;

  if (grid[row][col].mine) {
    // Player hit a mine
    exploded            = [row, col];
    grid[row][col].state = 'revealed';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Reveal all unflagged mines
        if (grid[r][c].mine && grid[r][c].state !== 'flagged') grid[r][c].state = 'revealed';
        // Mark flags on non-mine cells as wrong
        if (!grid[r][c].mine && grid[r][c].state === 'flagged') grid[r][c].state = 'wrongFlag';
      }
    }
    elapsed = state.elapsed + (startTime ? Date.now() - startTime : 0);
    return { ...state, grid, status: 'lost', startTime: null, elapsed, exploded };
  }

  floodReveal(grid, row, col, rows, cols);

  if (checkWon(grid, state.config)) {
    // Auto-flag remaining mines and stop
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c].mine && grid[r][c].state !== 'flagged') grid[r][c].state = 'flagged';
    elapsed   = state.elapsed + (startTime ? Date.now() - startTime : 0);
    return {
      ...state, grid, status: 'won', startTime: null,
      elapsed, flagCount: state.config.mines, exploded,
    };
  }

  const flagCount = grid.flat().filter(c => c.state === 'flagged').length;
  return { ...state, grid, status: 'playing', startTime, elapsed, flagCount, exploded };
}

/** Toggle flag on a hidden cell (right-click). */
export function toggleFlag(state: GameState, row: number, col: number): GameState {
  if (state.status !== 'playing') return state;
  const cell = state.grid[row][col];
  if (cell.state !== 'hidden' && cell.state !== 'flagged') return state;

  const grid                = deepCopy(state.grid);
  grid[row][col].state      = cell.state === 'hidden' ? 'flagged' : 'hidden';
  const flagCount           = grid.flat().filter(c => c.state === 'flagged').length;
  return { ...state, grid, flagCount };
}

/**
 * Chord: click on a revealed number that already has its required flags around it.
 * Reveals all remaining hidden neighbours.
 */
export function chord(state: GameState, row: number, col: number): GameState {
  if (state.status !== 'playing') return state;
  const cell = state.grid[row][col];
  if (cell.state !== 'revealed' || cell.adjacentMines <= 0) return state;

  const neighbors = getNeighbors(row, col, state.config.rows, state.config.cols);
  const flags     = neighbors.filter(([r, c]) => state.grid[r][c].state === 'flagged').length;
  if (flags !== cell.adjacentMines) return state;

  let s = state;
  for (const [r, c] of neighbors) {
    if (s.grid[r][c].state === 'hidden') {
      s = reveal(s, r, c);
      if (s.status === 'lost') return s;
    }
  }
  return s;
}

/** Total elapsed ms including the current session (for display). */
export function totalElapsed(state: GameState): number {
  return state.elapsed + (state.startTime ? Date.now() - state.startTime : 0);
}
