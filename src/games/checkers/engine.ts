// ── 6×6 Checkers engine ──────────────────────────────────────────────

const SIZE = 6;

type Cell = 0 | 1 | 2 | 3 | 4; // 0=empty, 1=player, 2=playerKing, 3=ai, 4=aiKing

export interface Move {
  from: [number, number];
  to: [number, number];
  captured: [number, number][];
}

export interface GameState {
  width: number;
  height: number;
  phase: 'ready' | 'playing' | 'done';
  frameCount: number;
  board: Cell[][];
  turn: 'player' | 'ai';
  selected: [number, number] | null;
  validMoves: Move[];
  allMoves: Move[]; // all moves for current turn
  mustCapture: boolean;
  winner: 'player' | 'ai' | 'draw' | null;
  message: string;
  wins: number;
  losses: number;
  draws: number;
}

// ── Public API ───────────────────────────────────────────────────────

export function initGame(width: number, height: number): GameState {
  const stats = loadStats();
  return {
    width,
    height,
    phase: 'ready',
    frameCount: 0,
    board: makeBoard(),
    turn: 'player',
    selected: null,
    validMoves: [],
    allMoves: [],
    mustCapture: false,
    winner: null,
    message: '',
    ...stats,
  };
}

export function startPlaying(state: GameState): GameState {
  const board = makeBoard();
  const allMoves = getAllMoves(board, 'player');
  const mustCapture = allMoves.some((m) => m.captured.length > 0);
  const filtered = mustCapture ? allMoves.filter((m) => m.captured.length > 0) : allMoves;
  return {
    ...state,
    phase: 'playing',
    board,
    turn: 'player',
    selected: null,
    validMoves: [],
    allMoves: filtered,
    mustCapture,
    winner: null,
    message: '',
  };
}

export function selectCell(state: GameState, row: number, col: number): GameState {
  if (state.phase !== 'playing' || state.turn !== 'player') return state;

  const cell = state.board[row][col];

  // Tapping a valid move destination
  if (state.selected) {
    const move = state.validMoves.find((m) => m.to[0] === row && m.to[1] === col);
    if (move) return executeMove(state, move);
  }

  // Select own piece
  if (cell === 1 || cell === 2) {
    const validMoves = state.allMoves.filter((m) => m.from[0] === row && m.from[1] === col);
    if (validMoves.length > 0) {
      return { ...state, selected: [row, col], validMoves };
    }
    return { ...state, selected: null, validMoves: [] };
  }

  // Tapped empty/enemy with nothing selected
  return { ...state, selected: null, validMoves: [] };
}

function executeMove(state: GameState, move: Move): GameState {
  const board = cloneBoard(state.board);
  const piece = board[move.from[0]][move.from[1]];
  board[move.from[0]][move.from[1]] = 0;

  // Remove captured pieces
  for (const [cr, cc] of move.captured) {
    board[cr][cc] = 0;
  }

  // Promote to king
  const promoted = piece === 1 && move.to[0] === 0 ? 2 : piece;
  board[move.to[0]][move.to[1]] = promoted;

  // Multi-jump: if we captured and the piece can capture again from new position
  if (move.captured.length > 0) {
    const continuations = getJumpsFrom(board, move.to[0], move.to[1], promoted);
    if (continuations.length > 0) {
      return {
        ...state,
        board,
        selected: [move.to[0], move.to[1]],
        validMoves: continuations,
        allMoves: continuations,
        mustCapture: true,
      };
    }
  }

  return finishTurn(state, board, 'ai');
}

