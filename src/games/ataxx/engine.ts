// ── Ataxx game engine ────────────────────────────────────────────────

export type CellState = 'empty' | 'blue' | 'red';

export interface GameState {
  board: CellState[][];
  size: number;
  turn: 'blue' | 'red';
  selected: { r: number; c: number } | null;
  validMoves: Set<string>;
  blueCount: number;
  redCount: number;
  gameOver: boolean;
  winner: 'blue' | 'red' | 'tie' | null;
  lastMove: { from: { r: number; c: number }; to: { r: number; c: number } } | null;
  flipped: Set<string>; // cells flipped by last move (for animation)
}

// ── Helpers ──────────────────────────────────────────────────────────

function key(r: number, c: number): string {
  return `${r},${c}`;
}

function chebyshevDist(r1: number, c1: number, r2: number, c2: number): number {
  return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2));
}

function countPieces(board: CellState[][], size: number): { blue: number; red: number } {
  let blue = 0;
  let red = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 'blue') blue++;
      else if (board[r][c] === 'red') red++;
    }
  }
  return { blue, red };
}

function getAdjacent(r: number, c: number, size: number): [number, number][] {
  const adj: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        adj.push([nr, nc]);
      }
    }
  }
  return adj;
}

// ── Get valid moves for a piece ─────────────────────────────────────

function getMovesForPiece(board: CellState[][], size: number, r: number, c: number): Set<string> {
  const moves = new Set<string>();
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === 'empty') {
        moves.add(key(nr, nc));
      }
    }
  }
  return moves;
}

// ── Check if a player has any moves ─────────────────────────────────

function hasAnyMoves(board: CellState[][], size: number, player: CellState): boolean {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === player) {
        const moves = getMovesForPiece(board, size, r, c);
        if (moves.size > 0) return true;
      }
    }
  }
  return false;
}

// ── Create game ─────────────────────────────────────────────────────

export function createGame(size: number = 7): GameState {
  const board: CellState[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'empty' as CellState)
  );

  // Starting positions: corners
  board[0][0] = 'blue';
  board[size - 1][size - 1] = 'blue';
  board[0][size - 1] = 'red';
  board[size - 1][0] = 'red';

  return {
    board,
    size,
    turn: 'blue',
    selected: null,
    validMoves: new Set(),
    blueCount: 2,
    redCount: 2,
    gameOver: false,
    winner: null,
    lastMove: null,
    flipped: new Set(),
  };
}

// ── Select a piece ──────────────────────────────────────────────────

export function selectPiece(state: GameState, r: number, c: number): GameState {
  if (state.gameOver) return state;
  if (state.board[r][c] !== state.turn) return state;

  const validMoves = getMovesForPiece(state.board, state.size, r, c);
  return {
    ...state,
    selected: { r, c },
    validMoves,
    flipped: new Set(),
  };
}

// ── Make a move ─────────────────────────────────────────────────────

function resolveWinner(counts: { blue: number; red: number }): 'blue' | 'red' | 'tie' {
  if (counts.blue > counts.red) return 'blue';
  if (counts.red > counts.blue) return 'red';
  return 'tie';
}

function checkGameOver(
  board: CellState[][],
  size: number,
  counts: { blue: number; red: number },
  currentPlayer: 'blue' | 'red',
  nextPlayer: 'blue' | 'red'
): { gameOver: boolean; winner: 'blue' | 'red' | 'tie' | null; skipTurn: boolean } {
  if (counts.blue === 0) return { gameOver: true, winner: 'red', skipTurn: false };
  if (counts.red === 0) return { gameOver: true, winner: 'blue', skipTurn: false };

  const emptyCount = size * size - counts.blue - counts.red;
  if (emptyCount === 0) {
    return { gameOver: true, winner: resolveWinner(counts), skipTurn: false };
  }

  if (!hasAnyMoves(board, size, nextPlayer)) {
    if (!hasAnyMoves(board, size, currentPlayer)) {
      return { gameOver: true, winner: resolveWinner(counts), skipTurn: false };
    }
    return { gameOver: false, winner: null, skipTurn: true };
  }

  return { gameOver: false, winner: null, skipTurn: false };
}

