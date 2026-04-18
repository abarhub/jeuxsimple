import { LEVELS } from './levels';
import { parseLevel, move, isSolved, type GameState } from './game';
import { render, getCanvasSize } from './renderer';

let currentLevel = 0;
let state: GameState = parseLevel(LEVELS[currentLevel]);
let history: GameState[] = [];

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const levelTitle = document.getElementById('levelTitle')!;
const movesDisplay = document.getElementById('moves')!;
const messageDisplay = document.getElementById('message')!;

function resizeCanvas(): void {
  const size = getCanvasSize(state);
  canvas.width = size.width;
  canvas.height = size.height;
}

function updateUI(): void {
  levelTitle.textContent = `${LEVELS[currentLevel].title}  (${currentLevel + 1} / ${LEVELS.length})`;
  movesDisplay.textContent = `Déplacements : ${state.moves}`;

  if (isSolved(state)) {
    if (currentLevel < LEVELS.length - 1) {
      messageDisplay.textContent = 'Niveau terminé ! Appuyez sur N pour continuer.';
    } else {
      messageDisplay.textContent = 'Félicitations, vous avez terminé tous les niveaux !';
    }
  } else {
    messageDisplay.textContent = '';
  }
}

function loadLevel(index: number): void {
  currentLevel = index;
  state = parseLevel(LEVELS[index]);
  history = [];
  resizeCanvas();
  updateUI();
  render(ctx, state);
}

function handleKey(e: KeyboardEvent): void {
  if (isSolved(state)) {
    if ((e.key === 'n' || e.key === 'N') && currentLevel < LEVELS.length - 1) {
      loadLevel(currentLevel + 1);
    }
    if (e.key === 'r' || e.key === 'R') {
      loadLevel(currentLevel);
    }
    return;
  }

  let dx = 0;
  let dy = 0;

  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': dy = -1; break;
    case 'ArrowDown':  case 's': case 'S': dy =  1; break;
    case 'ArrowLeft':  case 'a': case 'A': dx = -1; break;
    case 'ArrowRight': case 'd': case 'D': dx =  1; break;
    case 'r': case 'R': loadLevel(currentLevel); return;
    case 'u': case 'U':
      if (history.length > 0) {
        state = history.pop()!;
        updateUI();
        render(ctx, state);
      }
      return;
    case 'n': case 'N':
      if (currentLevel < LEVELS.length - 1) loadLevel(currentLevel + 1);
      return;
    default:
      return;
  }

  e.preventDefault();

  const prev = state;
  const next = move(state, dx, dy);
  if (next !== prev) {
    history.push(prev);
    state = next;
    updateUI();
    render(ctx, state);
  }
}

document.addEventListener('keydown', handleKey);
loadLevel(0);
