// ──────────────────────────────────────────────────────────
// SQUADRANT — Grid logic with per-difficulty grid sizes
// Easy / Advanced  → 10x10 (-5..+4)
// Average          → 15x15 (-7..+7)
// Legacy fallback  → 21x21 (-10..+10)
// ──────────────────────────────────────────────────────────

export const DEFAULT_GC = { size: 21, min: -10, max: 10 };

// LEGACY exports (kept so older imports still compile)
export const GRID_SIZE = 21;
export const GRID_MIN  = -10;
export const GRID_MAX  = 10;

/** Returns the grid config for a given difficulty string.
 *  All grids are now SYMMETRIC (same number of cells on positive and negative sides). */
export function getGridConfig(difficulty) {
  if (difficulty === 'average')  return { size: 15, min: -7, max: 7 };   // 7x7 quadrants
  if (difficulty === 'easy' || difficulty === 'advanced') return { size: 11, min: -5, max: 5 }; // 5x5 quadrants
  return DEFAULT_GC;
}

/** Derives grid config from a grid array's length */
export function gcFromGrid(grid) {
  const size = grid?.length || 21;
  if (size === 11) return { size: 11, min: -5,  max: 5  };
  if (size === 15) return { size: 15, min: -7,  max: 7  };
  if (size === 21) return DEFAULT_GC;
  const half = Math.floor(size / 2);
  return { size, min: -half, max: size - half - 1 };
}

export const SHIPS = [
  { id: 1, name: 'Carrier',      size: 5, symbol: '🚢' },
  { id: 2, name: 'Battleship A', size: 4, symbol: '⚓' },
  { id: 3, name: 'Battleship B', size: 4, symbol: '⚓' },
  { id: 4, name: 'Cruiser',      size: 3, symbol: '🛥️' },
  { id: 5, name: 'Patrol A',     size: 2, symbol: '🚤' },
  { id: 6, name: 'Patrol B',     size: 2, symbol: '🚤' },
];

// Defense structures — placed alongside ships, absorb attacks
export const DEFENSES = [
  { id: 1, name: 'Bunker',     size: 5, symbol: '🏰' },
  { id: 2, name: 'Wall A',     size: 4, symbol: '🧱' },
  { id: 3, name: 'Wall B',     size: 4, symbol: '🧱' },
  { id: 4, name: 'Tower',      size: 3, symbol: '🗼' },
  { id: 5, name: 'Outpost A',  size: 2, symbol: '⛺' },
  { id: 6, name: 'Outpost B',  size: 2, symbol: '⛺' },
];

export const WEAPONS = [
  { id: 'rocket', name: 'Rocket',   icon: '🚀', hits: 1,      count: 999, desc: 'Single point strike' },
  { id: 'bomb',   name: 'Air Bomb', icon: '💣', hits: 'cross', count: 3,   desc: 'Hits X, Y and adjacents' },
  { id: 'nuke',   name: 'Nuke',     icon: '☢️', hits: 'area',  count: 1,   desc: '3x3 area devastation' },
];

/** Special skills — purchased with score points */
export const SKILLS = [
  // ── Deploy Rockets (offensive shot patterns) ──
  { id: 'h-shot',    name: 'Horizontal Shot', cost: 50, icon: '↔', category: 'rocket',
    desc: 'Strike 5 cells in a horizontal line' },
  { id: 'd-shot',    name: 'Diagonal Shot',   cost: 60, icon: '↘', category: 'rocket',
    desc: 'Strike 5 cells along a diagonal' },
  { id: 'c-shot',    name: 'Curved Shot',     cost: 70, icon: '↩', category: 'rocket',
    desc: 'Strike 5 cells in an L-curve' },

  // ── Arsenal (utility) ──
  { id: 'radar',     name: 'Radar',           cost: 50, icon: '📡', category: 'arsenal',
    desc: 'Reveal one small (size 2) enemy ship' },
  { id: 'interfere', name: 'Interference',    cost: 60, icon: '⚡', category: 'arsenal',
    desc: "Block opponent's next attack turn" },
  { id: 'a-radar',   name: 'Advanced Radar',  cost: 70, icon: '🛰', category: 'arsenal',
    desc: 'Reveal 2 cells of a larger enemy ship' },
];

