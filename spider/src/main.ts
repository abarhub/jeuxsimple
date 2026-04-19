import {
  newGame, moveCards, dealFromStock,
  type GameState, type SuitMode,
} from './game';
import {
  render, hitTest, canvasWidth, canPickUp, mobileRunStart,
  type Selection, type HitResult,
} from './renderer';
import { saveGame, loadGame } from './storage';

// ── DOM ───────────────────────────────────────────────────────────────────────
const canvas     = document.getElementById('gameCanvas')  as HTMLCanvasElement;
const ctx        = canvas.getContext('2d')!;
const modeSelect = document.getElementById('modeSelect')  as HTMLSelectElement;
const newGameBtn = document.getElementById('newGameBtn')  as HTMLButtonElement;
const undoBtn    = document.getElementById('undoBtn')     as HTMLButtonElement;
const messageEl  = document.getElementById('message')!;

// ── State ─────────────────────────────────────────────────────────────────────
let state:     GameState;
let selection: Selection = null;
let history:   GameState[] = [];

// ── Render ────────────────────────────────────────────────────────────────────
function draw(): void {
  render(ctx, state, selection);
  // Adapt CSS display size so the canvas scales proportionally on narrow screens
  const naturalW = canvasWidth();
  const containerW = (canvas.parentElement?.clientWidth ?? naturalW);
  const scale = Math.min(1, containerW / naturalW);
  canvas.style.width  = Math.round(naturalW * scale) + 'px';
  canvas.style.height = Math.round(canvas.height * scale) + 'px';
  undoBtn.disabled = history.length === 0;
  messageEl.textContent = state.won
    ? '🎉 Félicitations, vous avez gagné !'
    : '';
}

function persist(): void { saveGame(state); }

function applyMove(next: GameState | null): boolean {
  if (!next) return false;
  history.push(state);
  if (history.length > 200) history.shift(); // cap history size
  state     = next;
  selection = null;
  persist();
  draw();
  return true;
}

// ── Click logic ───────────────────────────────────────────────────────────────
function handleHit(hit: HitResult): void {
  if (state.won) return;

  // ── Stock ──
  if (hit.area === 'stock') {
    selection = null;
    applyMove(dealFromStock(state));
    return;
  }

  // ── Empty area ──
  if (hit.area === 'none') {
    selection = null;
    draw();
    return;
  }

  // ── Tableau click ──
  const { col, cardIndex } = hit;

  // No selection yet → try to select
  if (selection === null) {
    const column = state.tableau[col];
    if (column[cardIndex]?.faceUp && canPickUp(column, cardIndex)) {
      selection = { col, cardIndex };
      draw();
    }
    return;
  }

  // ── Selection active ──

  // Same column clicked
  if (col === selection.col) {
    const column = state.tableau[col];
    if (cardIndex < selection.cardIndex && canPickUp(column, cardIndex)) {
      // Extend selection upward (pick up more cards)
      selection = { col, cardIndex };
    } else {
      // Deselect
      selection = null;
    }
    draw();
    return;
  }

  // Different column → try to drop
  const moved = applyMove(moveCards(state, selection.col, selection.cardIndex, col));

  if (!moved) {
    // Drop failed → try to re-select the clicked card
    const column = state.tableau[col];
    if (column[cardIndex]?.faceUp && canPickUp(column, cardIndex)) {
      selection = { col, cardIndex };
    } else {
      selection = null;
    }
    draw();
  }
}

canvas.addEventListener('click', (e: MouseEvent) => {
  if (state.won) return;
  const r  = canvas.getBoundingClientRect();
  const sx = canvas.width  / r.width;
  const sy = canvas.height / r.height;
  handleHit(hitTest(
    (e.clientX - r.left) * sx,
    (e.clientY - r.top)  * sy,
    state,
  ));
});

// Double-click: auto-select the longest movable run in the clicked column
canvas.addEventListener('dblclick', (e: MouseEvent) => {
  if (state.won) return;
  e.preventDefault();
  const r  = canvas.getBoundingClientRect();
  const sx = canvas.width  / r.width;
  const sy = canvas.height / r.height;
  const hit = hitTest(
    (e.clientX - r.left) * sx,
    (e.clientY - r.top)  * sy,
    state,
  );
  if (hit.area !== 'tableau') return;
  const col = state.tableau[hit.col];
  const runStart = mobileRunStart(col);
  if (canPickUp(col, runStart)) {
    selection = { col: hit.col, cardIndex: runStart };
    draw();
  }
});

// ── Buttons ───────────────────────────────────────────────────────────────────
newGameBtn.addEventListener('click', () => {
  state     = newGame(state.mode);
  selection = null;
  history   = [];
  persist();
  draw();
});

undoBtn.addEventListener('click', () => {
  if (history.length === 0) return;
  state     = history.pop()!;
  selection = null;
  persist();
  draw();
});

modeSelect.addEventListener('change', () => {
  state     = newGame(modeSelect.value as SuitMode);
  selection = null;
  history   = [];
  persist();
  draw();
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    selection = null;
    draw();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    if (history.length > 0) {
      state     = history.pop()!;
      selection = null;
      persist();
      draw();
    }
  }
});

// ── Responsive resize ─────────────────────────────────────────────────────────
const ro = new ResizeObserver(() => draw());
ro.observe(canvas.parentElement!);

// ── Init ──────────────────────────────────────────────────────────────────────
canvas.width = canvasWidth();
const saved = loadGame();
if (saved) {
  state            = saved;
  modeSelect.value = state.mode;
} else {
  state = newGame('black');
}
selection = null;
draw();