export function aiMove(state: GameState): GameState {
  if (state.phase !== 'playing' || state.turn !== 'ai') return state;

  const move = pickAiMove(state.board);
  if (!move) {
    // AI has no moves — player wins
    const wins = state.wins + 1;
    saveStats(wins, state.losses, state.draws);
    return {
      ...state,
      phase: 'done',
      winner: 'player',
      message: 'You win!',
      wins,
    };
  }

  const board = cloneBoard(state.board);
  let piece = board[move.from[0]][move.from[1]];
  board[move.from[0]][move.from[1]] = 0;
  for (const [cr, cc] of move.captured) board[cr][cc] = 0;
  const promoted = piece === 3 && move.to[0] === SIZE - 1 ? 4 : piece;
  board[move.to[0]][move.to[1]] = promoted;
  piece = promoted;

  // Multi-jump for AI
  if (move.captured.length > 0) {
    let pos: [number, number] = [move.to[0], move.to[1]];
    let jumps = getJumpsFrom(board, pos[0], pos[1], piece);
    while (jumps.length > 0) {
      const best = jumps[0]; // take first available
      board[pos[0]][pos[1]] = 0;
      for (const [cr, cc] of best.captured) board[cr][cc] = 0;
      const p2 = piece === 3 && best.to[0] === SIZE - 1 ? 4 : piece;
      board[best.to[0]][best.to[1]] = p2;
      piece = p2;
      pos = [best.to[0], best.to[1]];
      jumps = getJumpsFrom(board, pos[0], pos[1], piece);
    }
  }

  return finishTurn(state, board, 'player');
}

function finishTurn(state: GameState, board: Cell[][], nextTurn: 'player' | 'ai'): GameState {
  const allMoves = getAllMoves(board, nextTurn);
  const mustCapture = allMoves.some((m) => m.captured.length > 0);
  const filtered = mustCapture ? allMoves.filter((m) => m.captured.length > 0) : allMoves;

  // Check game over
  const playerPieces = countPieces(board, 'player');
  const aiPieces = countPieces(board, 'ai');

  if (aiPieces === 0 || (nextTurn === 'ai' && allMoves.length === 0)) {
    const wins = state.wins + 1;
    saveStats(wins, state.losses, state.draws);
    return {
      ...state,
      board,
      phase: 'done',
      turn: nextTurn,
      selected: null,
      validMoves: [],
      allMoves: [],
      winner: 'player',
      message: 'You win!',
      wins,
    };
  }
  if (playerPieces === 0 || (nextTurn === 'player' && allMoves.length === 0)) {
    const losses = state.losses + 1;
    saveStats(state.wins, losses, state.draws);
    return {
      ...state,
      board,
      phase: 'done',
      turn: nextTurn,
      selected: null,
      validMoves: [],
      allMoves: [],
      winner: 'ai',
      message: 'AI wins!',
      losses,
    };
  }

  return {
    ...state,
    board,
    turn: nextTurn,
    selected: null,
    validMoves: [],
    allMoves: filtered,
    mustCapture,
  };
}

export function tick(state: GameState, _dt: number): GameState {
  return { ...state, frameCount: state.frameCount + 1 };
}

// ── Stats ────────────────────────────────────────────────────────────

function loadStats(): { wins: number; losses: number; draws: number } {
  try {
    const raw = localStorage.getItem('checkers-stats');
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { wins: 0, losses: 0, draws: 0 };
}

function saveStats(wins: number, losses: number, draws: number): void {
  try {
    localStorage.setItem('checkers-stats', JSON.stringify({ wins, losses, draws }));
  } catch {
    /* storage full */
  }
}

// ── Board helpers ────────────────────────────────────────────────────

function makeBoard(): Cell[][] {
  const board: Cell[][] = Array.from({ length: SIZE }, () =>
    Array.from<Cell>({ length: SIZE }).fill(0)
  );
  // AI pieces on top 2 rows (dark squares)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[r][c] = 3;
    }
  }
  // Player pieces on bottom 2 rows (dark squares)
  for (let r = SIZE - 2; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[r][c] = 1;
    }
  }
  return board;
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => [...row]);
}

function isPlayer(cell: Cell): boolean {
  return cell === 1 || cell === 2;
}
function isAi(cell: Cell): boolean {
  return cell === 3 || cell === 4;
}
function isKing(cell: Cell): boolean {
  return cell === 2 || cell === 4;
}

