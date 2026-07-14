// ── Tic-Tac-Toe engine — 30-second survival blitz ────────────────────────

type Cell = 0 | 1 | 2; // 0=empty, 1=player(X), 2=AI(O)

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

const SESSION_DURATION = 30; // seconds
const RESULT_FRAMES = 28; // ~0.47s before advancing to next board
const LOSS_RESULT_FRAMES = 45; // ~0.75s to show loss before session ends
const BOARD_FLASH_FRAMES = 54; // 3 flashes × 18 frames each

export interface GameState {
  width: number;
  height: number;

  // Session
  sessionPhase: 'idle' | 'running' | 'finished';
  timeLeft: number;
  boardsCleared: number; // wins + draws; loss ends the run
  gameCount: number;

  // Per-game
  phase: 'playing' | 'result';
  frameCount: number;
  resultFrames: number;
  board: Cell[];
  turn: 1 | 2;
  winner: 0 | 1 | 2;
  winLine: readonly [number, number, number] | null;
  hoverCell: number;
  playerGoesFirst: boolean;
  lastResult: 'win' | 'loss' | 'draw' | null;

  // Animations
  newBoardFlash: number;
}

// ── Public API ────────────────────────────────────────────────────────────

export function initGame(width: number, height: number): GameState {
  return {
    width,
    height,
    sessionPhase: 'idle',
    timeLeft: SESSION_DURATION,
    boardsCleared: 0,
    gameCount: 0,
    phase: 'playing',
    frameCount: 0,
    resultFrames: 0,
    board: Array<Cell>(9).fill(0),
    turn: 1,
    winner: 0,
    winLine: null,
    hoverCell: -1,
    playerGoesFirst: true,
    lastResult: null,
    newBoardFlash: 0,
  };
}

export function startSession(state: GameState): GameState {
  return {
    ...state,
    sessionPhase: 'running',
    timeLeft: SESSION_DURATION,
    boardsCleared: 0,
    gameCount: 1,
    phase: 'playing',
    frameCount: 0,
    resultFrames: 0,
    board: Array<Cell>(9).fill(0),
    turn: 1,
    winner: 0,
    winLine: null,
    hoverCell: -1,
    playerGoesFirst: true,
    lastResult: null,
    newBoardFlash: BOARD_FLASH_FRAMES,
  };
}

export function setHoverCell(state: GameState, cell: number): GameState {
  if (state.sessionPhase !== 'running' || state.phase !== 'playing' || state.turn !== 1) {
    return { ...state, hoverCell: -1 };
  }
  if (cell >= 0 && state.board[cell] !== 0) return { ...state, hoverCell: -1 };
  return { ...state, hoverCell: cell };
}

export function placeMarker(state: GameState, cell: number): GameState {
  if (state.sessionPhase !== 'running' || state.phase !== 'playing' || state.turn !== 1)
    return state;
  if (cell < 0 || cell >= 9 || state.board[cell] !== 0) return state;

  const board = [...state.board] as Cell[];
  board[cell] = 1;

  const win = checkWinner(board);
  if (win) {
    return {
      ...state,
      board,
      phase: 'result',
      winner: 1,
      winLine: win,
      hoverCell: -1,
      boardsCleared: state.boardsCleared + 1,
      lastResult: 'win',
      resultFrames: RESULT_FRAMES,
    };
  }
  if (isBoardFull(board)) {
    return {
      ...state,
      board,
      phase: 'result',
      winner: 0,
      winLine: null,
      hoverCell: -1,
      boardsCleared: state.boardsCleared + 1,
      lastResult: 'draw',
      resultFrames: RESULT_FRAMES,
    };
  }

  return { ...state, board, turn: 2, hoverCell: -1 };
}

export function aiMove(state: GameState): GameState {
  if (state.sessionPhase !== 'running' || state.phase !== 'playing' || state.turn !== 2)
    return state;

  const cell = pickAiMove(state.board);
  if (cell < 0) return state;

  const board = [...state.board] as Cell[];
  board[cell] = 2;

  const win = checkWinner(board);
  if (win) {
    // Loss — show result briefly, then session ends
    return {
      ...state,
      board,
      phase: 'result',
      winner: 2,
      winLine: win,
      lastResult: 'loss',
      resultFrames: LOSS_RESULT_FRAMES,
    };
  }
  if (isBoardFull(board)) {
    return {
      ...state,
      board,
      phase: 'result',
      winner: 0,
      winLine: null,
      boardsCleared: state.boardsCleared + 1,
      lastResult: 'draw',
      resultFrames: RESULT_FRAMES,
    };
  }

  return { ...state, board, turn: 1 };
}

