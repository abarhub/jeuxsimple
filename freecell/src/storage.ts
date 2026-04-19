// ── Session storage (lost when tab/browser is closed) ────────────────────────
import { type GameState } from './game';

const KEY = 'freecell_state';

export function saveGame(state: GameState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function loadGame(): GameState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (!Array.isArray(s.tableau) || !Array.isArray(s.freecells)) return null;
    return s;
  } catch { return null; }
}

export function clearGame(): void {
  sessionStorage.removeItem(KEY);
}
