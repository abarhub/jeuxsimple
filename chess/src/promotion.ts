export type PromoPiece = 'q' | 'r' | 'b' | 'n';

const SYMBOLS: Record<PromoPiece, string> = { q: '♛', r: '♜', b: '♝', n: '♞' };
const LABELS:  Record<PromoPiece, string> = { q: 'Dame', r: 'Tour', b: 'Fou', n: 'Cavalier' };

const overlay   = document.getElementById('promotion-overlay')!;
const piecesDiv = document.getElementById('promotion-pieces')!;

export function askPromotion(): Promise<PromoPiece> {
  return new Promise(resolve => {
    piecesDiv.innerHTML = '';

    const pieces: PromoPiece[] = ['q', 'r', 'b', 'n'];
    for (const p of pieces) {
      const btn = document.createElement('button');
      btn.className = 'promo-btn';
      btn.title = LABELS[p];
      btn.textContent = SYMBOLS[p];
      btn.addEventListener('click', () => {
        overlay.classList.remove('active');
        resolve(p);
      });
      piecesDiv.appendChild(btn);
    }

    overlay.classList.add('active');
  });
}