export function makeMove(state: GameState, toR: number, toC: number): GameState {
  if (state.gameOver || !state.selected) return state;
  if (!state.validMoves.has(key(toR, toC))) return state;

  const { r: fromR, c: fromC } = state.selected;
  const dist = chebyshevDist(fromR, fromC, toR, toC);

  const board = state.board.map((row) => [...row]);
  const player = state.turn;
  const opponent: CellState = player === 'blue' ? 'red' : 'blue';

  // Place piece at destination
  board[toR][toC] = player;

  // If jump (dist 2), remove from source
  if (dist === 2) {
    board[fromR][fromC] = 'empty';
  }

  // Flip adjacent opponent pieces
  const flipped = new Set<string>();
  for (const [nr, nc] of getAdjacent(toR, toC, state.size)) {
    if (board[nr][nc] === opponent) {
      board[nr][nc] = player;
      flipped.add(key(nr, nc));
    }
  }

  const counts = countPieces(board, state.size);
  const nextTurn = player === 'blue' ? 'red' : 'blue';
  const result = checkGameOver(board, state.size, counts, player, nextTurn);

  const base = {
    ...state,
    board,
    selected: null,
    validMoves: new Set<string>(),
    blueCount: counts.blue,
    redCount: counts.red,
    gameOver: result.gameOver,
    winner: result.winner,
    lastMove: { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } },
    flipped,
  };

  // Opponent can't move — skip their turn
  if (result.skipTurn) {
    return { ...base, turn: player };
  }

  return { ...base, turn: nextTurn };
}

// ── Handle cell click (select or move) ──────────────────────────────

export function handleCellClick(state: GameState, r: number, c: number): GameState {
  if (state.gameOver || state.turn !== 'blue') return state;

  const cell = state.board[r][c];

  // If clicking on own piece, select it
  if (cell === 'blue') {
    return selectPiece(state, r, c);
  }

  // If clicking on a valid move target, make the move
  if (state.selected && state.validMoves.has(key(r, c))) {
    return makeMove(state, r, c);
  }

  // Deselect
  return { ...state, selected: null, validMoves: new Set() };
}

// ── AI ──────────────────────────────────────────────────────────────

interface ScoredMove {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  score: number;
}

function scoreMove(
  board: CellState[][],
  size: number,
  move: { fromR: number; fromC: number; toR: number; toC: number }
): number {
  const dist = chebyshevDist(move.fromR, move.fromC, move.toR, move.toC);

  // Count how many opponent pieces we'd flip
  let flips = 0;
  for (const [ar, ac] of getAdjacent(move.toR, move.toC, size)) {
    if (board[ar][ac] === 'blue') flips++;
  }

  // Prefer clones (dist 1) over jumps (dist 2) — cloning gains a piece
  let score = flips * 3 + (dist === 1 ? 2 : 0);

  // Bonus for moving toward center
  const center = Math.floor(size / 2);
  const centerDist = Math.abs(move.toR - center) + Math.abs(move.toC - center);
  score += (size - 1 - centerDist) * 0.5;

  // Small random factor for variety
  score += Math.random() * 0.5;

  return score;
}

function collectAiMoves(board: CellState[][], size: number): ScoredMove[] {
  const moves: ScoredMove[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== 'red') continue;
      const pieceMoves = getMovesForPiece(board, size, r, c);
      for (const k of pieceMoves) {
        const [nr, nc] = k.split(',').map(Number);
        const m = { fromR: r, fromC: c, toR: nr, toC: nc };
        moves.push({ ...m, score: scoreMove(board, size, m) });
      }
    }
  }
  return moves;
}

export function aiMove(state: GameState): GameState {
  if (state.gameOver || state.turn !== 'red') return state;

  const moves = collectAiMoves(state.board, state.size);
  if (moves.length === 0) return state;

  // Pick the best move
  moves.sort((a, b) => b.score - a.score);
  const best = moves[0];

  // Apply the move
  const selected = selectPiece(state, best.fromR, best.fromC);
  return makeMove(selected, best.toR, best.toC);
}

// ── Stats ───────────────────────────────────────────────────────────

export function getBestScore(): { wins: number; losses: number } {
  const v = localStorage.getItem('ataxx-record');
  return v ? JSON.parse(v) : { wins: 0, losses: 0 };
}

export function saveResult(won: boolean): void {
  const record = getBestScore();
  if (won) record.wins++;
  else record.losses++;
  try {
    localStorage.setItem('ataxx-record', JSON.stringify(record));
  } catch {
    /* storage full */
  }
}
