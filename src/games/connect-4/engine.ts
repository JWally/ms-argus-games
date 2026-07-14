// ── Connect 4 engine ─────────────────────────────────────────────────

const COLS = 7;
const ROWS = 6;

type Cell = 0 | 1 | 2; // 0=empty, 1=player, 2=AI

export interface GameState {
  width: number;
  height: number;
  phase: 'ready' | 'playing' | 'done';
  frameCount: number;
  board: Cell[][]; // [row][col], row 0 = top
  turn: 1 | 2; // whose turn
  winner: 0 | 1 | 2; // 0=none/draw
  winCells: [number, number][]; // winning 4 cells [row,col]
  hoverCol: number; // column cursor is over (-1 = none)
  lastDrop: { row: number; col: number; t: number } | null;
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
    turn: 1,
    winner: 0,
    winCells: [],
    hoverCol: -1,
    lastDrop: null,
    message: '',
    ...stats,
  };
}

export function startPlaying(state: GameState): GameState {
  return {
    ...state,
    phase: 'playing',
    board: makeBoard(),
    turn: 1,
    winner: 0,
    winCells: [],
    message: '',
    lastDrop: null,
  };
}

export function setHoverCol(state: GameState, col: number): GameState {
  if (state.phase !== 'playing' || state.turn !== 1) return { ...state, hoverCol: -1 };
  return { ...state, hoverCol: col };
}

export function dropDisc(state: GameState, col: number): GameState {
  if (state.phase !== 'playing' || state.turn !== 1) return state;
  if (col < 0 || col >= COLS) return state;

  const row = getDropRow(state.board, col);
  if (row < 0) return state; // column full

  const board = cloneBoard(state.board);
  board[row][col] = 1;

  const win = checkWin(board, row, col);
  if (win) {
    const wins = state.wins + 1;
    saveStats(wins, state.losses, state.draws);
    return {
      ...state,
      board,
      turn: 1,
      winner: 1,
      winCells: win,
      phase: 'done',
      message: 'You win!',
      wins,
      lastDrop: { row, col, t: state.frameCount },
    };
  }

  if (isBoardFull(board)) {
    const draws = state.draws + 1;
    saveStats(state.wins, state.losses, draws);
    return {
      ...state,
      board,
      turn: 2,
      winner: 0,
      winCells: [],
      phase: 'done',
      message: "It's a draw!",
      draws,
      lastDrop: { row, col, t: state.frameCount },
    };
  }

  return {
    ...state,
    board,
    turn: 2,
    hoverCol: -1,
    lastDrop: { row, col, t: state.frameCount },
  };
}

export function aiMove(state: GameState): GameState {
  if (state.phase !== 'playing' || state.turn !== 2) return state;

  const col = pickAiMove(state.board);
  if (col < 0) return state;

  const row = getDropRow(state.board, col);
  if (row < 0) return state;

  const board = cloneBoard(state.board);
  board[row][col] = 2;

  const win = checkWin(board, row, col);
  if (win) {
    const losses = state.losses + 1;
    saveStats(state.wins, losses, state.draws);
    return {
      ...state,
      board,
      turn: 1,
      winner: 2,
      winCells: win,
      phase: 'done',
      message: 'AI wins!',
      losses,
      lastDrop: { row, col, t: state.frameCount },
    };
  }

  if (isBoardFull(board)) {
    const draws = state.draws + 1;
    saveStats(state.wins, state.losses, draws);
    return {
      ...state,
      board,
      turn: 1,
      winner: 0,
      winCells: [],
      phase: 'done',
      message: "It's a draw!",
      draws,
      lastDrop: { row, col, t: state.frameCount },
    };
  }

  return {
    ...state,
    board,
    turn: 1,
    lastDrop: { row, col, t: state.frameCount },
  };
}

export function tick(state: GameState, _dt: number): GameState {
  return { ...state, frameCount: state.frameCount + 1 };
}

// ── Stats persistence ────────────────────────────────────────────────

function loadStats(): { wins: number; losses: number; draws: number } {
  try {
    const raw = localStorage.getItem('connect4-stats');
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { wins: 0, losses: 0, draws: 0 };
}

function saveStats(wins: number, losses: number, draws: number): void {
  try {
    localStorage.setItem('connect4-stats', JSON.stringify({ wins, losses, draws }));
  } catch {
    /* storage full */
  }
}

// ── Board helpers ────────────────────────────────────────────────────

function makeBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array.from<Cell>({ length: COLS }).fill(0));
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => [...row]);
}

