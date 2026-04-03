// ── Go engine (9×9) ──────────────────────────────────────────────────
// Pure functions, no side effects.
// Board: flat array of 81, index = row*9 + col, row 0 = top.

export type Stone = 0 | 1 | 2; // 0=empty, 1=player(red), 2=AI(white)
export type Board = Stone[];

export interface ScoreResult {
  playerStones: number;
  playerTerritory: number;
  playerTotal: number;
  aiStones: number;
  aiTerritory: number;
  aiTotal: number; // includes 5.5 komi
  territory: Stone[]; // 81-length: 1=player, 2=ai, 0=neutral
  winner: 1 | 2;
  margin: number; // |playerTotal - aiTotal|
}

export interface GoState {
  board: Board;
  phase: 'playing' | 'done';
  turn: 1 | 2;
  captured: [number, number]; // [playerCaptures, aiCaptures]
  lastMove: number | null; // board index, null = pass
  passCount: number; // consecutive passes; 2 = game ends
  moveCount: number;
  koPoint: number | null; // simple ko: forbidden re-capture point
  score: ScoreResult | null;
  resignedBy: 1 | 2 | null;
}

const SIZE = 9;
const KOMI = 5.5;
const MOVE_LIMIT = 120;

// ── Board helpers ────────────────────────────────────────────────────

export function idx(row: number, col: number): number {
  return row * SIZE + col;
}

export function rowOf(i: number): number {
  return Math.floor(i / SIZE);
}

export function colOf(i: number): number {
  return i % SIZE;
}

export function adjacents(i: number): number[] {
  const r = rowOf(i);
  const c = colOf(i);
  const result: number[] = [];
  if (r > 0) result.push(idx(r - 1, c));
  if (r < SIZE - 1) result.push(idx(r + 1, c));
  if (c > 0) result.push(idx(r, c - 1));
  if (c < SIZE - 1) result.push(idx(r, c + 1));
  return result;
}

function cloneBoard(board: Board): Board {
  return [...board] as Board;
}

// ── Group & liberty logic ────────────────────────────────────────────

/** Returns all stones in the connected group containing index i. */
export function getGroup(board: Board, i: number): number[] {
  const color = board[i];
  if (color === 0) return [];
  const visited = new Set<number>();
  const stack = [i];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const adj of adjacents(cur)) {
      if (!visited.has(adj) && board[adj] === color) stack.push(adj);
    }
  }
  return [...visited];
}

/** Count empty intersections adjacent to a group. */
export function getLiberties(board: Board, group: number[]): number {
  const libs = new Set<number>();
  for (const i of group) {
    for (const adj of adjacents(i)) {
      if (board[adj] === 0) libs.add(adj);
    }
  }
  return libs.size;
}

// ── Move validation ──────────────────────────────────────────────────

export function isValidMove(state: GoState, i: number): boolean {
  if (state.phase !== 'playing') return false;
  if (state.board[i] !== 0) return false;
  if (i === state.koPoint) return false;

  // Simulate placement to check for suicide
  const testBoard = cloneBoard(state.board);
  testBoard[i] = state.turn;

  // Remove any captured enemy groups first (they free liberties)
  const enemy = (state.turn === 1 ? 2 : 1) as Stone;
  for (const adj of adjacents(i)) {
    if (testBoard[adj] === enemy) {
      const group = getGroup(testBoard, adj);
      if (getLiberties(testBoard, group) === 0) {
        for (const g of group) testBoard[g] = 0;
      }
    }
  }

  // Now check if own group would have liberties
  const ownGroup = getGroup(testBoard, i);
  return getLiberties(testBoard, ownGroup) > 0;
}

export function getValidMoves(state: GoState): number[] {
  const moves: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (isValidMove(state, i)) moves.push(i);
  }
  return moves;
}

// ── Place stone ──────────────────────────────────────────────────────

