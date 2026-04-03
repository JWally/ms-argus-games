export type Cell = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';
export type Phase = 'staging' | 'playing' | 'won' | 'lost';
export type Orientation = 'h' | 'v';

export interface Ship {
  id: string;
  name: string;
  size: number;
  hitCount: number;
  positions: [number, number][];
  sunk: boolean;
}

export interface GameState {
  phase: Phase;
  playerGrid: Cell[][];
  enemyGrid: Cell[][];
  playerShips: Ship[];
  enemyShips: Ship[];
  currentTurn: 'player' | 'enemy';
  lastPlayerPos: [number, number] | null;
  lastPlayerResult: 'hit' | 'miss' | 'sunk' | null;
  lastAiPos: [number, number] | null;
  lastAiResult: 'hit' | 'miss' | 'sunk' | null;
  aiMode: 'hunt' | 'target';
  aiHits: [number, number][];
  aiQueue: [number, number][];
  totalShots: number;
  hits: number;
  message: string;
}

const SHIPS_DEF = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
] as const;

export function getShipDefs() {
  return SHIPS_DEF;
}

const GRID_SIZE = 8;

function emptyGrid(): Cell[][] {
  return Array.from({ length: GRID_SIZE }, () => Array<Cell>(GRID_SIZE).fill('empty'));
}

function getShipCells(
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): [number, number][] | null {
  const cells: [number, number][] = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === 'v' ? row + i : row;
    const c = orientation === 'h' ? col + i : col;
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return null;
    cells.push([r, c]);
  }
  return cells;
}

function randomFleet(): { playerGrid: Cell[][]; playerShips: Ship[] } {
  const grid = emptyGrid();
  const ships: Ship[] = [];
  for (const def of SHIPS_DEF) {
    let placed = false;
    while (!placed) {
      const orientation: Orientation = Math.random() < 0.5 ? 'h' : 'v';
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      const cells = getShipCells(row, col, def.size, orientation);
      if (!cells) continue;
      if (!cells.every(([r, c]) => grid[r][c] === 'empty')) continue;
      cells.forEach(([r, c]) => {
        grid[r][c] = 'ship';
      });
      ships.push({
        id: def.id,
        name: def.name,
        size: def.size,
        hitCount: 0,
        positions: cells,
        sunk: false,
      });
      placed = true;
    }
  }
  return { playerGrid: grid, playerShips: ships };
}

export function createGame(): GameState {
  const { playerGrid, playerShips } = randomFleet();
  return {
    phase: 'staging',
    playerGrid,
    enemyGrid: emptyGrid(),
    playerShips,
    enemyShips: [],
    currentTurn: 'player',
    lastPlayerPos: null,
    lastPlayerResult: null,
    lastAiPos: null,
    lastAiResult: null,
    aiMode: 'hunt',
    aiHits: [],
    aiQueue: [],
    totalShots: 0,
    hits: 0,
    message: 'ARRANGE FLEET — SHUFFLE UNTIL SATISFIED',
  };
}

export function reshuffleFleet(state: GameState): GameState {
  if (state.phase !== 'staging') return state;
  const { playerGrid, playerShips } = randomFleet();
  return { ...state, playerGrid, playerShips };
}

export function startGame(state: GameState): GameState {
  if (state.phase !== 'staging') return state;
  return {
    ...state,
    phase: 'playing',
    enemyShips: randomFleet().playerShips,
    message: 'ALL SHIPS DEPLOYED — OPEN FIRE',
  };
}

export function playerShoot(state: GameState, row: number, col: number): GameState {
  if (state.phase !== 'playing') return state;
  if (state.currentTurn !== 'player') return state;
  if (state.enemyGrid[row][col] !== 'empty') return state;

  const newEnemyGrid = state.enemyGrid.map((r) => [...r]) as Cell[][];
  const newEnemyShips = state.enemyShips.map((s) => ({ ...s, positions: [...s.positions] }));

  let result: 'hit' | 'miss' | 'sunk' = 'miss';
  let message = 'MISS — SPLASH';
  let hitsIncrement = 0;

  const hitShipIdx = newEnemyShips.findIndex((s) =>
    s.positions.some(([r, c]) => r === row && c === col)
  );

  if (hitShipIdx !== -1) {
    const hitShip = newEnemyShips[hitShipIdx];
    hitShip.hitCount++;
    hitsIncrement = 1;
    if (hitShip.hitCount === hitShip.size) {
      hitShip.sunk = true;
      result = 'sunk';
      hitShip.positions.forEach(([r, c]) => {
        newEnemyGrid[r][c] = 'sunk';
      });
      message = `${hitShip.name.toUpperCase()} DESTROYED`;
    } else {
      result = 'hit';
      newEnemyGrid[row][col] = 'hit';
      message = 'DIRECT HIT';
    }
  } else {
    newEnemyGrid[row][col] = 'miss';
  }

  const allEnemySunk = newEnemyShips.every((s) => s.sunk);
  if (allEnemySunk) {
    return {
      ...state,
      enemyGrid: newEnemyGrid,
      enemyShips: newEnemyShips,
      phase: 'won',
      lastPlayerPos: [row, col],
      lastPlayerResult: result,
      totalShots: state.totalShots + 1,
      hits: state.hits + hitsIncrement,
      currentTurn: 'player',
      message: 'ALL ENEMY VESSELS DESTROYED — VICTORY',
    };
  }

  return {
    ...state,
    enemyGrid: newEnemyGrid,
    enemyShips: newEnemyShips,
    lastPlayerPos: [row, col],
    lastPlayerResult: result,
    totalShots: state.totalShots + 1,
    hits: state.hits + hitsIncrement,
    currentTurn: 'enemy',
    message,
  };
}

