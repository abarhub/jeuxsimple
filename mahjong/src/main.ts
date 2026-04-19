// ── Mahjong Solitaire — main entry point ──────────────────────────────────────
import { type GameState, newGame, selectTile, undoLast, hintPair, findFreePairs } from './game';
import { render, hitTest } from './renderer';
import { saveGame, loadGame, clearGame } from './storage';
import { LAYOUTS } from './layouts';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('board')       as HTMLCanvasElement;
const layoutSel   = document.getElementById('layout-sel')  as HTMLSelectElement;
const btnNew      = document.getElementById('btn-new')     as HTMLButtonElement;
const btnUndo     = document.getElementById('btn-undo')    as HTMLButtonElement;
const btnHint     = document.getElementById('btn-hint')    as HTMLButtonElement;
const remainEl    = document.getElementById('remain')      as HTMLSpanElement;
const pairsEl     = document.getElementById('pairs')       as HTMLSpanElement;
const overlayEl   = document.getElementById('overlay')     as HTMLDivElement;
const overlayMsg  = document.getElementById('overlay-msg') as HTMLParagraphElement;
const overlayBtn  = document.getElementById('overlay-btn') as HTMLButtonElement;

// ── State ─────────────────────────────────────────────────────────────────────
let state: GameState;
let hintIds: [number, number] | null = null;
let hintTimer: ReturnType<typeof setTimeout> | null = null;

// ── Render loop ───────────────────────────────────────────────────────────────
function draw(): void {
  render(canvas, state, { hint: hintIds });
}

function updateUI(): void {
  const remaining = state.tiles.filter(t => !t.removed).length;
  const pairs     = findFreePairs(state).length;
  remainEl.textContent = String(remaining);
  pairsEl.textContent  = String(pairs);
  btnUndo.disabled  = state.history.length === 0;

  if (state.won) {
    showOverlay('🎉 Félicitations !', 'Nouvelle partie');
  } else if (state.noMoves) {
    showOverlay('🚫 Plus de coups possibles', 'Nouvelle partie');
  } else {
    hideOverlay();
  }
}

function showOverlay(msg: string, btn: string): void {
  overlayMsg.textContent = msg;
  overlayBtn.textContent = btn;
  overlayEl.style.display = 'flex';
}

function hideOverlay(): void {
  overlayEl.style.display = 'none';
}

// ── Actions ───────────────────────────────────────────────────────────────────
function applyState(next: GameState): void {
  state = next;
  clearHint();
  draw();
  updateUI();
  saveGame(state);
}

function startNewGame(): void {
  clearGame();
  state = newGame(layoutSel.value);
  clearHint();
  draw();
  updateUI();
  saveGame(state);
}

function clearHint(): void {
  hintIds = null;
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
}

function showHint(): void {
  clearHint();
  const pair = hintPair(state);
  if (!pair) return;
  hintIds = pair;
  draw();
  hintTimer = setTimeout(() => { hintIds = null; draw(); }, 2500);
}

// ── Events ────────────────────────────────────────────────────────────────────
canvas.addEventListener('click', e => {
  if (state.won || state.noMoves) return;
  const rect = canvas.getBoundingClientRect();
  const cx   = e.clientX - rect.left;
  const cy   = e.clientY - rect.top;
  const id   = hitTest(canvas, state, cx, cy);
  if (id === null) return;
  clearHint();
  applyState(selectTile(state, id));
});

btnNew.addEventListener('click', startNewGame);

btnUndo.addEventListener('click', () => applyState(undoLast(state)));

btnHint.addEventListener('click', showHint);

overlayBtn.addEventListener('click', startNewGame);

layoutSel.addEventListener('change', startNewGame);

// ── Responsive resize ─────────────────────────────────────────────────────────
const ro = new ResizeObserver(() => draw());
ro.observe(canvas);

// ── Boot ──────────────────────────────────────────────────────────────────────
// Populate layout selector
LAYOUTS.forEach(l => {
  const opt = document.createElement('option');
  opt.value = opt.textContent = l.name;
  layoutSel.appendChild(opt);
});

// Try to restore saved game
const saved = loadGame();
if (saved) {
  state = saved;
  // Restore selected layout in dropdown
  layoutSel.value = state.layoutName;
} else {
  state = newGame(LAYOUTS[0].name);
  layoutSel.value = LAYOUTS[0].name;
}

draw();
updateUI();
