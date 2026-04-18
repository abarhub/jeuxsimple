import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { Key } from 'chessground/types';

const ALL_SQUARES: Square[] = [
  'a1','b1','c1','d1','e1','f1','g1','h1',
  'a2','b2','c2','d2','e2','f2','g2','h2',
  'a3','b3','c3','d3','e3','f3','g3','h3',
  'a4','b4','c4','d4','e4','f4','g4','h4',
  'a5','b5','c5','d5','e5','f5','g5','h5',
  'a6','b6','c6','d6','e6','f6','g6','h6',
  'a7','b7','c7','d7','e7','f7','g7','h7',
  'a8','b8','c8','d8','e8','f8','g8','h8',
];

/**
 * Builds the legal-destinations map expected by chessground.
 * Returns a Map<square, square[]> for all pieces of the current player.
 */
export function toDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();

  for (const sq of ALL_SQUARES) {
    const moves = chess.moves({ square: sq, verbose: true });
    if (moves.length > 0) {
      dests.set(sq as Key, moves.map(m => m.to as Key));
    }
  }
  return dests;
}

/**
 * Convert chess.js color ('w'|'b') to chessground color ('white'|'black').
 */
export function toColor(chess: Chess): 'white' | 'black' {
  return chess.turn() === 'w' ? 'white' : 'black';
}

/**
 * Detect if a proposed move is a pawn promotion.
 * Checks before calling chess.move() so we can show the dialog first.
 */
export function isPawnPromotion(chess: Chess, orig: Key, dest: Key): boolean {
  const piece = chess.get(orig as Square);
  if (!piece || piece.type !== 'p') return false;
  const destRank = dest[1];
  return (piece.color === 'w' && destRank === '8') ||
         (piece.color === 'b' && destRank === '1');
}
