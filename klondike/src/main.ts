import {
  newGame, drawFromStock,
  moveWasteToTableau, moveWasteToFoundation,
  moveTableauToTableau, moveTableauToFoundation,
  moveFoundationToTableau, autoComplete,
} from './game';
import type { GameState, ColorMode } from './game';
import { render, hitTest, canvasWidth, type Selection, type HitResult } from './renderer';
import { saveGame, loadGame } from './storage';

// ── DOM ──────────────────────────────────────────────────────────────────────
const canvas     = document.getElementById('gameCanvas')  as HTMLCanvasElement;
const ctx        = canvas.getContext('2d')!;
const modeSelect = document.getElementById('modeSelect')  as HTMLSelectElement;
const newGameBtn = document.getElementById('newGameBtn')  as HTMLButtonElement;
const autoBtn    = document.getElementById('autoBtn')     as HTMLButtonElement;
const undoBtn    = document.getElementById('undoBtn')     as HTMLButtonElement;
const movesEl    = document.getElementById('moves')!;
const messageEl  = document.getElementById('message')!;

// ── État ──────────────────────────────────────────────────────────────────────
let state: GameState;
let selection: Selection = null;
let history: GameState[] = [];

// ── Rendu ─────────────────────────────────────────────────────────────────────
function draw() {
  canvas.width = canvasWidth(); // sera ajusté finement dans render()
  render(ctx, state, selection);
  movesEl.textContent = `Déplacements : ${state.moves}`;
  messageEl.textContent = state.won
    ? '🎉 Félicitations, vous avez gagné !'
    : '';
}

// ── Persistance ───────────────────────────────────────────────────────────────
function persist() { saveGame(state); }

// ── Application d'un mouvement ────────────────────────────────────────────────
function applyMove(next: GameState | null): boolean {
  if (!next) return false;
  history.push(state);
  state     = next;
  selection = null;
  persist();
  draw();
  return true;
}

// ── Gestion des clics ─────────────────────────────────────────────────────────
function handleHit(hit: HitResult): void {
  if (state.won) return;

  // Talon : toujours piocher
  if (hit.area === 'stock') {
    selection = null;
    applyMove(drawFromStock(state));
    return;
  }

  if (hit.area === 'none') {
    selection = null;
    draw();
    return;
  }

  // ── Aucune sélection : sélectionner une source ────────────────────────────
  if (selection === null) {
    if (hit.area === 'waste' && state.waste.length > 0) {
      selection = { src: 'waste' };
      draw();
    } else if (hit.area === 'tableau') {
      const card = state.tableau[hit.col]?.[hit.cardIndex];
      if (card?.faceUp) {
        selection = { src: 'tableau', col: hit.col, cardIndex: hit.cardIndex };
        draw();
      }
    } else if (hit.area === 'foundation') {
      const f = state.foundations[hit.index];
      if (f.length > 0) {
        selection = { src: 'foundation', foundIdx: hit.index };
        draw();
      }
    }
    return;
  }

  // ── Sélection active : tenter un déplacement ──────────────────────────────
  let moved = false;

  if (selection.src === 'waste') {
    if (hit.area === 'tableau') {
      moved = applyMove(moveWasteToTableau(state, hit.col));
    } else if (hit.area === 'foundation') {
      moved = applyMove(moveWasteToFoundation(state));
    } else if (hit.area === 'waste') {
      selection = null; draw();
      return;
    }

  } else if (selection.src === 'tableau') {
    if (hit.area === 'tableau') {
      if (hit.col === selection.col) {
        // Clic sur la même colonne : désélectionner ou sélectionner plus bas
        const newIdx = hit.cardIndex;
        if (newIdx === selection.cardIndex) {
          selection = null; draw();
        } else if (newIdx > selection.cardIndex) {
          selection = { src: 'tableau', col: selection.col, cardIndex: newIdx };
          draw();
        } else {
          selection = null; draw();
        }
        return;
      }
      moved = applyMove(moveTableauToTableau(state, selection.col, selection.cardIndex, hit.col));
    } else if (hit.area === 'foundation') {
      // Seulement la carte du dessus va en fondation
      const col = state.tableau[selection.col];
      if (selection.cardIndex === col.length - 1) {
        moved = applyMove(moveTableauToFoundation(state, selection.col));
      }
    }

  } else if (selection.src === 'foundation') {
    if (hit.area === 'tableau') {
      moved = applyMove(moveFoundationToTableau(state, selection.foundIdx, hit.col));
    } else if (hit.area === 'foundation' && hit.index === selection.foundIdx) {
      selection = null; draw();
      return;
    }
  }

  // Déplacement échoué → essayer de sélectionner la cible comme nouvelle source
  if (!moved) {
    if (hit.area === 'waste' && state.waste.length > 0) {
      selection = { src: 'waste' };
    } else if (hit.area === 'tableau') {
      const card = state.tableau[hit.col]?.[hit.cardIndex];
      selection  = card?.faceUp ? { src: 'tableau', col: hit.col, cardIndex: hit.cardIndex } : null;
    } else if (hit.area === 'foundation' && state.foundations[hit.index].length > 0) {
      selection = { src: 'foundation', foundIdx: hit.index };
    } else {
      selection = null;
    }
    draw();
  }
}

canvas.addEventListener('click', (e: MouseEvent) => {
  const r  = canvas.getBoundingClientRect();
  const sx = canvas.width  / r.width;
  const sy = canvas.height / r.height;
  const mx = (e.clientX - r.left) * sx;
  const my = (e.clientY - r.top)  * sy;
  handleHit(hitTest(mx, my, state));
});

canvas.addEventListener('dblclick', (e: MouseEvent) => {
  if (state.won) return;
  const r  = canvas.getBoundingClientRect();
  const sx = canvas.width  / r.width;
  const sy = canvas.height / r.height;
  const mx = (e.clientX - r.left) * sx;
  const my = (e.clientY - r.top)  * sy;
  const hit = hitTest(mx, my, state);
  selection = null;

  if (hit.area === 'waste') {
    applyMove(moveWasteToFoundation(state));
  } else if (hit.area === 'tableau') {
    const col = state.tableau[hit.col];
    if (hit.cardIndex === col.length - 1) {
      applyMove(moveTableauToFoundation(state, hit.col));
    }
  }
});

// ── Boutons ───────────────────────────────────────────────────────────────────
newGameBtn.addEventListener('click', () => {
  state     = newGame(state.mode);
  selection = null;
  history   = [];
  persist();
  draw();
});

autoBtn.addEventListener('click', () => {
  const next = autoComplete(state);
  if (next !== state) {
    history.push(state);
    state     = next;
    selection = null;
    persist();
    draw();
  }
});

undoBtn.addEventListener('click', () => {
  if (history.length === 0) return;
  state     = history.pop()!;
  selection = null;
  persist();
  draw();
});

modeSelect.addEventListener('change', () => {
  const mode = modeSelect.value as ColorMode;
  state      = newGame(mode);
  selection  = null;
  history    = [];
  persist();
  draw();
});

// ── Initialisation ────────────────────────────────────────────────────────────
const saved = loadGame();
if (saved) {
  state = saved;
  modeSelect.value = state.mode;
} else {
  state = newGame('normal');
}
selection = null;
draw();
