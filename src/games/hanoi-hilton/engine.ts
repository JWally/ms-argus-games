// ── Tower of Hanoi engine ─────────────────────────────────────────────

// Disks: 1 = smallest, N = largest. Pegs: 0=left, 1=middle, 2=right.
// Goal: move all disks from peg 0 to peg 2.

export interface GameState {
  width: number;
  height: number;
  phase: 'menu' | 'playing' | 'done';
  frameCount: number;
  numDisks: number;
  pegs: [number[], number[], number[]];
  selectedPeg: number | null;
  moves: number;
  par: number; // 2^numDisks - 1
  bestMoves: Record<number, number>;
  message: string;
}

// ── Public API ───────────────────────────────────────────────────────────

export function initGame(width: number, height: number): GameState {
  return {
    width,
    height,
    phase: 'menu',
    frameCount: 0,
    numDisks: 3,
    pegs: [[], [], []],
    selectedPeg: null,
    moves: 0,
    par: 7,
    bestMoves: loadBest(),
    message: '',
  };
}

export function startGame(state: GameState, numDisks: number): GameState {
  const pegs: [number[], number[], number[]] = [
    Array.from({ length: numDisks }, (_, i) => numDisks - i),
    [],
    [],
  ];
  return {
    ...state,
    phase: 'playing',
    numDisks,
    pegs,
    selectedPeg: null,
    moves: 0,
    par: (1 << numDisks) - 1,
    message: '',
  };
}

export function goToMenu(state: GameState): GameState {
  return { ...state, phase: 'menu', selectedPeg: null, message: '' };
}

export function selectPeg(state: GameState, pegIdx: number): GameState {
  if (state.phase !== 'playing') return state;
  if (pegIdx < 0 || pegIdx > 2) return state;

  if (state.selectedPeg === null) {
    if (state.pegs[pegIdx].length === 0) return state;
    return { ...state, selectedPeg: pegIdx, message: '' };
  }

  const from = state.selectedPeg;
  const to = pegIdx;

  if (from === to) return { ...state, selectedPeg: null };

  const fromPeg = state.pegs[from];
  const toPeg = state.pegs[to];
  const disk = fromPeg[fromPeg.length - 1];

  if (toPeg.length > 0 && toPeg[toPeg.length - 1] < disk) {
    return { ...state, message: 'Cannot place larger on smaller', selectedPeg: null };
  }

  const newPegs: [number[], number[], number[]] = [
    [...state.pegs[0]],
    [...state.pegs[1]],
    [...state.pegs[2]],
  ];
  newPegs[from] = newPegs[from].slice(0, -1);
  newPegs[to] = [...newPegs[to], disk];

  const moves = state.moves + 1;

  if (newPegs[2].length === state.numDisks) {
    const newBest = { ...state.bestMoves };
    if (!newBest[state.numDisks] || moves < newBest[state.numDisks]) {
      newBest[state.numDisks] = moves;
      saveBest(newBest);
    }
    return {
      ...state,
      pegs: newPegs,
      selectedPeg: null,
      moves,
      phase: 'done',
      message: moves <= state.par ? 'Perfect solve!' : 'Solved!',
      bestMoves: newBest,
    };
  }

  return { ...state, pegs: newPegs, selectedPeg: null, moves, message: '' };
}

export function tick(state: GameState, _dt: number): GameState {
  return { ...state, frameCount: state.frameCount + 1 };
}

// ── Persistence ───────────────────────────────────────────────────────────

function loadBest(): Record<number, number> {
  try {
    const raw = localStorage.getItem('hanoi-best');
    if (raw) return JSON.parse(raw) as Record<number, number>;
  } catch {
    /* ignore */
  }
  return {};
}

function saveBest(best: Record<number, number>): void {
  try {
    localStorage.setItem('hanoi-best', JSON.stringify(best));
  } catch {
    /* storage full */
  }
}

// ── Canvas rendering ──────────────────────────────────────────────────────

