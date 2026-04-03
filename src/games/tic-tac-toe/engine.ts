// ── Tic-Tac-Toe engine ────────────────────────────────────────────────

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

export interface GameState {
  width: number;
  height: number;
  phase: 'ready' | 'playing' | 'done';
  frameCount: number;
  board: Cell[];
  turn: 1 | 2;
  winner: 0 | 1 | 2;
  winLine: readonly [number, number, number] | null;
  hoverCell: number;
  wins: number;
  losses: number;
  draws: number;
}

// ── Public API ──────────────────────────────────────────────────────────

export function initGame(width: number, height: number): GameState {
  const stats = loadStats();
  return {
    width,
    height,
    phase: 'ready',
    frameCount: 0,
    board: Array<Cell>(9).fill(0),
    turn: 1,
    winner: 0,
    winLine: null,
    hoverCell: -1,
    ...stats,
  };
}

export function startPlaying(state: GameState): GameState {
  return {
    ...state,
    phase: 'playing',
    board: Array<Cell>(9).fill(0),
    turn: 1,
    winner: 0,
    winLine: null,
    hoverCell: -1,
  };
}

export function setHoverCell(state: GameState, cell: number): GameState {
  if (state.phase !== 'playing' || state.turn !== 1) return { ...state, hoverCell: -1 };
  if (cell >= 0 && state.board[cell] !== 0) return { ...state, hoverCell: -1 };
  return { ...state, hoverCell: cell };
}

export function placeMarker(state: GameState, cell: number): GameState {
  if (state.phase !== 'playing' || state.turn !== 1) return state;
  if (cell < 0 || cell >= 9 || state.board[cell] !== 0) return state;

  const board = [...state.board] as Cell[];
  board[cell] = 1;

  const win = checkWinner(board);
  if (win) {
    const wins = state.wins + 1;
    saveStats(wins, state.losses, state.draws);
    return { ...state, board, phase: 'done', winner: 1, winLine: win, hoverCell: -1, wins };
  }
  if (isBoardFull(board)) {
    const draws = state.draws + 1;
    saveStats(state.wins, state.losses, draws);
    return { ...state, board, phase: 'done', winner: 0, winLine: null, hoverCell: -1, draws };
  }

  return { ...state, board, turn: 2, hoverCell: -1 };
}

export function aiMove(state: GameState): GameState {
  if (state.phase !== 'playing' || state.turn !== 2) return state;

  const cell = pickAiMove(state.board);
  if (cell < 0) return state;

  const board = [...state.board] as Cell[];
  board[cell] = 2;

  const win = checkWinner(board);
  if (win) {
    const losses = state.losses + 1;
    saveStats(state.wins, losses, state.draws);
    return { ...state, board, phase: 'done', winner: 2, winLine: win, losses };
  }
  if (isBoardFull(board)) {
    const draws = state.draws + 1;
    saveStats(state.wins, state.losses, draws);
    return { ...state, board, phase: 'done', winner: 0, winLine: null, draws };
  }

  return { ...state, board, turn: 1 };
}

export function tick(state: GameState, _dt: number): GameState {
  return { ...state, frameCount: state.frameCount + 1 };
}

// ── Stats persistence ────────────────────────────────────────────────────

function loadStats(): { wins: number; losses: number; draws: number } {
  try {
    const raw = localStorage.getItem('ttt-stats');
    if (raw) return JSON.parse(raw) as { wins: number; losses: number; draws: number };
  } catch {
    /* ignore */
  }
  return { wins: 0, losses: 0, draws: 0 };
}

function saveStats(wins: number, losses: number, draws: number): void {
  try {
    localStorage.setItem('ttt-stats', JSON.stringify({ wins, losses, draws }));
  } catch {
    /* storage full */
  }
}

// ── Game logic ────────────────────────────────────────────────────────────

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
const TEXT_DIM = '#64748b';
const WIN_GLOW = '#22c55e';

interface Layout {
  cellSize: number;
  gridX: number;
  gridY: number;
  gridSize: number;
}

