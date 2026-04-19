// ── LocalStorage persistence ──────────────────────────────────────────────────
import { type GameState } from './game';

const KEY = 'mahjong_state';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (!Array.isArray(s.tiles) || !s.layoutName) return null;
    return s;
  } catch { return null; }
}

export function clearGame(): void {
  localStorage.removeItem(KEY);
}