/** Compute targets for a skill shot relative to (x,y) */
export function getSkillShotTargets(skillId, x, y) {
  if (skillId === 'h-shot') {
    return [{x:x-2,y},{x:x-1,y},{x,y},{x:x+1,y},{x:x+2,y}];
  }
  if (skillId === 'd-shot') {
    return [{x:x-2,y:y-2},{x:x-1,y:y-1},{x,y},{x:x+1,y:y+1},{x:x+2,y:y+2}];
  }
  if (skillId === 'c-shot') {
    // L-shape: 3 horizontal then 2 vertical up from the right end
    return [{x,y},{x:x+1,y},{x:x+2,y},{x:x+2,y:y+1},{x:x+2,y:y+2}];
  }
  return [{x,y}];
}

// ── coordinate helpers ─────────────────────────────────────
export function coordToGrid(x, y, gc) {
  gc = gc || DEFAULT_GC;
  return { col: x - gc.min, row: gc.max - y };
}
export function gridToCoord(col, row, gc) {
  gc = gc || DEFAULT_GC;
  return { x: col + gc.min, y: gc.max - row };
}
export function createEmptyGrid(gc) {
  gc = gc || DEFAULT_GC;
  return Array(gc.size).fill(null).map(() => Array(gc.size).fill(null));
}
export function isValidCoord(x, y, gc) {
  gc = gc || DEFAULT_GC;
  return x >= gc.min && x <= gc.max && y >= gc.min && y <= gc.max;
}

/** Normalize orientation: accepts 'h'/'v'/'d' string or boolean (legacy: true=h, false=v) */
function normalizeOrient(o) {
  if (o === true)  return 'h';
  if (o === false) return 'v';
  if (o === 'h' || o === 'v' || o === 'd') return o;
  return 'h';
}

/** Offset for next cell given orientation (in coord space) */
function nextCellDelta(orient) {
  if (orient === 'h') return { dx: 1, dy: 0  };
  if (orient === 'v') return { dx: 0, dy: -1 };  // y decreases = visually DOWN
  if (orient === 'd') return { dx: 1, dy: -1 };  // diagonal ↘ (right & down)
  return { dx: 1, dy: 0 };
}

// ── placement ──────────────────────────────────────────────
export function placeShipOnGrid(grid, ship, x, y, orientation) {
  const orient = normalizeOrient(orientation);
  const { dx, dy } = nextCellDelta(orient);
  const gc = gcFromGrid(grid);
  const newGrid = grid.map(r => [...r]);
  const positions = [];
  for (let i = 0; i < ship.size; i++) {
    const cx = x + dx * i;
    const cy = y + dy * i;
    if (!isValidCoord(cx, cy, gc)) return null;
    const { col, row } = coordToGrid(cx, cy, gc);
    if (newGrid[row][col]) return null;
    positions.push({ col, row });
  }
  positions.forEach(({ col, row }) => {
    newGrid[row][col] = { shipId: ship.id, hit: false };
  });
  return newGrid;
}

/** Place a defense structure on the grid. Rejects if any target cell is occupied. */
export function placeDefenseOnGrid(grid, defense, x, y, orientation) {
  const orient = normalizeOrient(orientation);
  const { dx, dy } = nextCellDelta(orient);
  const gc = gcFromGrid(grid);
  const newGrid = grid.map(r => [...r]);
  const positions = [];
  for (let i = 0; i < defense.size; i++) {
    const cx = x + dx * i;
    const cy = y + dy * i;
    if (!isValidCoord(cx, cy, gc)) return null;
    const { col, row } = coordToGrid(cx, cy, gc);
    if (newGrid[row][col]) return null;
    positions.push({ col, row });
  }
  positions.forEach(({ col, row }) => {
    newGrid[row][col] = { defenseId: defense.id, hit: false };
  });
  return newGrid;
}

/** Randomly place all defenses (used by AI). gridWithShips = grid that already has ships placed. */
export function placeAIDefenses(gridWithShips) {
  const gc = gcFromGrid(gridWithShips);
  let grid = gridWithShips;
  for (const def of DEFENSES) {
    let success = false;
    let attempts = 0;
    while (!success && attempts < 1500) {
      const x = Math.floor(Math.random() * gc.size) + gc.min;
      const y = Math.floor(Math.random() * gc.size) + gc.min;
      const orient = ORIENTS[Math.floor(Math.random() * ORIENTS.length)];
      const result = placeDefenseOnGrid(grid, def, x, y, orient);
      if (result) { grid = result; success = true; }
      attempts++;
    }
    if (!success) break;
  }
  return grid;
}