export function tick(state: GameState, _dt: number): GameState {
  let s = { ...state, frameCount: state.frameCount + 1 };

  if (s.newBoardFlash > 0) {
    s = { ...s, newBoardFlash: s.newBoardFlash - 1 };
  }

  if (s.sessionPhase !== 'running') return s;

  const newTime = Math.max(0, s.timeLeft - 1 / 60);
  s = { ...s, timeLeft: newTime };

  if (newTime <= 0) {
    return { ...s, sessionPhase: 'finished' };
  }

  if (s.phase === 'result' && s.resultFrames > 0) {
    s = { ...s, resultFrames: s.resultFrames - 1 };
    if (s.resultFrames === 0) {
      if (s.lastResult === 'loss') {
        s = { ...s, sessionPhase: 'finished' };
      } else {
        s = advanceToNextGame(s);
      }
    }
  }

  return s;
}

// ── Internal helpers ──────────────────────────────────────────────────────

function advanceToNextGame(state: GameState): GameState {
  const playerGoesFirst = !state.playerGoesFirst;
  return {
    ...state,
    gameCount: state.gameCount + 1,
    phase: 'playing',
    resultFrames: 0,
    board: Array<Cell>(9).fill(0),
    turn: (playerGoesFirst ? 1 : 2) as 1 | 2,
    winner: 0,
    winLine: null,
    hoverCell: -1,
    playerGoesFirst,
    lastResult: null,
    newBoardFlash: BOARD_FLASH_FRAMES,
  };
}

function checkWinner(board: Cell[]): readonly [number, number, number] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) return line;
  }
  return null;
}

function isBoardFull(board: Cell[]): boolean {
  return board.every((c) => c !== 0);
}

// ── Minimax AI ────────────────────────────────────────────────────────────

function pickAiMove(board: Cell[]): number {
  let bestScore = -Infinity;
  let bestCell = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== 0) continue;
    const b = [...board] as Cell[];
    b[i] = 2;
    const score = minimax(b, false);
    if (score > bestScore) {
      bestScore = score;
      bestCell = i;
    }
  }
  return bestCell;
}

function minimax(board: Cell[], isMax: boolean): number {
  const win = checkWinner(board);
  if (win) return board[win[0]] === 2 ? 10 : -10;
  if (isBoardFull(board)) return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== 0) continue;
      board[i] = 2;
      best = Math.max(best, minimax(board, false));
      board[i] = 0;
    }
    return best;
  }

  let best = Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== 0) continue;
    board[i] = 1;
    best = Math.min(best, minimax(board, true));
    board[i] = 0;
  }
  return best;
}

// ── Canvas rendering ──────────────────────────────────────────────────────

const BG_COLOR = '#0a0a1a';
const GRID_COLOR = '#2563eb';
const X_COLOR = '#ef4444';
const O_COLOR = '#facc15';
const GREEN = '#4ade80';
const GREEN_DIM = '#3f9e68';

interface Layout {
  cellSize: number;
  gridX: number;
  gridY: number;
  gridSize: number;
}

function fpx(base: number, width: number): number {
  // Scale chrome with the backing resolution (canvas is sized from
  // display px now), so overlay text reads the same at any size.
  return Math.round(base * (width / 380));
}
function fs(base: number, width: number): string {
  return `${fpx(base, width)}px`;
}

function getLayout(width: number, height: number): Layout {
  // The grid IS the canvas, minus a slim margin — clock/score/status
  // chrome lives in the page shell, not in-canvas. No grid cap: the
  // backing resolution is set from the display size, so bigger canvas
  // = bigger, still-crisp grid.
  const gridSize = Math.min(width - 24, height - 24);
  const cellSize = gridSize / 3;
  const gridX = (width - gridSize) / 2;
  const gridY = (height - gridSize) / 2;
  return { cellSize, gridX, gridY, gridSize };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (state.sessionPhase === 'idle') {
    drawIdleBackground(ctx, state);
    return;
  }

  const layout = getLayout(width, height);
  drawGrid(ctx, state, layout);

  if (state.sessionPhase === 'finished') {
    drawFinishedOverlay(ctx, state);
  }
}

