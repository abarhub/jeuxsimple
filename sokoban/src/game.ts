import type { LevelData } from './levels';

export enum Cell {
  WALL = 0,
  FLOOR = 1,
  GOAL = 2,
  BOX = 3,
  BOX_ON_GOAL = 4,
  PLAYER = 5,
  PLAYER_ON_GOAL = 6,
}

export interface GameState {
  grid: Cell[][];
  playerX: number;
  playerY: number;
  moves: number;
  goalsRemaining: number;
  width: number;
  height: number;
}

export function parseLevel(level: LevelData): GameState {
  const rows = level.map;
  const height = rows.length;
  const width = Math.max(...rows.map(r => r.length));

  const grid: Cell[][] = [];
  let playerX = 0;
  let playerY = 0;
  let goalsRemaining = 0;

  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      const ch = rows[y]?.[x] ?? ' ';
      let cell: Cell;
      switch (ch) {
        case '#':
          cell = Cell.WALL;
          break;
        case '@':
          cell = Cell.PLAYER;
          playerX = x;
          playerY = y;
          break;
        case '+':
          cell = Cell.PLAYER_ON_GOAL;
          playerX = x;
          playerY = y;
          goalsRemaining++;
          break;
        case '$':
          cell = Cell.BOX;
          break;
        case '*':
          cell = Cell.BOX_ON_GOAL;
          break;
        case '.':
          cell = Cell.GOAL;
          goalsRemaining++;
          break;
        default:
          cell = Cell.FLOOR;
          break;
      }
      row.push(cell);
    }
    grid.push(row);
  }

  return { grid, playerX, playerY, moves: 0, goalsRemaining, width, height };
}

export function isSolved(state: GameState): boolean {
  return state.goalsRemaining === 0;
}

export function move(state: GameState, dx: number, dy: number): GameState {
  const { grid, playerX: px, playerY: py, width, height } = state;
  const nx = px + dx;
  const ny = py + dy;

  if (nx < 0 || nx >= width || ny < 0 || ny >= height) return state;

  const targetCell = grid[ny][nx];
  if (targetCell === Cell.WALL) return state;

  const newGrid = grid.map(row => [...row]);
  let goalsRemaining = state.goalsRemaining;

  // Clear player's current position
  newGrid[py][px] = grid[py][px] === Cell.PLAYER_ON_GOAL ? Cell.GOAL : Cell.FLOOR;

  if (targetCell === Cell.BOX || targetCell === Cell.BOX_ON_GOAL) {
    const bx = nx + dx;
    const by = ny + dy;

    if (bx < 0 || bx >= width || by < 0 || by >= height) return state;

    const boxDest = grid[by][bx];
    if (boxDest === Cell.WALL || boxDest === Cell.BOX || boxDest === Cell.BOX_ON_GOAL) return state;

    if (targetCell === Cell.BOX_ON_GOAL) goalsRemaining++;
    if (boxDest === Cell.GOAL) goalsRemaining--;

    newGrid[by][bx] = boxDest === Cell.GOAL ? Cell.BOX_ON_GOAL : Cell.BOX;
    newGrid[ny][nx] = targetCell === Cell.BOX_ON_GOAL ? Cell.PLAYER_ON_GOAL : Cell.PLAYER;
  } else {
    newGrid[ny][nx] = targetCell === Cell.GOAL ? Cell.PLAYER_ON_GOAL : Cell.PLAYER;
  }

  return {
    ...state,
    grid: newGrid,
    playerX: nx,
    playerY: ny,
    moves: state.moves + 1,
    goalsRemaining,
  };
}