export function placeStone(state: GoState, i: number): GoState {
  if (!isValidMove(state, i)) return state;

  const board = cloneBoard(state.board);
  board[i] = state.turn;

  const enemy = (state.turn === 1 ? 2 : 1) as Stone;
  let captured = 0;
  let lastCapturedIdx = -1;

  // Capture surrounded enemy groups
  for (const adj of adjacents(i)) {
    if (board[adj] === enemy) {
      const group = getGroup(board, adj);
      if (getLiberties(board, group) === 0) {
        for (const g of group) {
          board[g] = 0;
          captured++;
          lastCapturedIdx = g;
        }
      }
    }
  }

  // Update captures array
  const newCaptured: [number, number] = [...state.captured];
  if (state.turn === 1) newCaptured[0] += captured;
  else newCaptured[1] += captured;

  // Simple ko detection: exactly 1 stone captured, capturing stone can be recaptured in 1 move
  let koPoint: number | null = null;
  if (captured === 1) {
    // The captured point is a ko if placing there would recapture i
    const koTestBoard = cloneBoard(board);
    koTestBoard[lastCapturedIdx] = enemy;
    const recaptureGroup = getGroup(koTestBoard, i);
    if (getLiberties(koTestBoard, recaptureGroup) === 0) {
      koPoint = lastCapturedIdx;
    }
  }

  const nextTurn = (state.turn === 1 ? 2 : 1) as 1 | 2;
  const moveCount = state.moveCount + 1;

  const next: GoState = {
    ...state,
    board,
    turn: nextTurn,
    captured: newCaptured,
    lastMove: i,
    passCount: 0, // any stone play resets pass count
    moveCount,
    koPoint,
    score: null,
  };

  // Auto-end on move limit
  if (moveCount >= MOVE_LIMIT) {
    return scoreGame(next);
  }

  return next;
}

// ── Pass ─────────────────────────────────────────────────────────────

export function passTurn(state: GoState): GoState {
  if (state.phase !== 'playing') return state;

  const nextPassCount = state.passCount + 1;
  const nextTurn = (state.turn === 1 ? 2 : 1) as 1 | 2;

  const next: GoState = {
    ...state,
    turn: nextTurn,
    lastMove: null,
    passCount: nextPassCount,
    moveCount: state.moveCount + 1,
    koPoint: null, // ko expires on pass
  };

  if (nextPassCount >= 2) {
    return scoreGame(next);
  }

  return next;
}

// ── Resign ───────────────────────────────────────────────────────────

export function resignGame(state: GoState, player: 1 | 2): GoState {
  if (state.phase !== 'playing') return state;
  return {
    ...state,
    phase: 'done',
    resignedBy: player,
    score: null,
  };
}

// ── Scoring (Chinese area) ───────────────────────────────────────────

export function scoreGame(state: GoState): GoState {
  const board = state.board;
  const territory: Stone[] = new Array<Stone>(SIZE * SIZE).fill(0);
  const visited = new Set<number>();

  // Flood-fill each empty region
  for (let start = 0; start < SIZE * SIZE; start++) {
    if (board[start] !== 0 || visited.has(start)) continue;

    // BFS to find connected empty region and its border colors
    const region: number[] = [];
    const stack = [start];
    const borderColors = new Set<Stone>();

    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      region.push(cur);

      for (const adj of adjacents(cur)) {
        if (board[adj] === 0 && !visited.has(adj)) {
          stack.push(adj);
        } else if (board[adj] !== 0) {
          borderColors.add(board[adj] as Stone);
        }
      }
    }

    // Assign territory if bordered by only one color
    if (borderColors.size === 1) {
      const owner = [...borderColors][0];
      for (const r of region) territory[r] = owner;
    }
  }

  // Count stones and territory
  let playerStones = 0;
  let aiStones = 0;
  let playerTerritory = 0;
  let aiTerritory = 0;

  for (let i = 0; i < SIZE * SIZE; i++) {
    if (board[i] === 1) playerStones++;
    else if (board[i] === 2) aiStones++;
    if (territory[i] === 1) playerTerritory++;
    else if (territory[i] === 2) aiTerritory++;
  }

  const playerTotal = playerStones + playerTerritory;
  const aiTotal = aiStones + aiTerritory + KOMI;
  const winner: 1 | 2 = playerTotal > aiTotal ? 1 : 2;
  const margin = Math.abs(playerTotal - aiTotal);

  const score: ScoreResult = {
    playerStones,
    playerTerritory,
    playerTotal,
    aiStones,
    aiTerritory,
    aiTotal,
    territory,
    winner,
    margin,
  };

  return { ...state, phase: 'done', score };
}

// ── Live score estimate (mid-game) ───────────────────────────────────
// Quick approximation for display during play.

export function estimateScore(state: GoState): { player: number; ai: number } {
  let player = state.captured[0]; // captured enemy stones
  let ai = state.captured[1] + KOMI;

  for (const stone of state.board) {
    if (stone === 1) player++;
    else if (stone === 2) ai++;
  }

  return { player: Math.round(player), ai: Math.round(ai) };
}

// ── Factory ──────────────────────────────────────────────────────────

export function createGame(): GoState {
  return {
    board: new Array<Stone>(SIZE * SIZE).fill(0) as Board,
    phase: 'playing',
    turn: 1,
    captured: [0, 0],
    lastMove: null,
    passCount: 0,
    moveCount: 0,
    koPoint: null,
    score: null,
    resignedBy: null,
  };
}
