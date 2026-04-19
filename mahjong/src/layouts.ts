// ── Layout definitions ────────────────────────────────────────────────────────
// Each position is [col, row, layer] (0-based).
// Cols and rows use half-tile units so tiles can be offset by half a tile.
// Two tiles at the same [col,row] on adjacent layers stack.
// Tiles occupy 2 half-units wide × 2 half-units tall.

export interface LayoutDef {
  name: string;
  positions: [number, number, number][];  // [col, row, layer] in half-tile units
}

// ── Shanghai (classic turtle shape, 144 tiles) ────────────────────────────────
function shanghaiPositions(): [number, number, number][] {
  const p: [number, number, number][] = [];

  // Layer 0: main field — rows 0-13 (half units), cols 0-25
  const layer0: [number, number][] = [
    // row 0: cols 4-21
    ...[4,6,8,10,12,14,16,18,20].map(c => [c, 0] as [number,number]),
    // row 2: cols 2-23
    ...[2,4,6,8,10,12,14,16,18,20,22].map(c => [c, 2] as [number,number]),
    // row 4: cols 0-25
    ...[0,2,4,6,8,10,12,14,16,18,20,22,24].map(c => [c, 4] as [number,number]),
    // row 6: cols 0-25 + extra right
    ...[0,2,4,6,8,10,12,14,16,18,20,22,24,26].map(c => [c, 6] as [number,number]),
    // row 8: cols 0-25
    ...[0,2,4,6,8,10,12,14,16,18,20,22,24].map(c => [c, 8] as [number,number]),
    // row 10: cols 2-23
    ...[2,4,6,8,10,12,14,16,18,20,22].map(c => [c, 10] as [number,number]),
    // row 12: cols 4-21
    ...[4,6,8,10,12,14,16,18,20].map(c => [c, 12] as [number,number]),
  ];
  layer0.forEach(([c, r]) => p.push([c, r, 0]));

  // Layer 1: smaller inner rectangle
  const layer1: [number, number][] = [
    ...[4,6,8,10,12,14,16,18,20].map(c => [c, 2] as [number,number]),
    ...[4,6,8,10,12,14,16,18,20].map(c => [c, 4] as [number,number]),
    ...[4,6,8,10,12,14,16,18,20].map(c => [c, 6] as [number,number]),
    ...[4,6,8,10,12,14,16,18,20].map(c => [c, 8] as [number,number]),
    ...[4,6,8,10,12,14,16,18,20].map(c => [c, 10] as [number,number]),
  ];
  layer1.forEach(([c, r]) => p.push([c, r, 1]));

  // Layer 2: smaller
  const layer2: [number, number][] = [
    ...[6,8,10,12,14,16,18].map(c => [c, 4] as [number,number]),
    ...[6,8,10,12,14,16,18].map(c => [c, 6] as [number,number]),
    ...[6,8,10,12,14,16,18].map(c => [c, 8] as [number,number]),
  ];
  layer2.forEach(([c, r]) => p.push([c, r, 2]));

  // Layer 3: 4 tiles
  [[10,6],[12,6],[10,8],[12,8]].forEach(([c,r]) => p.push([c, r, 3]));

  // Layer 4: 1 tile (top)
  p.push([11, 7, 4]);

  // Single tile far right (head of turtle)
  p.push([28, 6, 0]);

  return p;
}

// ── Turtle layout (144 tiles) ─────────────────────────────────────────────────
function turtlePositions(): [number, number, number][] {
  const p: [number, number, number][] = [];

  // Body
  const rows: [number, number[]][] = [
    [0, [6,8,10,12,14,16,18]],
    [2, [4,6,8,10,12,14,16,18,20]],
    [4, [4,6,8,10,12,14,16,18,20]],
    [6, [4,6,8,10,12,14,16,18,20]],
    [8, [4,6,8,10,12,14,16,18,20]],
    [10,[4,6,8,10,12,14,16,18,20]],
    [12,[4,6,8,10,12,14,16,18,20]],
    [14,[6,8,10,12,14,16,18]],
  ];
  rows.forEach(([r, cols]) => cols.forEach(c => p.push([c, r, 0])));

  // Layer 1
  [[6,2],[8,2],[10,2],[12,2],[14,2],[16,2],[18,2],
   [6,4],[8,4],[10,4],[12,4],[14,4],[16,4],[18,4],
   [6,6],[8,6],[10,6],[12,6],[14,6],[16,6],[18,6],
   [6,8],[8,8],[10,8],[12,8],[14,8],[16,8],[18,8],
   [6,10],[8,10],[10,10],[12,10],[14,10],[16,10],[18,10],
  ].forEach(([c,r]) => p.push([c,r,1]));

  // Layer 2
  [[8,4],[10,4],[12,4],[14,4],[16,4],
   [8,6],[10,6],[12,6],[14,6],[16,6],
   [8,8],[10,8],[12,8],[14,8],[16,8],
  ].forEach(([c,r]) => p.push([c,r,2]));

  // Layer 3
  [[10,6],[12,6],[10,8],[12,8]].forEach(([c,r]) => p.push([c,r,3]));

  // Top
  p.push([11,7,4]);

  // Head and tail
  p.push([2,6,0]); p.push([2,8,0]);   // left fins
  p.push([22,6,0]); p.push([22,8,0]); // right fins
  p.push([11,16,0]);                   // tail

  return p;
}

