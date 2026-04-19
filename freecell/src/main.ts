// ── FreeCell — main ───────────────────────────────────────────────────────────
import {
  type GameState, type HintMove,
  newGame, undo, findHint,
  moveToFoundation, moveToFreecell,
  moveFreecellToTableau, moveFreecellToFreecell,
  moveTableauToTableau,
  isRun,
} from './game';
import { render, hitTest, type Zone } from './renderer';
import { saveGame, loadGame, clearGame } from './storage';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas    = document.getElementById('board')    as HTMLCanvasElement;
const btnNew    = document.getElementById('btn-new')  as HTMLButtonElement;
const btnUndo   = document.getElementById('btn-undo') as HTMLButtonElement;
const btnHint   = document.getElementById('btn-hint') as HTMLButtonElement;
const moveEl    = document.getElementById('moves')    as HTMLSpanElement;
const overlayEl = document.getElementById('overlay')  as HTMLDivElement;
const overlayBtn = document.getElementById('overlay-btn') as HTMLButtonElement;

// ── State ─────────────────────────────────────────────────────────────────────
let state:    GameState;
let selected: Zone | null    = null;
let hintZone: Zone | null    = null;
let hintTimer: ReturnType<typeof setTimeout> | null = null;
let moveCount = 0;

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw(): void {
  render(canvas, state, { selected, hint: hintZone });
}

function updateUI(): void {
  moveEl.textContent    = String(moveCount);
  btnUndo.disabled      = state.history.length === 0;
  overlayEl.style.display = state.won ? 'flex' : 'none';
}

// ── Apply a new state ─────────────────────────────────────────────────────────
function applyState(next: GameState | null, counting = true): void {
  if (!next) return;
  state = next;
  selected  = null;
  clearHint();
  if (counting) moveCount++;
  draw();
  updateUI();
  saveGame(state);
}

// ── New game ──────────────────────────────────────────────────────────────────
function startNew(): void {
  clearGame();
  state     = newGame();
  selected  = null;
  moveCount = 0;
  clearHint();
  draw();
  updateUI();
  saveGame(state);
}

// ── Hint ──────────────────────────────────────────────────────────────────────
function clearHint(): void {
  hintZone = null;
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
}

function hintMoveToZone(hint: HintMove): Zone {
  switch (hint.type) {
    case 'to-foundation':
      return hint.from === 'tableau'
        ? { area: 'tableau', col: hint.idx, cardIdx: state.tableau[hint.idx].length - 1 }
        : { area: 'freecell', idx: hint.idx };
    case 'tableau-tableau':
      return { area: 'tableau', col: hint.fromCol, cardIdx: hint.cardIdx };
    case 'tableau-freecell':
      return { area: 'tableau', col: hint.fromCol, cardIdx: state.tableau[hint.fromCol].length - 1 };
    case 'freecell-tableau':
      return { area: 'freecell', idx: hint.fcIdx };
  }
}

function showHint(): void {
  clearHint();
  selected = null;
  const hint = findHint(state);
  if (!hint) return;
  hintZone = hintMoveToZone(hint);
  draw();
  hintTimer = setTimeout(() => { hintZone = null; draw(); }, 2500);
}

// ── Click handling ────────────────────────────────────────────────────────────
function handleClick(cx: number, cy: number): void {
  if (state.won) return;
  clearHint();

  const zone = hitTest(state, canvas.clientWidth, cx, cy);
  if (!zone) { selected = null; draw(); return; }

  // Nothing selected yet → select
  if (!selected) {
    if (canSelect(zone)) { selected = zone; draw(); }
    return;
  }

  // Same zone → deselect
  if (zonesEqual(selected, zone)) { selected = null; draw(); return; }

  // Try to move selected → zone
  const next = tryMove(selected, zone);
  if (next) {
    applyState(next);
    return;
  }

  // Move failed → try selecting the new zone instead
  if (canSelect(zone)) { selected = zone; draw(); }
  else { selected = null; draw(); }
}

function canSelect(zone: Zone): boolean {
  if (zone.area === 'freecell')   return state.freecells[zone.idx] !== null;
  if (zone.area === 'foundation') return false;
  // tableau: must be top of a valid run
  const col  = state.tableau[zone.col];
  if (col.length === 0) return false;
  return isRun(col.slice(zone.cardIdx));
}

function zonesEqual(a: Zone, b: Zone): boolean {
  if (a.area !== b.area) return false;
  if (a.area === 'freecell'   && b.area === 'freecell')   return a.idx === b.idx;
  if (a.area === 'foundation' && b.area === 'foundation') return a.idx === b.idx;
  if (a.area === 'tableau'    && b.area === 'tableau')    return a.col === b.col && a.cardIdx === b.cardIdx;
  return false;
}

function tryMove(from: Zone, to: Zone): GameState | null {
  // → foundation
  if (to.area === 'foundation') {
    if (from.area === 'tableau')  return moveToFoundation(state, { from: 'tableau',   idx: from.col });
    if (from.area === 'freecell') return moveToFoundation(state, { from: 'freecell',  idx: from.idx });
  }
  // → freecell
  if (to.area === 'freecell') {
    if (from.area === 'tableau')  return moveToFreecell(state, from.col);
    if (from.area === 'freecell') return moveFreecellToFreecell(state, from.idx, to.idx);
  }
  // → tableau
  if (to.area === 'tableau') {
    if (from.area === 'freecell') return moveFreecellToTableau(state, from.idx, to.col);
    if (from.area === 'tableau')  return moveTableauToTableau(state, from.col, from.cardIdx, to.col);
  }
  return null;
}

// Double-click → auto-send to foundation
function handleDblClick(cx: number, cy: number): void {
  if (state.won) return;
  const zone = hitTest(state, canvas.clientWidth, cx, cy);
  if (!zone) return;
  let next: GameState | null = null;
  if (zone.area === 'tableau')  next = moveToFoundation(state, { from: 'tableau',  idx: zone.col });
  if (zone.area === 'freecell') next = moveToFoundation(state, { from: 'freecell', idx: zone.idx });
  if (next) applyState(next);
}

// ── Events ────────────────────────────────────────────────────────────────────
let lastClick = 0;
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const cx   = e.clientX - rect.left;
  const cy   = e.clientY - rect.top;
  const now  = Date.now();
  if (now - lastClick < 350) { handleDblClick(cx, cy); lastClick = 0; return; }
  lastClick = now;
  handleClick(cx, cy);
});

btnNew.addEventListener('click',  startNew);
btnUndo.addEventListener('click', () => applyState(undo(state), false));
btnHint.addEventListener('click', showHint);
overlayBtn.addEventListener('click', startNew);

const ro = new ResizeObserver(() => draw());
ro.observe(canvas);

// ── Boot ──────────────────────────────────────────────────────────────────────
const saved = loadGame();
if (saved) {
  state     = saved;
  moveCount = saved.history.length;
} else {
  state = newGame();
}
draw();
updateUI();
