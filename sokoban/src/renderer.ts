import { Cell, type GameState } from './game';

const CELL = 64;

const C = {
  bg:           '#1a1008',
  wall:         '#4a3728',
  wallLight:    '#6b5040',
  wallShadow:   '#2e1e10',
  floor:        '#f0e6d0',
  floorDark:    '#e0d4b8',
  goal:         '#e8c020',
  box:          '#c17f24',
  boxLight:     '#d9a040',
  boxShadow:    '#7a4e0a',
  boxGoal:      '#2eaa55',
  boxGoalLight: '#50cc77',
  boxGoalShadow:'#1a6632',
  player:       '#3a7bdd',
  playerLight:  '#6aaaf0',
  playerShadow: '#1a4a90',
  skin:         '#f5c890',
};

export function getCanvasSize(state: GameState): { width: number; height: number } {
  return { width: state.width * CELL, height: state.height * CELL };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, state.width * CELL, state.height * CELL);

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      drawCell(ctx, state.grid[y][x], x * CELL, y * CELL);
    }
  }
}

function drawCell(ctx: CanvasRenderingContext2D, cell: Cell, px: number, py: number): void {
  switch (cell) {
    case Cell.WALL:         drawWall(ctx, px, py); break;
    case Cell.FLOOR:        drawFloor(ctx, px, py); break;
    case Cell.GOAL:         drawFloor(ctx, px, py); drawGoal(ctx, px, py); break;
    case Cell.BOX:          drawFloor(ctx, px, py); drawBox(ctx, px, py, false); break;
    case Cell.BOX_ON_GOAL:  drawFloor(ctx, px, py); drawBox(ctx, px, py, true); break;
    case Cell.PLAYER:       drawFloor(ctx, px, py); drawPlayer(ctx, px, py); break;
    case Cell.PLAYER_ON_GOAL:
      drawFloor(ctx, px, py);
      drawGoal(ctx, px, py);
      drawPlayer(ctx, px, py);
      break;
  }
}

function drawWall(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  ctx.fillStyle = C.wall;
  ctx.fillRect(px, py, CELL, CELL);

  // Top highlight
  ctx.fillStyle = C.wallLight;
  ctx.fillRect(px, py, CELL, 4);
  ctx.fillRect(px, py, 4, CELL);

  // Bottom shadow
  ctx.fillStyle = C.wallShadow;
  ctx.fillRect(px, py + CELL - 4, CELL, 4);
  ctx.fillRect(px + CELL - 4, py, 4, CELL);

  // Brick mortar lines
  ctx.fillStyle = C.wallShadow;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(px, py + CELL / 2 - 1, CELL, 2);
  const offset = (Math.floor(py / CELL) % 2) === 0 ? 0 : CELL / 2;
  ctx.fillRect(px + ((offset + CELL / 2) % CELL) - 1, py, 2, CELL / 2);
  ctx.fillRect(px + (offset % CELL) - 1, py + CELL / 2, 2, CELL / 2);
  ctx.globalAlpha = 1;
}

function drawFloor(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  ctx.fillStyle = C.floor;
  ctx.fillRect(px, py, CELL, CELL);
  ctx.fillStyle = C.floorDark;
  ctx.fillRect(px, py, CELL, 1);
  ctx.fillRect(px, py, 1, CELL);
}

function drawGoal(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  const cx = px + CELL / 2;
  const cy = py + CELL / 2;
  const r = CELL * 0.18;

  ctx.fillStyle = C.goal;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

function drawBox(ctx: CanvasRenderingContext2D, px: number, py: number, onGoal: boolean): void {
  const pad = 7;
  const s = CELL - pad * 2;
  const bx = px + pad;
  const by = py + pad;
  const col    = onGoal ? C.boxGoal        : C.box;
  const light  = onGoal ? C.boxGoalLight   : C.boxLight;
  const shadow = onGoal ? C.boxGoalShadow  : C.boxShadow;

  // Main face
  ctx.fillStyle = col;
  ctx.fillRect(bx, by, s, s);

  // Top/left highlight
  ctx.fillStyle = light;
  ctx.fillRect(bx, by, s, 5);
  ctx.fillRect(bx, by, 5, s);

  // Bottom/right shadow
  ctx.fillStyle = shadow;
  ctx.fillRect(bx, by + s - 5, s, 5);
  ctx.fillRect(bx + s - 5, by, 5, s);

  // Inner cross
  ctx.strokeStyle = shadow;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(bx + 5, by + s / 2);
  ctx.lineTo(bx + s - 5, by + s / 2);
  ctx.moveTo(bx + s / 2, by + 5);
  ctx.lineTo(bx + s / 2, by + s - 5);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  const cx = px + CELL / 2;

  // Body (shirt)
  const bodyY = py + CELL * 0.52;
  const bodyR = CELL * 0.22;
  ctx.fillStyle = C.player;
  ctx.beginPath();
  ctx.ellipse(cx, bodyY, bodyR, bodyR * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body highlight
  ctx.fillStyle = C.playerLight;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.ellipse(cx - bodyR * 0.2, bodyY - bodyR * 0.3, bodyR * 0.45, bodyR * 0.4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Head
  const headY = py + CELL * 0.3;
  const headR = CELL * 0.17;
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = C.playerShadow;
  ctx.beginPath();
  ctx.arc(cx - headR * 0.35, headY - headR * 0.1, headR * 0.18, 0, Math.PI * 2);
  ctx.arc(cx + headR * 0.35, headY - headR * 0.1, headR * 0.18, 0, Math.PI * 2);
  ctx.fill();
}