// ── Pyramid (28 tiles) — small but different ──────────────────────────────────
function pyramidPositions(): [number, number, number][] {
  const p: [number, number, number][] = [];
  // Base: 7 rows × widening
  const bases: [number, number[]][] = [
    [12,[2,4,6,8,10,12,14,16,18,20,22,24,26]],
    [10,[4,6,8,10,12,14,16,18,20,22,24]],
    [8, [6,8,10,12,14,16,18,20,22]],
    [6, [8,10,12,14,16,18,20]],
    [4, [10,12,14,16,18]],
    [2, [12,14,16]],
    [0, [14]],
  ];
  bases.forEach(([r, cols]) => cols.forEach(c => p.push([c, r, 0])));

  // Layer 1
  [[4,10],[6,10],[8,10],[10,10],[12,10],[14,10],[16,10],[18,10],[20,10],[22,10],
   [6,8],[8,8],[10,8],[12,8],[14,8],[16,8],[18,8],[20,8],
   [8,6],[10,6],[12,6],[14,6],[16,6],[18,6],
   [10,4],[12,4],[14,4],[16,4],
   [12,2],[14,2],
  ].forEach(([c,r]) => p.push([c,r,1]));

  [[8,8],[10,8],[12,8],[14,8],[16,8],[18,8],
   [10,6],[12,6],[14,6],[16,6],
   [12,4],[14,4],
  ].forEach(([c,r]) => p.push([c,r,2]));

  [[12,6],[14,6],[12,8],[14,8]].forEach(([c,r]) => p.push([c,r,3]));
  p.push([13,7,4]);

  return p;
}

// ── Dragon layout ─────────────────────────────────────────────────────────────
function dragonPositions(): [number, number, number][] {
  const p: [number, number, number][] = [];

  // Spine
  [2,4,6,8,10,12,14,16,18,20,22,24].forEach(c => p.push([c,6,0]));

  // Wings
  [2,4,6,8,10,12,14,16].forEach(c => p.push([c,2,0]));
  [2,4,6,8,10,12,14,16].forEach(c => p.push([c,10,0]));

  // Neck
  [[18,4],[20,4],[18,8],[20,8]].forEach(([c,r]) => p.push([c,r,0]));

  // Head
  [[24,4],[24,6],[24,8],[26,4],[26,6],[26,8],[28,6]].forEach(([c,r]) => p.push([c,r,0]));

  // Tail curl
  [[0,4],[0,6],[0,8]].forEach(([c,r]) => p.push([c,r,0]));

  // Layer 1 on spine center
  [8,10,12,14,16].forEach(c => p.push([c,6,1]));
  [8,10,12,14,16].forEach(c => p.push([c,4,1]));
  [8,10,12,14,16].forEach(c => p.push([c,8,1]));

  // Layer 2
  [10,12,14].forEach(c => p.push([c,6,2]));

  // Top
  p.push([12,6,3]);

  return p;
}

// ── Cross layout ──────────────────────────────────────────────────────────────
function crossPositions(): [number, number, number][] {
  const p: [number, number, number][] = [];

  // Horizontal bar
  [0,2,4,6,8,10,12,14,16,18,20,22,24].forEach(c => p.push([c,6,0]));
  [0,2,4,6,8,10,12,14,16,18,20,22,24].forEach(c => p.push([c,8,0]));

  // Vertical bar
  [2,4,6,8,10,12,14,16,18].forEach(r => p.push([12,r,0]));
  [2,4,6,8,10,12,14,16,18].forEach(r => p.push([14,r,0]));

  // Layer 1: center cross
  [4,6,8,10,12,14,16,18,20].forEach(c => p.push([c,6,1]));
  [4,6,8,10,12,14,16,18,20].forEach(c => p.push([c,8,1]));
  [4,6,8,10,12].forEach(r => p.push([12,r,1]));
  [4,6,8,10,12].forEach(r => p.push([14,r,1]));

  // Layer 2 center
  [8,10,12,14,16].forEach(c => p.push([c,6,2]));
  [8,10,12,14,16].forEach(c => p.push([c,8,2]));

  // Layer 3 top
  [[12,6],[14,6],[12,8],[14,8]].forEach(([c,r]) => p.push([c,r,3]));
  p.push([13,7,4]);

  return p;
}

export const LAYOUTS: LayoutDef[] = [
  { name: 'Shanghai',  positions: shanghaiPositions()  },
  { name: 'Tortue',    positions: turtlePositions()    },
  { name: 'Pyramide',  positions: pyramidPositions()   },
  { name: 'Dragon',    positions: dragonPositions()    },
  { name: 'Croix',     positions: crossPositions()     },
];