function getDropRow(board: Cell[][], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

function isBoardFull(board: Cell[][]): boolean {
  return board[0].every((c) => c !== 0);
}

// ── Win detection ────────────────────────────────────────────────────

const DIRECTIONS_4: [number, number][] = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal \
  [1, -1], // diagonal /
];

function checkWin(board: Cell[][], row: number, col: number): [number, number][] | null {
  const player = board[row][col];
  if (player === 0) return null;

  for (const [dr, dc] of DIRECTIONS_4) {
    const cells: [number, number][] = [[row, col]];

    // Check forward
    for (let i = 1; i <= 3; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
      cells.push([r, c]);
    }

    // Check backward
    for (let i = 1; i <= 3; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
      cells.push([r, c]);
    }

    if (cells.length >= 4) return cells.slice(0, 4);
  }
  return null;
}

// ── AI ───────────────────────────────────────────────────────────────
// Minimax with alpha-beta pruning, depth 6.

function pickAiMove(board: Cell[][]): number {
  const validCols = getValidCols(board);
  if (validCols.length === 0) return -1;

  // Check for immediate win or block
  for (const col of validCols) {
    const row = getDropRow(board, col);
    const b = cloneBoard(board);
    b[row][col] = 2;
    if (checkWin(b, row, col)) return col;
  }
  for (const col of validCols) {
    const row = getDropRow(board, col);
    const b = cloneBoard(board);
    b[row][col] = 1;
    if (checkWin(b, row, col)) return col;
  }

  let bestScore = -Infinity;
  let bestCol = validCols[Math.floor(validCols.length / 2)];

  for (const col of validCols) {
    const row = getDropRow(board, col);
    const b = cloneBoard(board);
    b[row][col] = 2;
    const score = minimax(b, 5, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  return bestCol;
}

function getValidCols(board: Cell[][]): number[] {
  // Prefer center columns
  const order = [3, 2, 4, 1, 5, 0, 6];
  return order.filter((c) => board[0][c] === 0);
}

function minimax(
  board: Cell[][],
  depth: number,
  alpha: number,
  beta: number,
  isMax: boolean
): number {
  if (depth === 0) return evaluateBoard(board);

  const validCols = getValidCols(board);
  if (validCols.length === 0) return 0;

  if (isMax) {
    let best = -Infinity;
    for (const col of validCols) {
      const row = getDropRow(board, col);
      board[row][col] = 2;
      const hasWin = checkWin(board, row, col) !== null;
      const score = hasWin ? 100000 + depth : minimax(board, depth - 1, alpha, beta, false);
      board[row][col] = 0;
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const col of validCols) {
    const row = getDropRow(board, col);
    board[row][col] = 1;
    const hasWin = checkWin(board, row, col) !== null;
    const score = hasWin ? -100000 - depth : minimax(board, depth - 1, alpha, beta, true);
    board[row][col] = 0;
    best = Math.min(best, score);
    beta = Math.min(beta, score);
    if (beta <= alpha) break;
  }
  return best;
}

function evaluateBoard(board: Cell[][]): number {
  let score = 0;

  // Score center column (positional advantage)
  for (let r = 0; r < ROWS; r++) {
    if (board[r][3] === 2) score += 3;
    if (board[r][3] === 1) score -= 3;
  }

  // Score all windows of 4
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of DIRECTIONS_4) {
        const window = getWindow(board, r, c, dr, dc);
        if (window) score += scoreWindow(window);
      }
    }
  }

  return score;
}

function getWindow(board: Cell[][], r: number, c: number, dr: number, dc: number): Cell[] | null {
  const cells: Cell[] = [];
  for (let i = 0; i < 4; i++) {
    const nr = r + dr * i;
    const nc = c + dc * i;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return null;
    cells.push(board[nr][nc]);
  }
  return cells;
}

function scoreWindow(window: Cell[]): number {
  const ai = window.filter((c) => c === 2).length;
  const player = window.filter((c) => c === 1).length;
  const empty = window.filter((c) => c === 0).length;

  if (ai === 3 && empty === 1) return 5;
  if (ai === 2 && empty === 2) return 2;
  if (player === 3 && empty === 1) return -4;
  return 0;
}

// ── Rendering ────────────────────────────────────────────────────────

const BG_COLOR = '#0a0a1a';
const BOARD_COLOR = '#1e3a8a';
const BOARD_BORDER = '#2563eb';
const CELL_EMPTY = '#0f172a';
const PLAYER_COLOR = '#ef4444';
const PLAYER_LIGHT = '#f87171';
const AI_COLOR = '#facc15';
const AI_LIGHT = '#fde68a';
const TEXT_COLOR = '#e2e8f0';
const TEXT_DIM = '#64748b';
const WIN_GLOW = '#22c55e';