function isUnshot(cell: Cell): boolean {
  return cell === 'empty' || cell === 'ship';
}

function buildAiTargetQueue(newHits: [number, number][], playerGrid: Cell[][]): [number, number][] {
  const allRows = newHits.map(([r]) => r);
  const allCols = newHits.map(([, c]) => c);
  const cands: [number, number][] = [];
  if (allRows.every((r) => r === allRows[0])) {
    const r0 = allRows[0];
    const minC = Math.min(...allCols);
    const maxC = Math.max(...allCols);
    if (minC > 0) cands.push([r0, minC - 1]);
    if (maxC < GRID_SIZE - 1) cands.push([r0, maxC + 1]);
  } else {
    const c0 = allCols[0];
    const minR = Math.min(...allRows);
    const maxR = Math.max(...allRows);
    if (minR > 0) cands.push([minR - 1, c0]);
    if (maxR < GRID_SIZE - 1) cands.push([maxR + 1, c0]);
  }
  return cands.filter(([r, c]) => isUnshot(playerGrid[r][c]));
}

function randomHuntTarget(grid: Cell[][]): [number, number] {
  const parity: [number, number][] = [];
  const fallback: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (isUnshot(grid[r][c])) {
        fallback.push([r, c]);
        if ((r + c) % 2 === 0) parity.push([r, c]);
      }
    }
  }
  const pool = parity.length > 0 ? parity : fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function aiShoot(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (state.currentTurn !== 'enemy') return state;

  const newPlayerGrid = state.playerGrid.map((r) => [...r]) as Cell[][];
  const newPlayerShips = state.playerShips.map((s) => ({ ...s, positions: [...s.positions] }));

  let aiMode = state.aiMode;
  let aiHits = [...state.aiHits];
  let aiQueue = [...state.aiQueue];

  let targetRow: number;
  let targetCol: number;

  if (aiMode === 'target' && aiQueue.length > 0) {
    const validQueue = aiQueue.filter(([r, c]) => isUnshot(newPlayerGrid[r][c]));
    if (validQueue.length > 0) {
      [targetRow, targetCol] = validQueue[0];
      aiQueue = validQueue.slice(1);
    } else {
      aiMode = 'hunt';
      aiHits = [];
      aiQueue = [];
      [targetRow, targetCol] = randomHuntTarget(newPlayerGrid);
    }
  } else {
    aiMode = 'hunt';
    aiHits = [];
    aiQueue = [];
    [targetRow, targetCol] = randomHuntTarget(newPlayerGrid);
  }

  let result: 'hit' | 'miss' | 'sunk' = 'miss';
  let message = state.message;

  const hitShipIdx = newPlayerShips.findIndex((s) =>
    s.positions.some(([r, c]) => r === targetRow && c === targetCol)
  );

  if (hitShipIdx !== -1) {
    const hitShip = newPlayerShips[hitShipIdx];
    hitShip.hitCount++;
    if (hitShip.hitCount === hitShip.size) {
      hitShip.sunk = true;
      result = 'sunk';
      hitShip.positions.forEach(([r, c]) => {
        newPlayerGrid[r][c] = 'sunk';
      });
      message = `ENEMY SUNK YOUR ${hitShip.name.toUpperCase()}`;
      aiMode = 'hunt';
      aiHits = [];
      aiQueue = [];
    } else {
      result = 'hit';
      newPlayerGrid[targetRow][targetCol] = 'hit';
      message = `ENEMY HIT YOUR ${hitShip.name.toUpperCase()}`;
      const newHits: [number, number][] = [...aiHits, [targetRow, targetCol]];
      aiMode = 'target';
      aiHits = newHits;
      if (newHits.length >= 2) {
        aiQueue = buildAiTargetQueue(newHits, newPlayerGrid);
      } else {
        const adj: [number, number][] = [];
        if (targetRow > 0) adj.push([targetRow - 1, targetCol]);
        if (targetRow < GRID_SIZE - 1) adj.push([targetRow + 1, targetCol]);
        if (targetCol > 0) adj.push([targetRow, targetCol - 1]);
        if (targetCol < GRID_SIZE - 1) adj.push([targetRow, targetCol + 1]);
        aiQueue = adj.filter(([r, c]) => isUnshot(newPlayerGrid[r][c]));
      }
    }
  } else {
    newPlayerGrid[targetRow][targetCol] = 'miss';
  }

  const allPlayerSunk = newPlayerShips.every((s) => s.sunk);
  if (allPlayerSunk) {
    return {
      ...state,
      playerGrid: newPlayerGrid,
      playerShips: newPlayerShips,
      phase: 'lost',
      lastAiPos: [targetRow, targetCol],
      lastAiResult: result,
      aiMode,
      aiHits,
      aiQueue,
      message: 'ALL FRIENDLY VESSELS LOST — DEFEAT',
    };
  }

  return {
    ...state,
    playerGrid: newPlayerGrid,
    playerShips: newPlayerShips,
    currentTurn: 'player',
    lastAiPos: [targetRow, targetCol],
    lastAiResult: result,
    aiMode,
    aiHits,
    aiQueue,
    message,
  };
}
