import {
  newGame, reveal, toggleFlag, chord, totalElapsed,
  PRESETS,
  type GameState, type GameConfig,
} from './game';

// ── DOM references ────────────────────────────────────────────────────────────
const gridEl      = document.getElementById('grid')!;
const smileyBtn   = document.getElementById('smiley')    as HTMLButtonElement;
const mineCountEl = document.getElementById('mine-count')!;
const timerEl     = document.getElementById('timer')!;
const presetBtns  = document.querySelectorAll<HTMLButtonElement>('[data-preset]');
const customPanel = document.getElementById('custom-panel')!;
const customForm  = document.getElementById('custom-form') as HTMLFormElement;
const rowsInput   = document.getElementById('custom-rows')  as HTMLInputElement;
const colsInput   = document.getElementById('custom-cols')  as HTMLInputElement;
const minesInput  = document.getElementById('custom-mines') as HTMLInputElement;

// ── State ─────────────────────────────────────────────────────────────────────
let state: GameState;
let timerInterval: ReturnType<typeof setInterval> | null = null;
const STORAGE_KEY = 'demineur_state';

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer(): void {
  if (timerInterval) return;
  timerInterval = setInterval(updateTimerDisplay, 500);
}

function stopTimer(): void {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay(): void {
  const secs = Math.min(999, Math.floor(totalElapsed(state) / 1000));
  timerEl.textContent = lcdFmt(secs);
}

// ── Formatting ────────────────────────────────────────────────────────────────
function lcdFmt(n: number, digits = 3): string {
  const c = Math.max(-99, Math.min(999, Math.round(n)));
  return (c < 0 ? '-' + Math.abs(c).toString().padStart(digits - 1, '0')
                : c.toString().padStart(digits, '0'));
}

// ── Rendering ─────────────────────────────────────────────────────────────────
const NUMBER_COLORS = ['', '#1010d8', '#007800', '#e00000', '#000090', '#7b0000', '#008888', '#000', '#888'];

function cellContent(r: number, c: number): string {
  const cell = state.grid[r][c];
  if (cell.state === 'flagged')   return '🚩';
  if (cell.state === 'wrongFlag') return '🚩✗';
  if (cell.state === 'hidden')    return '';
  // revealed
  if (cell.mine) return '💣';
  if (cell.adjacentMines > 0) return String(cell.adjacentMines);
  return '';
}

function applyCell(el: HTMLElement, r: number, c: number): void {
  const cell   = state.grid[r][c];
  const { exploded } = state;

  // Reset classes
  el.className   = 'cell';
  el.textContent = cellContent(r, c);
  el.style.color = '';
  el.style.background = '';

  if (cell.state === 'hidden' || cell.state === 'flagged') {
    el.classList.add('cell-up'); // raised
  } else if (cell.state === 'wrongFlag') {
    el.classList.add('cell-up', 'cell-wrong');
  } else {
    // revealed
    el.classList.add('cell-down');
    if (cell.mine) {
      el.classList.add('cell-mine');
      if (exploded && exploded[0] === r && exploded[1] === c) {
        el.style.background = '#ff0000';
      }
    } else if (cell.adjacentMines > 0) {
      el.style.color = NUMBER_COLORS[cell.adjacentMines] ?? '#000';
    }
  }
}

function buildGrid(): void {
  const { rows, cols } = state.config;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 26px)`;
  gridEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const div = document.createElement('div');
      div.dataset.r = String(r);
      div.dataset.c = String(c);
      applyCell(div, r, c);
      frag.appendChild(div);
    }
  }
  gridEl.appendChild(frag);
}

function updateGrid(): void {
  const children = gridEl.children;
  const { rows, cols } = state.config;
  let i = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      applyCell(children[i++] as HTMLElement, r, c);
}

function updateHeader(): void {
  const remaining = state.config.mines - state.flagCount;
  mineCountEl.textContent = lcdFmt(remaining);
  smileyBtn.textContent = state.status === 'won' ? '😎'
                        : state.status === 'lost' ? '😵' : '🙂';
  updateTimerDisplay();
}

function render(rebuild = false): void {
  if (rebuild) buildGrid(); else updateGrid();
  updateHeader();
}

// ── Actions ───────────────────────────────────────────────────────────────────
function startNewGame(config: GameConfig): void {
  stopTimer();
  state = newGame(config);
  render(true);
  persist();
}

function handleReveal(r: number, c: number): void {
  if (state.status === 'won' || state.status === 'lost') return;

  const cell = state.grid[r][c];

  // Click on a revealed number → chord
  if (cell.state === 'revealed' && cell.adjacentMines > 0) {
    state = chord(state, r, c);
  } else {
    state = reveal(state, r, c);
  }

  // Start/stop timer
  if (state.status === 'playing' && state.startTime && !timerInterval) startTimer();
  if (state.status === 'won' || state.status === 'lost') stopTimer();

  render();
  persist();
}

function handleFlag(r: number, c: number): void {
  if (state.status !== 'playing') return;
  state = toggleFlag(state, r, c);
  render();
  persist();
}

// ── Events ────────────────────────────────────────────────────────────────────
gridEl.addEventListener('click', e => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
  if (!el) return;
  handleReveal(Number(el.dataset.r), Number(el.dataset.c));
});

gridEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
  if (!el) return;
  handleFlag(Number(el.dataset.r), Number(el.dataset.c));
});

// Prevent middle-click from opening links
gridEl.addEventListener('auxclick', e => e.preventDefault());

smileyBtn.addEventListener('click', () => startNewGame(state.config));

presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset!;
    presetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    customPanel.style.display = preset === 'custom' ? 'flex' : 'none';
    if (preset !== 'custom') startNewGame(PRESETS[preset]);
  });
});

customForm.addEventListener('submit', e => {
  e.preventDefault();
  const rows  = Math.max(5, Math.min(40, parseInt(rowsInput.value)  || 9));
  const cols  = Math.max(5, Math.min(60, parseInt(colsInput.value)  || 9));
  const mines = Math.max(1, Math.min(rows * cols - 9, parseInt(minesInput.value) || 10));
  rowsInput.value  = String(rows);
  colsInput.value  = String(cols);
  minesInput.value = String(mines);
  startNewGame({ rows, cols, mines, preset: 'custom' });
});

// ── Persistence ───────────────────────────────────────────────────────────────
function persist(): void {
  // Only save in-progress games
  if (state.status === 'won' || state.status === 'lost') {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  // Snapshot elapsed before storing (so we don't rely on startTime on reload)
  const snapshot: GameState = {
    ...state,
    elapsed:   totalElapsed(state),
    startTime: null,           // will be reset to Date.now() on restore
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* ignore */ }
}

function loadSaved(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    // Minimal validation
    if (
      !Array.isArray(s.grid)    ||
      !s.config                 ||
      !s.config.rows            ||
      !s.config.cols            ||
      !s.config.mines           ||
      s.status === 'won'        ||
      s.status === 'lost'
    ) return null;
    // Resume timer from saved elapsed
    if (s.status === 'playing') s.startTime = Date.now();
    return s;
  } catch { return null; }
}

// ── Initialisation ────────────────────────────────────────────────────────────
const saved = loadSaved();
if (saved) {
  state = saved;
  // Sync preset buttons
  const preset = state.config.preset;
  presetBtns.forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
  if (preset === 'custom') {
    customPanel.style.display = 'flex';
    rowsInput.value  = String(state.config.rows);
    colsInput.value  = String(state.config.cols);
    minesInput.value = String(state.config.mines);
  }
  render(true);
  if (state.status === 'playing') startTimer();
} else {
  state = newGame(PRESETS['beginner']);
  render(true);
}