// ── attack logic ───────────────────────────────────────────
export function checkHit(grid, x, y) {
  const gc = gcFromGrid(grid);
  if (!isValidCoord(x, y, gc)) return { valid: false };
  const { col, row } = coordToGrid(x, y, gc);
  const cell = grid[row][col];
  if (!cell) return { valid: true, hit: false };
  if (cell.hit) return { valid: true, alreadyHit: true };
  if (cell.defenseId != null) return { valid: true, defenseHit: true, defenseId: cell.defenseId };
  return { valid: true, hit: true, shipId: cell.shipId };
}
export function applyHit(grid, x, y) {
  const gc = gcFromGrid(grid);
  const newGrid = grid.map(r => [...r]);
  const { col, row } = coordToGrid(x, y, gc);
  if (newGrid[row][col]) {
    newGrid[row][col] = { ...newGrid[row][col], hit: true };
  } else {
    newGrid[row][col] = { miss: true };
  }
  return newGrid;
}
export function checkShipSunk(grid, shipId) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid.length; c++) {
      if (grid[r][c]?.shipId === shipId && !grid[r][c]?.hit) return false;
    }
  }
  return true;
}
export function countRemainingShips(grid, ships) {
  return ships.filter(ship => !checkShipSunk(grid, ship.id)).length;
}
export function allShipsSunk(grid) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid.length; c++) {
      if (grid[r][c]?.shipId && !grid[r][c]?.hit) return false;
    }
  }
  return true;
}

// ── AI ─────────────────────────────────────────────────────
export function aiMove(opponentGrid, difficulty) {
  const N = opponentGrid.length;
  const available = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = opponentGrid[r][c];
      if (!cell?.miss && !cell?.hit) available.push({ r, c });
    }
  }
  if (available.length === 0) return null;

  if (difficulty === 'easy') {
    return available[Math.floor(Math.random() * available.length)];
  }
  if (difficulty === 'average') {
    const hits = [];
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (opponentGrid[r][c]?.hit) hits.push({ r, c });
    if (hits.length > 0 && Math.random() > 0.4) {
      const adjacent = [];
      hits.forEach(({ r, c }) => {
        [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < N && nc >= 0 && nc < N) {
            const cell = opponentGrid[nr][nc];
            if (!cell?.miss && !cell?.hit) adjacent.push({ r: nr, c: nc });
          }
        });
      });
      if (adjacent.length > 0) return adjacent[Math.floor(Math.random() * adjacent.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }
  // advanced — hunt mode
  const hits = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (opponentGrid[r][c]?.hit) hits.push({ r, c });
  if (hits.length > 0) {
    const adjacent = [];
    hits.forEach(({ r, c }) => {
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N) {
          const cell = opponentGrid[nr][nc];
          if (!cell?.miss && !cell?.hit) adjacent.push({ r: nr, c: nc });
        }
      });
    });
    if (adjacent.length > 0) return adjacent[Math.floor(Math.random() * adjacent.length)];
  }
  const checker = available.filter(({ r, c }) => (r + c) % 2 === 0);
  const pool = checker.length > 0 ? checker : available;
  return pool[Math.floor(Math.random() * pool.length)];
}

const ORIENTS = ['h', 'v', 'd'];

export function placeAIShips(gc) {
  gc = gc || DEFAULT_GC;
  let grid = createEmptyGrid(gc);
  for (const ship of SHIPS) {
    let success = false;
    let attempts = 0;
    while (!success && attempts < 1500) {
      const x = Math.floor(Math.random() * gc.size) + gc.min;
      const y = Math.floor(Math.random() * gc.size) + gc.min;
      const orient = ORIENTS[Math.floor(Math.random() * ORIENTS.length)];
      const result = placeShipOnGrid(grid, ship, x, y, orient);
      if (result) { grid = result; success = true; }
      attempts++;
    }
    if (!success) {
      grid = createEmptyGrid(gc);
      return placeAIShips(gc);
    }
  }
  return grid;
}
