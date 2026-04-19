// ── Tile definitions ──────────────────────────────────────────────────────────

export type TileSuit =
  | 'bamboo' | 'circles' | 'characters'   // numbered 1-9, 4 copies each
  | 'wind'                                  // East West South North, 4 copies each
  | 'dragon'                                // Red Green White, 4 copies each
  | 'flower'                                // 4 unique flower tiles (1 copy each)
  | 'season';                               // 4 unique season tiles (1 copy each)

export interface TileType {
  suit: TileSuit;
  value: number;   // 1-9 for suited, 1-4 for winds/flowers/seasons, 1-3 for dragons
  label: string;   // display character/emoji
  /** Tiles that match this one (same suit+value for most; flowers match any flower; seasons match any season) */
  group: number;   // tiles with identical group number are matches
}

// All 42 distinct tile types (each appears ×4 in the full set, except flowers/seasons ×1)
const BAMBOO:     TileType[] = [1,2,3,4,5,6,7,8,9].map((v,i) => ({
  suit: 'bamboo', value: v,
  label: ['🀐','🀑','🀒','🀓','🀔','🀕','🀖','🀗','🀘'][i],
  group: v,
}));

const CIRCLES:    TileType[] = [1,2,3,4,5,6,7,8,9].map((v,i) => ({
  suit: 'circles', value: v,
  label: ['🀙','🀚','🀛','🀜','🀝','🀞','🀟','🀠','🀡'][i],
  group: 9 + v,
}));

const CHARACTERS: TileType[] = [1,2,3,4,5,6,7,8,9].map((v,i) => ({
  suit: 'characters', value: v,
  label: ['🀇','🀈','🀉','🀊','🀋','🀌','🀍','🀎','🀏'][i],
  group: 18 + v,
}));

const WINDS: TileType[] = [
  { suit: 'wind', value: 1, label: '🀀', group: 28 }, // East
  { suit: 'wind', value: 2, label: '🀁', group: 29 }, // South
  { suit: 'wind', value: 3, label: '🀂', group: 30 }, // West
  { suit: 'wind', value: 4, label: '🀃', group: 31 }, // North
];

const DRAGONS: TileType[] = [
  { suit: 'dragon', value: 1, label: '🀄', group: 32 }, // Red (Chun)
  { suit: 'dragon', value: 2, label: '🀅', group: 33 }, // Green (Hatsu)
  { suit: 'dragon', value: 3, label: '🀆', group: 34 }, // White (Haku)
];

// Flowers match each other (any flower matches any flower)
const FLOWERS: TileType[] = [1,2,3,4].map(v => ({
  suit: 'flower' as TileSuit, value: v, label: ['🌸','🌼','🌺','🌻'][v-1], group: 35,
}));

// Seasons match each other
const SEASONS: TileType[] = [1,2,3,4].map(v => ({
  suit: 'season' as TileSuit, value: v, label: ['🌱','☀️','🍂','❄️'][v-1], group: 36,
}));

export const ALL_TILE_TYPES: TileType[] = [
  ...BAMBOO, ...CIRCLES, ...CHARACTERS, ...WINDS, ...DRAGONS, ...FLOWERS, ...SEASONS,
];

/**
 * Build a full set of 144 tiles (4× each suited/honor, 1× each flower/season)
 * Returns an array of tile type indices (into ALL_TILE_TYPES), shuffled.
 */
export function buildTileSet(): number[] {
  const set: number[] = [];
  ALL_TILE_TYPES.forEach((t, idx) => {
    const copies = (t.suit === 'flower' || t.suit === 'season') ? 1 : 4;
    for (let i = 0; i < copies; i++) set.push(idx);
  });
  // Fisher-Yates shuffle
  for (let i = set.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [set[i], set[j]] = [set[j], set[i]];
  }
  return set;
}

export function tilesMatch(a: number, b: number): boolean {
  return ALL_TILE_TYPES[a].group === ALL_TILE_TYPES[b].group;
}
