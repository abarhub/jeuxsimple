import type { GameState } from './game';

const KEY = 'spider_game';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode, storage full, etc.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (
      !Array.isArray(s.tableau)        || s.tableau.length        !== 10 ||
      !Array.isArray(s.stock)                                              ||
      !Array.isArray(s.completedSuits)                                     ||
      (s.mode !== 'black' && s.mode !== 'color')
    ) return null;
    return s;
  } catch {
    return null;
  }
}
