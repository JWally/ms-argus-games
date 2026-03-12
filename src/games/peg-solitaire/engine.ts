// ── Triangle Peg Solitaire engine ────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────

interface Jump {
  from: number;
  over: number;
  to: number;
}

export interface GameState {
  width: number;
  height: number;
  phase: 'ready' | 'playing' | 'done';
  frameCount: number;
  pegs: boolean[]; // 15 slots, true = has peg
  selected: number | null;
  validJumps: Jump[];
  pegsRemaining: number;
  startTime: number;
  endTime: number;
  elapsed: number;
  message: string;
}

// ── Board topology ───────────────────────────────────────────────────

interface Pos {
  row: number;
  col: number;
}

const POSITIONS: Pos[] = [
  { row: 0, col: 0 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 2, col: 0 },
  { row: 2, col: 1 },
  { row: 2, col: 2 },
  { row: 3, col: 0 },
  { row: 3, col: 1 },
  { row: 3, col: 2 },
  { row: 3, col: 3 },
  { row: 4, col: 0 },
  { row: 4, col: 1 },
  { row: 4, col: 2 },
  { row: 4, col: 3 },
  { row: 4, col: 4 },
];

function indexAt(row: number, col: number): number {
  if (row < 0 || row > 4 || col < 0 || col > row) return -1;
  return (row * (row + 1)) / 2 + col;
}

// ── Jump table ───────────────────────────────────────────────────────
// Pre-computed list of every possible jump on the board.

// Direction vectors: [midRowDelta, midColDelta, toRowDelta, toColDelta]
const DIRECTIONS: [number, number, number, number][] = [
  [0, 1, 0, 2], // horizontal right
  [0, -1, 0, -2], // horizontal left
  [1, 1, 2, 2], // diagonal-right down
  [-1, -1, -2, -2], // diagonal-right up
  [1, 0, 2, 0], // diagonal-left down
  [-1, 0, -2, 0], // diagonal-left up
];

function buildJumpTable(): Jump[] {
  const jumps: Jump[] = [];
  for (let i = 0; i < 15; i++) {
    const { row, col } = POSITIONS[i];
    for (const [dr1, dc1, dr2, dc2] of DIRECTIONS) {
      const over = indexAt(row + dr1, col + dc1);
      const to = indexAt(row + dr2, col + dc2);
      if (over >= 0 && to >= 0) {
        jumps.push({ from: i, over, to });
      }
    }
  }
  return jumps;
}

const ALL_JUMPS = buildJumpTable();

// ── Helpers ──────────────────────────────────────────────────────────

function countPegs(pegs: boolean[]): number {
  let n = 0;
  for (const p of pegs) {
    if (p) n++;
  }
  return n;
}

function getJumpsForPeg(pegs: boolean[], pegIndex: number): Jump[] {
  return ALL_JUMPS.filter(
    (j) => j.from === pegIndex && pegs[j.from] && pegs[j.over] && !pegs[j.to]
  );
}

function hasAnyMove(pegs: boolean[]): boolean {
  return ALL_JUMPS.some((j) => pegs[j.from] && pegs[j.over] && !pegs[j.to]);
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const tenths = Math.floor((totalSec * 10) % 10);
  const secStr = sec < 10 ? `0${sec}` : String(sec);
  return `${min}:${secStr}.${tenths}`;
}

// ── Pixel positions for each peg ─────────────────────────────────────

const PEG_RADIUS = 18;
const HOLE_RADIUS = 20;
const ROW_SPACING = 52;
const COL_SPACING = 52;

interface PixelPos {
  x: number;
  y: number;
}

function getPegPixelPositions(width: number, height: number): PixelPos[] {
  const boardHeight = 4 * ROW_SPACING;
  const topY = (height - boardHeight) / 2 + 10;
  return POSITIONS.map(({ row, col }) => {
    const rowWidth = row * COL_SPACING;
    const x = width / 2 - rowWidth / 2 + col * COL_SPACING;
    const y = topY + row * ROW_SPACING;
    return { x, y };
  });
}

// ── Public API ───────────────────────────────────────────────────────

export function initGame(width: number, height: number): GameState {
  const pegs = Array.from<boolean>({ length: 15 }).fill(true);
  pegs[0] = false; // top peg removed
  return {
    width,
    height,
    phase: 'ready',
    frameCount: 0,
    pegs,
    selected: null,
    validJumps: [],
    pegsRemaining: 14,
    startTime: 0,
    endTime: 0,
    elapsed: 0,
    message: '',
  };
}

export function startPlaying(state: GameState): GameState {
  return { ...state, phase: 'playing', startTime: Date.now() };
}

export function selectPeg(state: GameState, index: number): GameState {
  if (state.phase !== 'playing' || index < 0 || index > 14) return state;

  // Tap on selected peg -> deselect
  if (state.selected === index) {
    return { ...state, selected: null, validJumps: [] };
  }

  // Tap on a peg -> select it
  if (state.pegs[index]) {
    const jumps = getJumpsForPeg(state.pegs, index);
    return { ...state, selected: index, validJumps: jumps };
  }

  // Tap on empty hole -> try to jump there
  if (state.selected !== null && !state.pegs[index]) {
    const jump = state.validJumps.find((j) => j.to === index);
    if (jump) {
      return executeJump(state, jump);
    }
  }

  return state;
}