const BG_COLOR = '#0a0a1a';
const PEG_COLOR = '#334155';
const PEG_BORDER = '#475569';
const BASE_COLOR = '#1e293b';
const BASE_BORDER = '#334155';
const TEXT_COLOR = '#e2e8f0';
const TEXT_DIM = '#64748b';
const WIN_GLOW = '#22c55e';
const SELECT_GLOW = '#8b5cf6';
const GRID_BLUE = '#2563eb';

const DISK_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#a855f7'];

interface Layout {
  pegX: [number, number, number];
  pegH: number;
  pegBaseY: number;
  baseX: number;
  baseW: number;
  baseH: number;
  diskH: number;
  maxDiskW: number;
  minDiskW: number;
}

function getLayout(width: number, height: number, numDisks: number): Layout {
  const margin = 20;
  const baseH = 14;
  const diskH = Math.min(26, Math.floor((height - 160) / (numDisks + 2)));
  const pegBaseY = height - 55;
  const pegH = diskH * (numDisks + 1) + 20;
  const maxDiskW = Math.min((width - margin * 2) / 3 - 12, 130);
  const minDiskW = maxDiskW * 0.22;
  const section = (width - margin * 2) / 3;
  const pegX: [number, number, number] = [
    margin + section * 0.5,
    margin + section * 1.5,
    margin + section * 2.5,
  ];
  return {
    pegX,
    pegH,
    pegBaseY,
    baseX: margin,
    baseW: width - margin * 2,
    baseH,
    diskH,
    maxDiskW,
    minDiskW,
  };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (state.phase === 'menu') {
    drawMenuOverlay(ctx, state);
    return;
  }

  const layout = getLayout(width, height, state.numDisks);
  drawHud(ctx, state, layout);
  drawBase(ctx, layout);
  drawPegs(ctx, state, layout);
  drawDisks(ctx, state, layout);

  if (state.phase === 'done') drawDoneOverlay(ctx, state);
}

function drawMenuOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;

  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText('Hanoi Hilton', width / 2, height * 0.2);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText('Move all disks to the right peg', width / 2, height * 0.2 + 28);
  ctx.fillText('No larger disk on a smaller one', width / 2, height * 0.2 + 46);

  const options = [3, 4, 5, 6, 7];
  const btnW = 44;
  const btnH = 44;
  const gap = 10;
  const totalW = options.length * (btnW + gap) - gap;
  const startX = (width - totalW) / 2;
  const btnY = height * 0.44;

  ctx.font = '11px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.textAlign = 'center';
  ctx.fillText('Choose difficulty (number of disks):', width / 2, btnY - 14);

  for (let i = 0; i < options.length; i++) {
    const n = options[i];
    const bx = startX + i * (btnW + gap);
    const best = state.bestMoves[n];
    const par = (1 << n) - 1;

    ctx.fillStyle = '#1e3a8a';
    roundRect(ctx, bx, btnY, btnW, btnH, 6);
    ctx.fill();
    ctx.strokeStyle = GRID_BLUE;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(n), bx + btnW / 2, btnY + btnH * 0.52);

    ctx.font = '8px sans-serif';
    if (best) {
      ctx.fillStyle = best <= par ? WIN_GLOW : TEXT_DIM;
      ctx.fillText(`best:${best}`, bx + btnW / 2, btnY + btnH - 5);
    } else {
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(`par ${par}`, bx + btnW / 2, btnY + btnH - 5);
    }
  }
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, _layout: Layout): void {
  const { width } = state;

  ctx.font = '12px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.textAlign = 'left';
  ctx.fillText(`Moves: ${state.moves}`, 16, 28);

  ctx.textAlign = 'center';
  ctx.fillText(`Par: ${state.par}`, width / 2, 28);

  const best = state.bestMoves[state.numDisks];
  ctx.textAlign = 'right';
  ctx.fillText(best ? `Best: ${best}` : '', width - 16, 28);

  if (state.message && state.phase === 'playing') {
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.fillText(state.message, width / 2, 46);
  }
}

