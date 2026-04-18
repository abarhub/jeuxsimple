import { LEVEL_SETS, loadLevelSet, type LevelData } from './levelParser';
import { parseLevel, move, isSolved, type GameState } from './game';
import { render, getCanvasSize } from './renderer';

// ── DOM ──────────────────────────────────────────────────────────────────────
const canvas       = document.getElementById('gameCanvas')     as HTMLCanvasElement;
const ctx          = canvas.getContext('2d')!;
const elLevelTitle = document.getElementById('levelTitle')!;
const elMoves      = document.getElementById('moves')!;
const elMessage    = document.getElementById('message')!;
const elLoading    = document.getElementById('loading')!;
const elSelect     = document.getElementById('levelSetSelect') as HTMLSelectElement;

// ── État ──────────────────────────────────────────────────────────────────────
let levels: LevelData[]  = [];
let currentIndex         = 0;
let gameState: GameState | null = null;
let history: GameState[] = [];

// ── Fonctions utilitaires ────────────────────────────────────────────────────
function resizeCanvas(): void {
  if (!gameState) return;
  const { width, height } = getCanvasSize(gameState);
  canvas.width  = width;
  canvas.height = height;
}

function updateUI(): void {
  if (!gameState) return;
  const total = levels.length;
  elLevelTitle.textContent = `${levels[currentIndex].title}  (${currentIndex + 1} / ${total})`;
  elMoves.textContent      = `Déplacements : ${gameState.moves}`;

  if (isSolved(gameState)) {
    elMessage.textContent = currentIndex < total - 1
      ? 'Niveau terminé ! Appuyez sur N pour continuer.'
      : 'Félicitations, tous les niveaux sont terminés !';
  } else {
    elMessage.textContent = '';
  }
}

function loadLevel(index: number): void {
  currentIndex = index;
  gameState    = parseLevel(levels[index]);
  history      = [];
  resizeCanvas();
  updateUI();
  render(ctx, gameState);
}

// ── Chargement d'une série ────────────────────────────────────────────────────
async function selectSet(id: string): Promise<void> {
  const set = LEVEL_SETS.find(s => s.id === id);
  if (!set) return;

  // Afficher l'indicateur de chargement
  elLoading.style.display    = 'block';
  elLevelTitle.textContent   = '';
  elMoves.textContent        = '';
  elMessage.textContent      = '';
  canvas.width               = 0;
  canvas.height              = 0;

  try {
    levels = await loadLevelSet(set);
  } catch (e) {
    elLoading.style.display  = 'none';
    elMessage.textContent    = `Erreur : impossible de charger « ${set.name} ».`;
    return;
  }

  elLoading.style.display = 'none';

  if (levels.length === 0) {
    elMessage.textContent = 'Aucun niveau trouvé dans ce fichier.';
    return;
  }

  loadLevel(0);
}

// ── Gestion du clavier ────────────────────────────────────────────────────────
function handleKey(e: KeyboardEvent): void {
  if (!gameState) return;

  if (isSolved(gameState)) {
    if (e.key === 'n' || e.key === 'N') {
      if (currentIndex < levels.length - 1) loadLevel(currentIndex + 1);
    }
    if (e.key === 'r' || e.key === 'R') loadLevel(currentIndex);
    return;
  }

  let dx = 0;
  let dy = 0;

  switch (e.key) {
    case 'ArrowUp':    case 'z': case 'Z': dy = -1; break;
    case 'ArrowDown':  case 's': case 'S': dy =  1; break;
    case 'ArrowLeft':  case 'q': case 'Q': dx = -1; break;
    case 'ArrowRight': case 'd': case 'D': dx =  1; break;
    case 'r': case 'R': loadLevel(currentIndex); return;
    case 'u': case 'U':
      if (history.length > 0) {
        gameState = history.pop()!;
        updateUI();
        render(ctx, gameState);
      }
      return;
    case 'n': case 'N':
      if (currentIndex < levels.length - 1) loadLevel(currentIndex + 1);
      return;
    default:
      return;
  }

  e.preventDefault();

  const prev = gameState;
  const next = move(gameState, dx, dy);
  if (next !== prev) {
    history.push(prev);
    gameState = next;
    updateUI();
    render(ctx, gameState);
  }
}

// ── Initialisation ────────────────────────────────────────────────────────────
document.addEventListener('keydown', handleKey);

elSelect.addEventListener('change', () => {
  selectSet(elSelect.value);
});

// Charger la série sélectionnée par défaut
selectSet(elSelect.value);