function isEnemy(cell: Cell, side: 'player' | 'ai'): boolean {
  return side === 'player' ? isAi(cell) : isPlayer(cell);
}

function isOwn(cell: Cell, side: 'player' | 'ai'): boolean {
  return side === 'player' ? isPlayer(cell) : isAi(cell);
}

function countPieces(board: Cell[][], side: 'player' | 'ai'): number {
  let count = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (isOwn(board[r][c], side)) count++;
    }
  }
  return count;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

// ── Move generation ──────────────────────────────────────────────────

function getMoveDirections(cell: Cell): [number, number][] {
  if (cell === 1)
    return [
      [-1, -1],
      [-1, 1],
    ]; // player moves up
  if (cell === 3)
    return [
      [1, -1],
      [1, 1],
    ]; // ai moves down
  return [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]; // kings move both
}

function getJumpsFrom(board: Cell[][], r: number, c: number, piece: Cell): Move[] {
  const jumps: Move[] = [];
  const side: 'player' | 'ai' = isPlayer(piece) ? 'player' : 'ai';
  const dirs = getMoveDirections(piece);

  for (const [dr, dc] of dirs) {
    const mr = r + dr;
    const mc = c + dc;
    const tr = r + dr * 2;
    const tc = c + dc * 2;
    if (inBounds(tr, tc) && isEnemy(board[mr][mc], side) && board[tr][tc] === 0) {
      jumps.push({ from: [r, c], to: [tr, tc], captured: [[mr, mc]] });
    }
  }
  return jumps;
}

function getMovesForPiece(board: Cell[][], r: number, c: number): Move[] {
  const piece = board[r][c];
  if (piece === 0) return [];

  const moves: Move[] = [];
  const side: 'player' | 'ai' = isPlayer(piece) ? 'player' : 'ai';
  const dirs = getMoveDirections(piece);

  // Simple moves
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] === 0) {
      moves.push({ from: [r, c], to: [nr, nc], captured: [] });
    }
  }

  // Jumps
  for (const [dr, dc] of dirs) {
    const mr = r + dr;
    const mc = c + dc;
    const tr = r + dr * 2;
    const tc = c + dc * 2;
    if (inBounds(tr, tc) && isEnemy(board[mr][mc], side) && board[tr][tc] === 0) {
      moves.push({ from: [r, c], to: [tr, tc], captured: [[mr, mc]] });
    }
  }

  return moves;
}

function getAllMoves(board: Cell[][], side: 'player' | 'ai'): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (isOwn(board[r][c], side)) {
        moves.push(...getMovesForPiece(board, r, c));
      }
    }
  }
  return moves;
}

// ── AI (minimax with alpha-beta) ─────────────────────────────────────