// ── Grid ──────────────────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  const { cellSize, gridX, gridY, gridSize } = layout;

  drawCornerBrackets(
    ctx,
    gridX - 6,
    gridY - 6,
    gridSize + 12,
    gridSize + 12,
    14,
    GRID_COLOR + '66',
    1
  );

  if (state.hoverCell >= 0 && state.board[state.hoverCell] === 0) {
    const row = Math.floor(state.hoverCell / 3);
    const col = state.hoverCell % 3;
    ctx.fillStyle = 'rgba(37,99,235,0.1)';
    ctx.fillRect(gridX + col * cellSize, gridY + row * cellSize, cellSize, cellSize);
  }

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = GRID_COLOR + '44';
  ctx.shadowBlur = 4;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(gridX + i * cellSize, gridY);
    ctx.lineTo(gridX + i * cellSize, gridY + gridSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gridX, gridY + i * cellSize);
    ctx.lineTo(gridX + gridSize, gridY + i * cellSize);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  if (state.winLine && state.phase === 'result') {
    const pulse = 0.28 + 0.22 * Math.sin(state.frameCount * 0.12);
    ctx.fillStyle = `rgba(34,197,94,${pulse})`;
    for (const idx of state.winLine) {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      ctx.fillRect(
        gridX + col * cellSize + 3,
        gridY + row * cellSize + 3,
        cellSize - 6,
        cellSize - 6
      );
    }
  }

  // Loss flash — red pulse on losing line
  if (state.lastResult === 'loss' && state.winLine && state.phase === 'result') {
    const pulse = 0.3 + 0.2 * Math.sin(state.frameCount * 0.18);
    ctx.fillStyle = `rgba(239,68,68,${pulse})`;
    for (const idx of state.winLine) {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      ctx.fillRect(
        gridX + col * cellSize + 3,
        gridY + row * cellSize + 3,
        cellSize - 6,
        cellSize - 6
      );
    }
  }

  for (let i = 0; i < 9; i++) {
    if (state.board[i] === 0) continue;
    const row = Math.floor(i / 3);
    const col = i % 3;
    const cx = gridX + col * cellSize + cellSize / 2;
    const cy = gridY + row * cellSize + cellSize / 2;
    const r = cellSize * 0.3;
    if (state.board[i] === 1) drawX(ctx, cx, cy, r);
    else drawO(ctx, cx, cy, r);
  }
}

function drawX(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.strokeStyle = X_COLOR;
  ctx.lineWidth = r * 0.38;
  ctx.lineCap = 'round';
  ctx.shadowColor = X_COLOR;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r);
  ctx.lineTo(cx + r, cy + r);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r, cy - r);
  ctx.lineTo(cx - r, cy + r);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawO(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.strokeStyle = O_COLOR;
  ctx.lineWidth = r * 0.32;
  ctx.shadowColor = O_COLOR;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ── Overlays ──────────────────────────────────────────────────────────────

function drawIdleBackground(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  const step = width / 12;
  ctx.strokeStyle = 'rgba(34,197,94,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  const gs = Math.min(width, height) * 0.5;
  const gx = (width - gs) / 2;
  const gy = (height - gs) / 2;
  drawCornerBrackets(ctx, gx, gy, gs, gs, 20, 'rgba(34,197,94,0.08)', 1);
}

function drawFinishedOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.fillStyle = 'rgba(10,10,26,0.85)';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;

  // Scale overlay chrome with the backing resolution (see fpx).
  const u = width / 380;

  drawCornerBrackets(ctx, 20 * u, 20 * u, width - 40 * u, height - 40 * u, 20 * u, GREEN_DIM, 1);

  const headerColor = '#ef4444';
  const headerGlow = '#ef444466';
  const headerText = state.lastResult === 'loss' ? 'ELIMINATED!' : "TIME'S UP";

  ctx.font = `bold ${fs(20, width)} monospace`;
  ctx.fillStyle = headerColor;
  ctx.textAlign = 'center';
  ctx.shadowColor = headerGlow;
  ctx.shadowBlur = 16;
  ctx.fillText(headerText, cx, cy - 50 * u);
  ctx.shadowBlur = 0;

  ctx.font = `bold ${fs(52, width)} monospace`;
  ctx.fillStyle = GREEN;
  ctx.shadowColor = '#22c55e88';
  ctx.shadowBlur = 22;
  ctx.fillText(String(state.boardsCleared), cx, cy + 18 * u);
  ctx.shadowBlur = 0;

  ctx.font = `${fs(11, width)} monospace`;
  ctx.fillStyle = GREEN + 'aa';
  ctx.fillText('BOARDS CLEARED', cx, cy + 38 * u);
}

// ── Canvas helpers ────────────────────────────────────────────────────────

// eslint-disable-next-line max-params
function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  color: string,
  lineWidth = 1.5
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w - size, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + size);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + h - size);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + size, y + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w - size, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - size);
  ctx.stroke();
}

export function cellAtPoint(state: GameState, px: number, py: number): number {
  const { cellSize, gridX, gridY, gridSize } = getLayout(state.width, state.height);
  if (px < gridX || px > gridX + gridSize || py < gridY || py > gridY + gridSize) return -1;
  const col = Math.floor((px - gridX) / cellSize);
  const row = Math.floor((py - gridY) / cellSize);
  if (col < 0 || col >= 3 || row < 0 || row >= 3) return -1;
  return row * 3 + col;
}