function drawBase(ctx: CanvasRenderingContext2D, layout: Layout): void {
  ctx.fillStyle = BASE_COLOR;
  roundRect(ctx, layout.baseX, layout.pegBaseY, layout.baseW, layout.baseH, 4);
  ctx.fill();
  ctx.strokeStyle = BASE_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPegs(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  const { pegX, pegH, pegBaseY } = layout;
  const labels = ['A', 'B', 'C'] as const;
  for (let i = 0; i < 3; i++) {
    const isSelected = state.selectedPeg === i;
    const pegW = 8;

    if (isSelected) {
      ctx.shadowColor = SELECT_GLOW;
      ctx.shadowBlur = 16;
    }

    ctx.fillStyle = isSelected ? SELECT_GLOW : PEG_COLOR;
    roundRect(ctx, pegX[i] - pegW / 2, pegBaseY - pegH, pegW, pegH, 2);
    ctx.fill();
    ctx.strokeStyle = isSelected ? SELECT_GLOW : PEG_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = '10px sans-serif';
    ctx.fillStyle = isSelected ? SELECT_GLOW : TEXT_DIM;
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], pegX[i], pegBaseY + layout.baseH + 14);
  }
}

function drawDisks(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  const { pegX, pegBaseY, diskH, maxDiskW, minDiskW } = layout;
  const range = state.numDisks > 1 ? state.numDisks - 1 : 1;

  for (let p = 0; p < 3; p++) {
    const peg = state.pegs[p];
    for (let d = 0; d < peg.length; d++) {
      const diskSize = peg[d];
      const w = minDiskW + (maxDiskW - minDiskW) * ((diskSize - 1) / range);
      const h = diskH - 3;
      const x = pegX[p] - w / 2;
      const y = pegBaseY - (d + 1) * diskH;
      const color = DISK_COLORS[(diskSize - 1) % DISK_COLORS.length];

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      roundRect(ctx, x + 2, y + 2, w, h, 4);
      ctx.fill();

      ctx.fillStyle = color;
      roundRect(ctx, x, y, w, h, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      roundRect(ctx, x + 2, y + 1, w - 4, h * 0.35, 3);
      ctx.fill();

      if (diskH >= 20) {
        ctx.font = `bold ${Math.min(diskH - 8, 12)}px sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.textAlign = 'center';
        ctx.fillText(String(diskSize), pegX[p], y + h / 2 + 4);
      }
    }
  }
}

function drawDoneOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.fillStyle = 'rgba(10,10,26,0.6)';
  ctx.fillRect(0, 0, width, height);

  const isPerfect = state.moves <= state.par;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = isPerfect ? WIN_GLOW : TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(state.message, width / 2, height / 2 - 40);

  ctx.font = '14px sans-serif';
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(`${state.moves} moves · par ${state.par}`, width / 2, height / 2 - 14);

  const bw = 160;
  const bh = 44;
  const bx = (width - bw) / 2;
  const by = height / 2 + 12;
  ctx.fillStyle = '#1e3a8a';
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();
  ctx.strokeStyle = GRID_BLUE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Play Again', width / 2, by + bh / 2 + 5);
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

export function pegAtPoint(state: GameState, px: number, py: number): number {
  const layout = getLayout(state.width, state.height, state.numDisks);
  if (py > layout.pegBaseY + layout.baseH + 24) return -1;
  const section = (state.width - 40) / 3;
  const col = Math.floor((px - 20) / section);
  if (col < 0 || col > 2) return -1;
  return col;
}

export function menuDiskAtPoint(state: GameState, px: number, py: number): number {
  if (state.phase !== 'menu') return -1;
  const { width, height } = state;
  const options = [3, 4, 5, 6, 7];
  const btnW = 44;
  const btnH = 44;
  const gap = 10;
  const totalW = options.length * (btnW + gap) - gap;
  const startX = (width - totalW) / 2;
  const btnY = height * 0.44;

  for (let i = 0; i < options.length; i++) {
    const bx = startX + i * (btnW + gap);
    if (px >= bx && px <= bx + btnW && py >= btnY && py <= btnY + btnH) return options[i];
  }
  return -1;
}