function executeJump(state: GameState, jump: Jump): GameState {
  const pegs = [...state.pegs];
  pegs[jump.from] = false;
  pegs[jump.over] = false;
  pegs[jump.to] = true;
  const remaining = countPegs(pegs);
  const movesLeft = hasAnyMove(pegs);

  if (!movesLeft || remaining === 1) {
    const now = Date.now();
    const elapsed = now - state.startTime;
    const msg = buildEndMessage(remaining);
    return {
      ...state,
      pegs,
      selected: null,
      validJumps: [],
      pegsRemaining: remaining,
      phase: 'done',
      endTime: now,
      elapsed,
      message: msg,
    };
  }

  // Auto-select the landed peg if it has further jumps
  const nextJumps = getJumpsForPeg(pegs, jump.to);
  const nextSelected = nextJumps.length > 0 ? jump.to : null;

  return {
    ...state,
    pegs,
    selected: nextSelected,
    validJumps: nextSelected !== null ? nextJumps : [],
    pegsRemaining: remaining,
  };
}

function buildEndMessage(remaining: number): string {
  if (remaining === 1) return 'Genius! You solved it!';
  if (remaining === 2) return 'So close! Only 2 pegs left.';
  if (remaining === 3) return 'Not bad - 3 pegs remaining.';
  return `${remaining} pegs remaining. Try again!`;
}

export function quitGame(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  const now = Date.now();
  return {
    ...state,
    phase: 'done',
    endTime: now,
    elapsed: now - state.startTime,
    message: 'Game abandoned.',
  };
}

export function tick(state: GameState, _dt: number): GameState {
  if (state.phase !== 'playing') {
    return { ...state, frameCount: state.frameCount + 1 };
  }
  return {
    ...state,
    frameCount: state.frameCount + 1,
    elapsed: Date.now() - state.startTime,
  };
}

// ── High score ───────────────────────────────────────────────────────
// Score = time in seconds (lower is better). 0 = no score yet.

export function getHighScore(): number {
  const v = localStorage.getItem('peg-solitaire-high');
  return v ? Number(v) : 0;
}

export function saveHighScore(score: number): void {
  const prev = getHighScore();
  if (prev === 0 || score < prev) {
    localStorage.setItem('peg-solitaire-high', String(score));
  }
}

// ── Rendering ────────────────────────────────────────────────────────

const BG_COLOR = '#0a0a1a';
const HOLE_COLOR = '#1a1a2e';
const HOLE_BORDER = '#2a2a44';
const PEG_COLOR = '#8b5cf6';
const PEG_HIGHLIGHT = '#a78bfa';
const SELECTED_GLOW = '#c4b5fd';
const JUMP_TARGET_COLOR = '#22c55e';
const TEXT_COLOR = '#e2e8f0';
const TEXT_DIM = '#64748b';
const BUTTON_COLOR = '#8b5cf6';
const BUTTON_HOVER = '#7c3aed';

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const positions = getPegPixelPositions(width, height);

  drawBoard(ctx, state, positions);
  drawHud(ctx, state);

  if (state.phase === 'ready') {
    drawOverlayButton(ctx, width, height, 'START');
  } else if (state.phase === 'done') {
    drawDoneOverlay(ctx, state);
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, state: GameState, positions: PixelPos[]): void {
  const jumpTargets = new Set(state.validJumps.map((j) => j.to));

  // Draw connecting lines for board structure
  drawBoardLines(ctx, positions);

  // Draw each position
  for (let i = 0; i < 15; i++) {
    const { x, y } = positions[i];
    const hasPeg = state.pegs[i];
    const isSelected = state.selected === i;
    const isJumpTarget = jumpTargets.has(i);

    if (isJumpTarget && !hasPeg) {
      drawJumpTarget(ctx, x, y, state.frameCount);
    } else if (!hasPeg) {
      drawHole(ctx, x, y);
    }

    if (hasPeg && isSelected) {
      drawSelectedPeg(ctx, x, y, state.frameCount);
    } else if (hasPeg) {
      drawPeg(ctx, x, y);
    }
  }
}

function drawBoardLines(ctx: CanvasRenderingContext2D, positions: PixelPos[]): void {
  ctx.strokeStyle = HOLE_BORDER;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4;

  // Draw lines between adjacent positions
  for (let i = 0; i < 15; i++) {
    const { row, col } = POSITIONS[i];
    const neighbors = [
      indexAt(row, col + 1), // horizontal right
      indexAt(row + 1, col), // diagonal-left down
      indexAt(row + 1, col + 1), // diagonal-right down
    ];
    for (const n of neighbors) {
      if (n >= 0) {
        ctx.beginPath();
        ctx.moveTo(positions[i].x, positions[i].y);
        ctx.lineTo(positions[n].x, positions[n].y);
        ctx.stroke();
      }
    }
  }

  ctx.globalAlpha = 1;
}

