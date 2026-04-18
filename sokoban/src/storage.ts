import type { GameState } from './game';

const KEY = 'sokoban_session';

/** Données persistées dans le localStorage */
export interface SavedSession {
  setId:          string;
  levelIndex:     number;
  grid:           number[][];   // Cell[][] sérialisé en nombres
  playerX:        number;
  playerY:        number;
  moves:          number;
  goalsRemaining: number;
  width:          number;
  height:         number;
}

/** Sauvegarde l'état courant. Silencieux en cas d'erreur (mode privé, stockage plein…) */
export function saveSession(setId: string, levelIndex: number, state: GameState): void {
  try {
    const session: SavedSession = {
      setId,
      levelIndex,
      grid:           state.grid as unknown as number[][],
      playerX:        state.playerX,
      playerY:        state.playerY,
      moves:          state.moves,
      goalsRemaining: state.goalsRemaining,
      width:          state.width,
      height:         state.height,
    };
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Ignoré
  }
}

/** Charge la session précédente, ou null si absente / invalide */
export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedSession;
    // Validation minimale
    if (
      typeof s.setId          !== 'string'  ||
      typeof s.levelIndex     !== 'number'  ||
      !Array.isArray(s.grid)               ||
      typeof s.playerX        !== 'number'  ||
      typeof s.playerY        !== 'number'
    ) return null;
    return s;
  } catch {
    return null;
  }
}
