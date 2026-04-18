import type { GameState } from './game';

const KEY = 'klondike_game';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Mode privé, stockage plein, etc.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    // Validation minimale de la structure
    if (
      !Array.isArray(s.stock)       ||
      !Array.isArray(s.waste)       ||
      !Array.isArray(s.foundations) ||
      !Array.isArray(s.tableau)     ||
      s.foundations.length !== 4    ||
      s.tableau.length     !== 7    ||
      (s.mode !== 'normal' && s.mode !== 'mono')
    ) return null;
    return s;
  } catch {
    return null;
  }
}
