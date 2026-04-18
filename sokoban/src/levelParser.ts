export interface LevelData {
  title: string;
  map: string[];
}

export interface LevelSet {
  id: string;
  name: string;
  file: string;
}

export const LEVEL_SETS: LevelSet[] = [
  { id: 'easy',     name: 'Facile',                      file: './levels/easy.sok'     },
  { id: 'original', name: 'Original (Thinking Rabbit)',  file: './levels/original.sok' },
  { id: 'microban', name: 'Microban (David Skinner)',    file: './levels/microban.sok' },
];

/** Retourne vrai si la ligne fait partie d'une grille Sokoban */
function isMapLine(line: string): boolean {
  if (line.length === 0) return false;
  // Doit contenir au moins un caractère de jeu
  if (!/[#@+$.*]/.test(line)) return false;
  // Ne doit contenir que des caractères valides (espaces, tabulations inclus pour l'indentation)
  return /^[ \t#@+$.*]+$/.test(line);
}

/**
 * Parse un fichier .sok et retourne la liste de niveaux.
 * Format supporté :
 *   - Lignes commençant par ";" ou "'" : commentaire / titre du prochain niveau
 *   - Lignes "Title: ..." : titre du niveau
 *   - Lignes de grille  : caractères #  @ + $ . *
 *   - Ligne vide        : séparateur entre niveaux
 */
export function parseSok(content: string): LevelData[] {
  const lines = content.split('\n').map(l => l.replace(/\r$/, ''));
  const levels: LevelData[] = [];

  let pendingTitle = '';
  let mapLines: string[] = [];
  let counter = 0;

  const flush = () => {
    if (mapLines.length === 0) return;
    // Retire les lignes vides en fin de grille
    while (mapLines.length > 0 && mapLines[mapLines.length - 1].trim() === '') {
      mapLines.pop();
    }
    if (mapLines.length === 0) return;
    counter++;
    levels.push({
      title: pendingTitle || `Niveau ${counter}`,
      map: mapLines,
    });
    mapLines = [];
    pendingTitle = '';
  };

  for (const line of lines) {
    if (isMapLine(line)) {
      mapLines.push(line);
    } else if (line.trim() === '') {
      flush();
    } else if (line.startsWith(';') || line.startsWith("'")) {
      // Commentaire : si une grille est en cours, la terminer d'abord
      if (mapLines.length > 0) flush();
      const title = line.replace(/^[;'\s]+/, '').trim();
      if (title) pendingTitle = title;
    } else if (/^Title:/i.test(line)) {
      if (mapLines.length > 0) flush();
      pendingTitle = line.replace(/^Title:\s*/i, '').trim();
    }
    // Les autres lignes (Author:, Date:, etc.) sont ignorées
  }
  flush();

  return levels;
}

/** Charge et parse un fichier .sok via fetch */
export async function loadLevelSet(set: LevelSet): Promise<LevelData[]> {
  const response = await fetch(set.file);
  if (!response.ok) throw new Error(`Impossible de charger ${set.file}`);
  const text = await response.text();
  return parseSok(text);
}