function pickAiMove(board: Cell[][]): Move | null {
  const allMoves = getAllMoves(board, 'ai');
  if (allMoves.length === 0) return null;

  const mustCapture = allMoves.some((m) => m.captured.length > 0);
  const moves = mustCapture ? allMoves.filter((m) => m.captured.length > 0) : allMoves;

  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const b = applyMove(board, move);
    const score = minimaxCheckers(b, 7, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function applyMove(board: Cell[][], move: Move): Cell[][] {
  const b = cloneBoard(board);
  let piece = b[move.from[0]][move.from[1]];
  b[move.from[0]][move.from[1]] = 0;
  for (const [cr, cc] of move.captured) b[cr][cc] = 0;
  // Promote
  if (piece === 1 && move.to[0] === 0) piece = 2;
  if (piece === 3 && move.to[0] === SIZE - 1) piece = 4;
  b[move.to[0]][move.to[1]] = piece;
  return b;
}

function minimaxCheckers(
  board: Cell[][],
  depth: number,
  alpha: number,
  beta: number,
  isAiTurn: boolean
): number {
  if (depth === 0) return evaluateCheckers(board);

  const side = isAiTurn ? 'ai' : 'player';
  const allMoves = getAllMoves(board, side);
  const mustCapture = allMoves.some((m) => m.captured.length > 0);
  const moves = mustCapture ? allMoves.filter((m) => m.captured.length > 0) : allMoves;

  if (moves.length === 0) {
    return isAiTurn ? -1000 - depth : 1000 + depth;
  }

  if (isAiTurn) {
    let best = -Infinity;
    for (const move of moves) {
      const b = applyMove(board, move);
      const score = minimaxCheckers(b, depth - 1, alpha, beta, false);
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const b = applyMove(board, move);
    const score = minimaxCheckers(b, depth - 1, alpha, beta, true);
    best = Math.min(best, score);
    beta = Math.min(beta, score);
    if (beta <= alpha) break;
  }
  return best;
}

function evaluateCheckers(board: Cell[][]): number {
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      if (cell === 1) score -= 10;
      if (cell === 2) score -= 15;
      if (cell === 3) score += 10;
      if (cell === 4) score += 15;

      // Positional: center is better
      if (isAi(cell)) {
        score += r > 1 && r < SIZE - 1 && c > 0 && c < SIZE - 1 ? 2 : 0;
        // Advancement bonus
        score += r;
      }
      if (isPlayer(cell)) {
        score -= r > 1 && r < SIZE - 1 && c > 0 && c < SIZE - 1 ? 2 : 0;
        score -= SIZE - 1 - r;
      }
    }
  }
  return score;
}

// ── Rendering ────────────────────────────────────────────────────────

// Phosphor-terminal palette — matches the site theme (wood-brown board
// was a leftover from the pre-CRT era).
const BG_COLOR = '#030c06';
const BOARD_LIGHT = '#123c20';
const BOARD_DARK = '#071a0e';
const PLAYER_FILL = '#ef4444';
const PLAYER_STROKE = '#f87171';
const AI_FILL = '#182420';
const AI_STROKE = '#86efac';
const KING_CROWN = '#fbbf24';
const SELECT_GLOW = '#fbbf24';
const MOVE_DOT = '#22c55e';
const TEXT_COLOR = '#e2e8f0';

interface Layout {
  cellSize: number;
  boardX: number;
  boardY: number;
  boardPx: number;
}

function getLayout(width: number, height: number): Layout {
  // The board IS the canvas, minus a slim margin — turn/record chrome
  // lives in the page shell, not in-canvas. No cell cap: the backing
  // resolution is set from the display size, so bigger canvas = bigger,
  // still-crisp board.
  const cellSize = Math.max(Math.min((width - 24) / SIZE, (height - 24) / SIZE), 40);
  const boardPx = cellSize * SIZE;
  const boardX = (width - boardPx) / 2;
  const boardY = (height - boardPx) / 2;
  return { cellSize, boardX, boardY, boardPx };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const layout = getLayout(width, height);

  drawBoardSquares(ctx, state, layout);
  drawPieces(ctx, state, layout);

  if (state.phase === 'ready') {
    drawOverlay(ctx, state, 'Checkers', 'PLAY', 'Capture all pieces to win');
  } else if (state.phase === 'done') {
    drawOverlay(ctx, state, state.message, 'Play Again', '');
  }
}

function drawBoardSquares(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  const { cellSize, boardX, boardY } = layout;

  // Board border
  ctx.strokeStyle = '#1a6632';
  ctx.lineWidth = 3;
  ctx.strokeRect(boardX - 2, boardY - 2, cellSize * SIZE + 4, cellSize * SIZE + 4);

  const moveTargets = new Set(state.validMoves.map((m) => `${m.to[0]},${m.to[1]}`));

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const x = boardX + c * cellSize;
      const y = boardY + r * cellSize;
      const isDark = (r + c) % 2 === 1;

      ctx.fillStyle = isDark ? BOARD_DARK : BOARD_LIGHT;
      ctx.fillRect(x, y, cellSize, cellSize);

      // Valid move dot
      if (moveTargets.has(`${r},${c}`)) {
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;
        const pulse = 0.6 + 0.4 * Math.sin(state.frameCount * 0.08);
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 197, 94, ${pulse})`;
        ctx.fill();
        ctx.strokeStyle = MOVE_DOT;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
}

function drawPieces(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  const { cellSize, boardX, boardY } = layout;
  const pieceR = cellSize * 0.38;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = state.board[r][c];
      if (cell === 0) continue;

      const cx = boardX + c * cellSize + cellSize / 2;
      const cy = boardY + r * cellSize + cellSize / 2;
      const isSelected = state.selected && state.selected[0] === r && state.selected[1] === c;

      // Selection glow
      if (isSelected) {
        const pulse = 0.5 + 0.3 * Math.sin(state.frameCount * 0.1);
        ctx.beginPath();
        ctx.arc(cx, cy, pieceR + 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 191, 36, ${pulse * 0.5})`;
        ctx.fill();
        ctx.strokeStyle = SELECT_GLOW;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Piece shadow
      ctx.beginPath();
      ctx.arc(cx + 1.5, cy + 2, pieceR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      // Piece body
      const isP = isPlayer(cell);
      const fill = isP ? PLAYER_FILL : AI_FILL;
      const stroke = isP ? PLAYER_STROKE : AI_STROKE;
      const light = isP ? '#f87171' : '#2f4438';

      ctx.beginPath();
      ctx.arc(cx, cy, pieceR, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(
        cx - pieceR * 0.3,
        cy - pieceR * 0.3,
        1,
        cx,
        cy,
        pieceR
      );
      grad.addColorStop(0, light);
      grad.addColorStop(1, fill);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // King crown
      if (isKing(cell)) {
        ctx.font = `bold ${Math.floor(cellSize * 0.3)}px sans-serif`;
        ctx.fillStyle = KING_CROWN;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♚', cx, cy + 1);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  title: string,
  buttonText: string,
  subtitle: string
): void {
  const { width, height } = state;

  // Scale overlay chrome with the board so it reads the same at any
  // backing resolution (canvas is sized from display px now).
  const u = Math.max(width / 400, 1);

  ctx.fillStyle = 'rgba(3, 12, 6, 0.78)';
  ctx.fillRect(0, 0, width, height);

  const isWin = state.winner === 'player';
  const isLoss = state.winner === 'ai';

  ctx.font = `bold ${Math.round(26 * u)}px monospace`;
  ctx.fillStyle = isWin ? MOVE_DOT : isLoss ? PLAYER_FILL : TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, height / 2 - 50 * u);

  const bw = 160 * u;
  const bh = 48 * u;
  const bx = (width - bw) / 2;
  const by = height / 2 - bh / 2;
  ctx.fillStyle = '#22c55e';
  roundRect(ctx, bx, by, bw, bh, 4 * u);
  ctx.fill();

  ctx.font = `bold ${Math.round(18 * u)}px monospace`;
  ctx.fillStyle = '#0a1f0a';
  ctx.fillText(buttonText, width / 2, by + bh / 2 + 6 * u);

  if (subtitle) {
    ctx.font = `${Math.round(12 * u)}px monospace`;
    ctx.fillStyle = '#3f9e68';
    ctx.fillText(subtitle, width / 2, height / 2 + 50 * u);
  }
}

// eslint-disable-next-line max-params
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Hit detection ────────────────────────────────────────────────────

export function cellAtPoint(state: GameState, px: number, py: number): [number, number] | null {
  const layout = getLayout(state.width, state.height);
  const { cellSize, boardX, boardY } = layout;

  const col = Math.floor((px - boardX) / cellSize);
  const row = Math.floor((py - boardY) / cellSize);
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
  return [row, col];
}
