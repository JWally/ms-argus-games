// ── Color Flood game engine ──────────────────────────────────────────

export const COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' },
] as const;

export type ColorIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface GameState {
  /** 2-D grid of color indices (row-major). */
  board: ColorIndex[][];
  /** Set of owned cell keys ("row,col"). */
  owned: Set<string>;
  /** Current color index of the flood region. */
  currentColor: ColorIndex;
  /** Number of moves taken so far. */
  moves: number;
  /** Grid size (rows === cols). */
  size: number;
  /** Maximum recommended moves (par). */
  par: number;
  /** Has the player won? */
  won: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function key(r: number, c: number): string {
  return `${r},${c}`;
}

function neighbors(r: number, c: number, size: number): [number, number][] {
  const out: [number, number][] = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < size - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < size - 1) out.push([r, c + 1]);
  return out;
}

/** Par values per board size. */
function parForSize(size: number): number {
  if (size <= 10) return 18;
  if (size <= 14) return 25;
  return 32;
}

// ── Board generation ─────────────────────────────────────────────────

function generateBoard(size: number): ColorIndex[][] {
  const board: ColorIndex[][] = [];
  for (let r = 0; r < size; r++) {
    const row: ColorIndex[] = [];
    for (let c = 0; c < size; c++) {
      row.push(Math.floor(Math.random() * 6) as ColorIndex);
    }
    board.push(row);
  }
  return board;
}

// ── Initial owned set (flood-fill from top-left with starting color) ─

function computeOwned(board: ColorIndex[][], size: number): Set<string> {
  const color = board[0][0];
  const owned = new Set<string>();
  const stack: [number, number][] = [[0, 0]];
  owned.add(key(0, 0));

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [nr, nc] of neighbors(r, c, size)) {
      const k = key(nr, nc);
      if (!owned.has(k) && board[nr][nc] === color) {
        owned.add(k);
        stack.push([nr, nc]);
      }
    }
  }

  return owned;
}

// ── Create a new game ────────────────────────────────────────────────

export function createGame(size: number): GameState {
  const board = generateBoard(size);
  const owned = computeOwned(board, size);
  return {
    board,
    owned,
    currentColor: board[0][0],
    moves: 0,
    size,
    par: parForSize(size),
    won: false,
  };
}

// ── Play a move ──────────────────────────────────────────────────────

export function playMove(state: GameState, colorIdx: ColorIndex): GameState {
  if (state.won || colorIdx === state.currentColor) return state;

  // Deep-copy the board so React sees a new reference.
  const board = state.board.map((row) => [...row]);
  const size = state.size;

  // 1. Recolor all owned cells to the new color.
  const owned = new Set(state.owned);
  for (const k of owned) {
    const [r, c] = k.split(',').map(Number);
    board[r][c] = colorIdx;
  }

  // 2. Flood-fill: absorb any neighbor of the owned region that matches.
  const frontier: [number, number][] = [];
  for (const k of owned) {
    const [r, c] = k.split(',').map(Number);
    for (const [nr, nc] of neighbors(r, c, size)) {
      if (!owned.has(key(nr, nc)) && board[nr][nc] === colorIdx) {
        const nk = key(nr, nc);
        if (!owned.has(nk)) {
          owned.add(nk);
          frontier.push([nr, nc]);
        }
      }
    }
  }

  // BFS the frontier to keep absorbing contiguous cells of the same color.
  while (frontier.length > 0) {
    const [r, c] = frontier.pop()!;
    for (const [nr, nc] of neighbors(r, c, size)) {
      const nk = key(nr, nc);
      if (!owned.has(nk) && board[nr][nc] === colorIdx) {
        owned.add(nk);
        frontier.push([nr, nc]);
      }
    }
  }

  const totalCells = size * size;
  const won = owned.size === totalCells;

  return {
    board,
    owned,
    currentColor: colorIdx,
    moves: state.moves + 1,
    size,
    par: state.par,
    won,
  };
}

// ── Stats ────────────────────────────────────────────────────────────

export function capturePercent(state: GameState): number {
  return Math.round((state.owned.size / (state.size * state.size)) * 100);
}

// ── localStorage best-score helpers ──────────────────────────────────

function bestKey(size: number): string {
  return `color-flood-best-${size}`;
}

export function getBestScore(size: number): number | null {
  const v = localStorage.getItem(bestKey(size));
  return v ? Number(v) : null;
}

export function saveBestScore(size: number, moves: number): void {
  const prev = getBestScore(size);
  if (prev === null || moves < prev) {
    localStorage.setItem(bestKey(size), String(moves));
  }
}