interface Layout {
  cellSize: number;
  padX: number;
  padY: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
}

function getLayout(width: number, height: number): Layout {
  // Reserve exactly one hover-disc row above the board plus slim
  // margins — turn text and W/D/L moved out to the page shell, so the
  // old 100px chrome band is gone.
  const maxCellW = Math.floor((width - 24) / COLS);
  const maxCellH = Math.floor((height - 30) / (ROWS + 1));
  const cellSize = Math.min(maxCellW, maxCellH, 60);
  const padX = 3;
  const padY = 3;
  const boardW = COLS * cellSize + padX * 2;
  const boardH = ROWS * cellSize + padY * 2;
  const boardX = (width - boardW) / 2;
  const boardY = height - boardH - 12;
  return { cellSize, padX, padY, boardX, boardY, boardW, boardH };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const layout = getLayout(width, height);

  drawHoverDisc(ctx, state, layout);
  drawBoard(ctx, state, layout);

  if (state.phase === 'ready') {
    drawReadyOverlay(ctx, state);
  } else if (state.phase === 'done') {
    drawDoneOverlay(ctx, state);
  }
}

function drawHoverDisc(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  if (state.phase !== 'playing' || state.turn !== 1 || state.hoverCol < 0) return;
  const { cellSize, boardX, padX, boardY } = layout;
  const r = cellSize * 0.38;
  const cx = boardX + padX + state.hoverCol * cellSize + cellSize / 2;
  const cy = boardY - cellSize / 2 - 4;

  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = PLAYER_COLOR;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBoard(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  const { cellSize, padX, padY, boardX, boardY, boardW, boardH } = layout;

  // Board background
  ctx.fillStyle = BOARD_COLOR;
  roundRect(ctx, boardX, boardY, boardW, boardH, 10);
  ctx.fill();
  ctx.strokeStyle = BOARD_BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();

  const winSet = new Set(state.winCells.map(([r, c]) => `${r},${c}`));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = boardX + padX + c * cellSize + cellSize / 2;
      const cy = boardY + padY + r * cellSize + cellSize / 2;
      const radius = cellSize * 0.38;
      const cell = state.board[r][c];
      const isWinCell = winSet.has(`${r},${c}`);

      // Win cell glow
      if (isWinCell && state.phase === 'done') {
        const pulse = 0.5 + 0.3 * Math.sin(state.frameCount * 0.08);
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 197, 94, ${pulse})`;
        ctx.fill();
      }

      if (cell === 0) {
        // Empty hole
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = CELL_EMPTY;
        ctx.fill();
      } else {
        // Disc
        const color = cell === 1 ? PLAYER_COLOR : AI_COLOR;
        const light = cell === 1 ? PLAYER_LIGHT : AI_LIGHT;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(
          cx - radius * 0.3,
          cy - radius * 0.3,
          1,
          cx,
          cy,
          radius
        );
        grad.addColorStop(0, light);
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.fill();

        if (isWinCell) {
          ctx.strokeStyle = WIN_GLOW;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }
    }
  }
}

function drawReadyOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;

  ctx.fillStyle = 'rgba(10, 10, 26, 0.6)';
  ctx.fillRect(0, 0, width, height);

  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText('Connect 4', width / 2, height / 2 - 50);

  // Button
  const bw = 160;
  const bh = 48;
  const bx = (width - bw) / 2;
  const by = height / 2 - bh / 2;
  ctx.fillStyle = BOARD_BORDER;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();

  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('PLAY', width / 2, by + bh / 2 + 7);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText('Drop 4 in a row to win', width / 2, height / 2 + 50);
}

function drawDoneOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;

  ctx.fillStyle = 'rgba(10, 10, 26, 0.6)';
  ctx.fillRect(0, 0, width, height);

  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = state.winner === 1 ? WIN_GLOW : state.winner === 2 ? AI_COLOR : TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(state.message, width / 2, height / 2 - 30);

  // Play again button
  const bw = 160;
  const bh = 44;
  const bx = (width - bw) / 2;
  const by = height / 2 + 5;
  ctx.fillStyle = BOARD_BORDER;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();

  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Play Again', width / 2, by + bh / 2 + 6);
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

export function colAtPoint(state: GameState, px: number, py: number): number {
  const layout = getLayout(state.width, state.height);
  const { cellSize, boardX, padX, boardY, boardH } = layout;

  // Allow clicks above and on the board
  if (py < boardY - cellSize - 10 || py > boardY + boardH + 10) return -1;
  const col = Math.floor((px - boardX - padX) / cellSize);
  if (col < 0 || col >= COLS) return -1;
  return col;
}
