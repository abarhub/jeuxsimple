import { Chess } from 'chess.js';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

import { toDests, toColor, isPawnPromotion } from './chessUtils';
import { askPromotion } from './promotion';

// ── DOM ───────────────────────────────────────────────────────────────────────
const boardContainer = document.getElementById('board-container')!;
const modeSelect     = document.getElementById('modeSelect') as HTMLSelectElement;
const newGameBtn     = document.getElementById('newGameBtn') as HTMLButtonElement;
const flipBtn        = document.getElementById('flipBtn')    as HTMLButtonElement;
const statusEl       = document.getElementById('status')!;
const movesListEl    = document.getElementById('moves-list')!;

// ── Types ─────────────────────────────────────────────────────────────────────
type GameMode = 'pvp' | 'ai-white' | 'ai-black';

// ── State ─────────────────────────────────────────────────────────────────────
let chess: Chess;
let ground: Api;
let mode: GameMode = 'pvp';
let aiThinking = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function humanColor(): 'white' | 'black' {
  if (mode === 'ai-white') return 'white';
  if (mode === 'ai-black') return 'black';
  return 'white'; // pvp: both playable
}

function isAiTurn(): boolean {
  if (mode === 'pvp') return false;
  const aiColor = mode === 'ai-white' ? 'black' : 'white';
  return toColor(chess) === aiColor && !chess.isGameOver();
}

function updateMovable(): void {
  const color = toColor(chess);
  const over  = chess.isGameOver();

  if (over) {
    ground.set({ movable: { color: undefined, dests: new Map() } });
    return;
  }

  if (mode === 'pvp') {
    ground.set({
      movable: {
        color,
        dests: toDests(chess),
      },
    });
  } else {
    // Only allow moves for the human side
    const myColor = humanColor();
    if (color === myColor) {
      ground.set({
        movable: { color: myColor, dests: toDests(chess) },
      });
    } else {
      ground.set({
        movable: { color: undefined, dests: new Map() },
      });
    }
  }
}

function updateStatus(): void {
  const color = toColor(chess);
  const colorLabel = color === 'white' ? 'Blancs' : 'Noirs';
  const colorClass = color === 'white' ? 'turn-white' : 'turn-black';

  let html = '';

  if (chess.isCheckmate()) {
    const winner = color === 'white' ? 'Noirs' : 'Blancs';
    html = `<div class="result">♚ Échec et mat — ${winner} gagnent !</div>`;
  } else if (chess.isStalemate()) {
    html = `<div class="result">Pat — match nul</div>`;
  } else if (chess.isInsufficientMaterial()) {
    html = `<div class="result">Matériel insuffisant — nul</div>`;
  } else if (chess.isThreefoldRepetition()) {
    html = `<div class="result">Triple répétition — nul</div>`;
  } else if (chess.isDraw()) {
    html = `<div class="result">Nul (50 coups)</div>`;
  } else {
    const check = chess.inCheck() ? ' <span style="color:#f66">†</span>' : '';
    html = `<div class="turn-label ${colorClass}">${colorLabel} à jouer${check}</div>`;
    if (mode !== 'pvp' && isAiTurn()) {
      html += `<div style="margin-top:6px;font-size:0.85rem;color:#888">L'IA réfléchit…</div>`;
    }
  }

  statusEl.innerHTML = html;
}

function updateMovesList(): void {
  const history = chess.history();
  movesListEl.innerHTML = '';

  for (let i = 0; i < history.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-pair';

    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = `${Math.floor(i / 2) + 1}.`;

    const mw = document.createElement('span');
    mw.className = 'move-w';
    mw.textContent = history[i] ?? '';

    const mb = document.createElement('span');
    mb.className = 'move-b';
    mb.textContent = history[i + 1] ?? '';

    row.appendChild(num);
    row.appendChild(mw);
    row.appendChild(mb);
    movesListEl.appendChild(row);
  }

  // Scroll to bottom
  movesListEl.scrollTop = movesListEl.scrollHeight;
}

// ── After each move ───────────────────────────────────────────────────────────

function afterMove(): void {
  ground.set({ fen: chess.fen() });
  updateMovable();
  updateStatus();
  updateMovesList();

  if (isAiTurn() && !aiThinking) {
    aiThinking = true;
    const delay = 300 + Math.random() * 200; // 300–500 ms
    setTimeout(() => {
      doAiMove();
      aiThinking = false;
    }, delay);
  }
}

// ── AI ────────────────────────────────────────────────────────────────────────

function doAiMove(): void {
  if (chess.isGameOver()) return;
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return;

  const mv = moves[Math.floor(Math.random() * moves.length)];
  chess.move(mv);

  // Highlight the AI's move
  ground.move(mv.from as Key, mv.to as Key);
  afterMove();
}

// ── Move handler (human) ──────────────────────────────────────────────────────

async function handleMove(orig: Key, dest: Key): Promise<void> {
  try {
    if (isPawnPromotion(chess, orig, dest)) {
      const piece = await askPromotion();
      chess.move({ from: orig as string, to: dest as string, promotion: piece });
    } else {
      chess.move({ from: orig as string, to: dest as string });
    }
  } catch {
    // Move was illegal (shouldn't happen since chessground limits to legal moves)
    ground.set({ fen: chess.fen() });
    updateMovable();
    return;
  }

  afterMove();
}

// ── Chessground init ──────────────────────────────────────────────────────────

function initGround(): void {
  const color = toColor(chess);

  ground = Chessground(boardContainer, {
    fen: chess.fen(),
    orientation: mode === 'ai-black' ? 'black' : 'white',
    turnColor: color,
    movable: {
      free: false,
      color,
      dests: toDests(chess),
      events: {
        after: (orig, dest) => {
          void handleMove(orig, dest);
        },
      },
    },
    animation: { enabled: true, duration: 150 },
    highlight: { lastMove: true, check: true },
    premovable: { enabled: false },
    draggable: { enabled: true },
  });
}

// ── New game ──────────────────────────────────────────────────────────────────

function startNewGame(): void {
  chess = new Chess();
  aiThinking = false;

  if (ground) {
    // Destroy and recreate
    ground.destroy();
  }

  initGround();
  updateStatus();
  updateMovesList();

  // If AI plays white, trigger AI immediately
  if (mode === 'ai-black') {
    // Human plays black, AI plays white (first move)
    aiThinking = true;
    setTimeout(() => {
      doAiMove();
      aiThinking = false;
    }, 600);
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────

newGameBtn.addEventListener('click', () => { startNewGame(); });

flipBtn.addEventListener('click', () => {
  ground.toggleOrientation();
});

modeSelect.addEventListener('change', () => {
  mode = modeSelect.value as GameMode;
  startNewGame();
});

// ── Start ─────────────────────────────────────────────────────────────────────
startNewGame();