function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = HOLE_COLOR;
  ctx.fill();
  ctx.strokeStyle = HOLE_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPeg(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Shadow
  ctx.beginPath();
  ctx.arc(x + 2, y + 2, PEG_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  // Peg body
  ctx.beginPath();
  ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, PEG_RADIUS);
  grad.addColorStop(0, PEG_HIGHLIGHT);
  grad.addColorStop(1, PEG_COLOR);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawSelectedPeg(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  // Pulsing glow
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.08);
  const glowRadius = PEG_RADIUS + 6 + pulse * 4;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(196, 181, 253, ${0.15 + pulse * 0.15})`;
  ctx.fill();

  // Inner glow ring
  ctx.beginPath();
  ctx.arc(x, y, PEG_RADIUS + 3, 0, Math.PI * 2);
  ctx.strokeStyle = SELECTED_GLOW;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Peg body (brighter)
  ctx.beginPath();
  ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, PEG_RADIUS);
  grad.addColorStop(0, '#ddd6fe');
  grad.addColorStop(1, PEG_HIGHLIGHT);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawJumpTarget(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.1);

  // Glowing hole
  ctx.beginPath();
  ctx.arc(x, y, HOLE_RADIUS + 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(34, 197, 94, ${0.1 + pulse * 0.1})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = HOLE_COLOR;
  ctx.fill();
  ctx.strokeStyle = JUMP_TARGET_COLOR;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(x, y, HOLE_RADIUS - 6, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(34, 197, 94, ${0.3 + pulse * 0.3})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width } = state;

  // Timer
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(formatTime(state.elapsed), width / 2, 36);

  // Pegs remaining
  ctx.font = '14px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.textAlign = 'left';
  ctx.fillText(`Pegs: ${state.pegsRemaining}`, 12, 30);

  // Quit button during play
  if (state.phase === 'playing') {
    drawQuitButton(ctx, width);
  }
}

function drawQuitButton(ctx: CanvasRenderingContext2D, canvasW: number): void {
  const x = canvasW - 50;
  const y = 12;
  const w = 40;
  const h = 22;
  ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
  roundRect(ctx, x, y, w, h);
  ctx.fill();
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('QUIT', x + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic';
}

function drawOverlayButton(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  label: string
): void {
  // Dim overlay
  ctx.fillStyle = 'rgba(10, 10, 26, 0.5)';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText('Peg Solitaire', width / 2, height / 2 - 50);

  // Button
  const bw = 160;
  const bh = 48;
  const bx = (width - bw) / 2;
  const by = height / 2 - bh / 2;
  ctx.fillStyle = BUTTON_COLOR;
  roundRect(ctx, bx, by, bw, bh);
  ctx.fill();

  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(label, width / 2, by + bh / 2 + 7);

  // Instructions
  ctx.font = '12px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText('Jump pegs to remove them', width / 2, height / 2 + 50);
  ctx.fillText('Leave just 1 peg to win!', width / 2, height / 2 + 68);
}

function drawDoneOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;

  // Dim overlay
  ctx.fillStyle = 'rgba(10, 10, 26, 0.7)';
  ctx.fillRect(0, 0, width, height);

  // Result message
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = state.pegsRemaining === 1 ? JUMP_TARGET_COLOR : TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(state.message, width / 2, height / 2 - 55);

  // Stats
  ctx.font = '16px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(`Time: ${formatTime(state.elapsed)}`, width / 2, height / 2 - 20);
  ctx.fillText(`Pegs left: ${state.pegsRemaining}`, width / 2, height / 2 + 5);

  if (state.pegsRemaining === 1) {
    const score = Math.round(state.elapsed / 100) / 10;
    const best = getHighScore();
    if (best > 0) {
      ctx.fillText(`Best time: ${best.toFixed(1)}s`, width / 2, height / 2 + 30);
    }
    ctx.fillText(`Score: ${score.toFixed(1)}s`, width / 2, height / 2 + 55);
  }

  // Play Again button
  const bw = 160;
  const bh = 44;
  const bx = (width - bw) / 2;
  const by = height / 2 + 72;
  ctx.fillStyle = BUTTON_HOVER;
  roundRect(ctx, bx, by, bw, bh);
  ctx.fill();

  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Play Again', width / 2, by + bh / 2 + 6);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const r = 8;
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

export function pegIndexAtPoint(state: GameState, px: number, py: number): number {
  const positions = getPegPixelPositions(state.width, state.height);
  const threshold = 25 * 25;
  let closest = -1;
  let closestDist = threshold + 1;

  for (let i = 0; i < 15; i++) {
    const dx = positions[i].x - px;
    const dy = positions[i].y - py;
    const dist = dx * dx + dy * dy;
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  }

  return closestDist <= threshold ? closest : -1;
}

export function isQuitButtonHit(state: GameState, px: number, _py: number): boolean {
  return state.phase === 'playing' && px > state.width - 60 && _py >= 8 && _py <= 38;
}