function getLayout(width: number, height: number): Layout {
  const gridSize = Math.min(width - 32, height - 100, 300);
  const cellSize = gridSize / 3;
  const gridX = (width - gridSize) / 2;
  const gridY = (height - gridSize) / 2 + 10;
  return { cellSize, gridX, gridY, gridSize };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const layout = getLayout(width, height);
  drawHud(ctx, state, layout);
  drawGrid(ctx, state, layout);

  if (state.phase === 'ready') drawReadyOverlay(ctx, state);
  else if (state.phase === 'done') drawDoneOverlay(ctx, state);
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  const { width } = state;
  const y = layout.gridY - 28;

  ctx.font = '11px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.textAlign = 'left';
  ctx.fillText(`W: ${state.wins}`, layout.gridX, y);
  ctx.textAlign = 'center';
  ctx.fillText(`D: ${state.draws}`, width / 2, y);
  ctx.textAlign = 'right';
  ctx.fillText(`L: ${state.losses}`, layout.gridX + layout.gridSize, y);

  if (state.phase === 'playing') {
    ctx.textAlign = 'center';
    ctx.font = '13px sans-serif';
    ctx.fillStyle = state.turn === 1 ? X_COLOR : O_COLOR;
    ctx.fillText(
      state.turn === 1 ? 'Your turn (X)' : 'AI thinking... (O)',
      width / 2,
      layout.gridY - 10
    );
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  const { cellSize, gridX, gridY, gridSize } = layout;

  // Hover highlight
  if (state.hoverCell >= 0 && state.board[state.hoverCell] === 0) {
    const row = Math.floor(state.hoverCell / 3);
    const col = state.hoverCell % 3;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(gridX + col * cellSize, gridY + row * cellSize, cellSize, cellSize);
  }

  // Grid lines
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 2;
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

  // Win cell highlight
  if (state.winLine && state.phase === 'done') {
    const pulse = 0.25 + 0.2 * Math.sin(state.frameCount * 0.1);
    ctx.fillStyle = `rgba(34,197,94,${pulse})`;
    for (const idx of state.winLine) {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      ctx.fillRect(
        gridX + col * cellSize + 2,
        gridY + row * cellSize + 2,
        cellSize - 4,
        cellSize - 4
      );
    }
  }

  // Draw markers
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
  ctx.lineWidth = r * 0.35;
  ctx.lineCap = 'round';
  ctx.shadowColor = X_COLOR;
  ctx.shadowBlur = 8;
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
  ctx.lineWidth = r * 0.3;
  ctx.shadowColor = O_COLOR;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawReadyOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.fillStyle = 'rgba(10,10,26,0.6)';
  ctx.fillRect(0, 0, width, height);

  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText('Tic-Tac-Toe', width / 2, height / 2 - 50);

  const bw = 160;
  const bh = 48;
  const bx = (width - bw) / 2;
  const by = height / 2 - bh / 2;
  ctx.fillStyle = GRID_COLOR;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('PLAY', width / 2, by + bh / 2 + 7);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText('You are X · AI plays O', width / 2, height / 2 + 50);
}

function drawDoneOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.fillStyle = 'rgba(10,10,26,0.55)';
  ctx.fillRect(0, 0, width, height);

  const msg = state.winner === 1 ? 'You win!' : state.winner === 2 ? 'AI wins!' : "It's a draw!";
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = state.winner === 1 ? WIN_GLOW : state.winner === 2 ? O_COLOR : '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText(msg, width / 2, height / 2 - 30);

  const bw = 160;
  const bh = 44;
  const bx = (width - bw) / 2;
  const by = height / 2 + 5;
  ctx.fillStyle = GRID_COLOR;
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

// ── Hit detection ────────────────────────────────────────────────────────

export function cellAtPoint(state: GameState, px: number, py: number): number {
  const { cellSize, gridX, gridY, gridSize } = getLayout(state.width, state.height);
  if (px < gridX || px > gridX + gridSize || py < gridY || py > gridY + gridSize) return -1;
  const col = Math.floor((px - gridX) / cellSize);
  const row = Math.floor((py - gridY) / cellSize);
  if (col < 0 || col >= 3 || row < 0 || row >= 3) return -1;
  return row * 3 + col;
}
