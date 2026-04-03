// ── AMAZE game engine ────────────────────────────────────────────────────
// Slide-to-clear maze: the player slides until hitting a wall OR a junction
// (any cell with a perpendicular opening), painting every cell they pass
// through. Goal: clear every cell before time runs out, without hitting
// mines or getting caught by the patrol.

export type Direction = 'n' | 's' | 'e' | 'w';

interface WallCell {
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
}

export interface GameState {
  size: number;
  walls: WallCell[][];
  painted: boolean[][];
  paintedAt: (number | null)[][]; // wall-clock ms when cell was last painted
  playerRow: number;
  playerCol: number;
  moves: number;
  won: boolean;
  lost: boolean;
  lostReason: 'limit' | 'mine' | 'patrol' | 'time' | null;
  paintedCount: number;
  par: number; // greedy solver move count (benchmark)
  moveLimit: number; // hard move cap; reaching it → lostReason 'limit'
  mines: boolean[][]; // cells that kill on entry
  fadeDuration: number; // ms before a painted cell fades back to empty
  timeLimit: number; // total seconds allowed
  deadline: number; // absolute ms deadline; Infinity until game started
  patrol: { row: number; col: number; dir: Direction } | null;
  patrolOrigin: { row: number; col: number; dir: Direction } | null;
}

// ── Grid helpers ──────────────────────────────────────────────────────────

function makeGrid<T>(size: number, fill: T): T[][] {
  return Array.from({ length: size }, () => new Array<T>(size).fill(fill));
}

// ── Direction helpers ─────────────────────────────────────────────────────

const DIR_DELTA: Record<Direction, [number, number]> = {
  n: [-1, 0],
  s: [1, 0],
  e: [0, 1],
  w: [0, -1],
};

const OPPOSITE: Record<Direction, Direction> = { n: 's', s: 'n', e: 'w', w: 'e' };
const ALL_DIRS: Direction[] = ['n', 's', 'e', 'w'];

const PERPS: Record<Direction, readonly [Direction, Direction]> = {
  n: ['e', 'w'],
  s: ['e', 'w'],
  e: ['n', 's'],
  w: ['n', 's'],
};

// Right-hand / left-hand turn helpers used by the patrol wall-follower.
const CW: Record<Direction, Direction> = { n: 'e', e: 's', s: 'w', w: 'n' };
const CCW: Record<Direction, Direction> = { n: 'w', w: 's', s: 'e', e: 'n' };

// ── Maze generation (recursive backtracker, iterative) ────────────────────

function generateMaze(size: number): WallCell[][] {
  const walls: WallCell[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ n: true, s: true, e: true, w: true }))
  );
  const visited = makeGrid(size, false);
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const nbrs: [Direction, number, number][] = [];
    for (const dir of ALL_DIRS) {
      const [dr, dc] = DIR_DELTA[dir];
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited[nr][nc]) {
        nbrs.push([dir, nr, nc]);
      }
    }
    if (nbrs.length === 0) {
      stack.pop();
    } else {
      const [dir, nr, nc] = nbrs[Math.floor(Math.random() * nbrs.length)];
      walls[r][c][dir] = false;
      walls[nr][nc][OPPOSITE[dir]] = false;
      visited[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }

  return walls;
}

// ── Mine placement ────────────────────────────────────────────────────────
// Targets dead-end cells (single exit only), excluding cells near the origin.

function placeMines(walls: WallCell[][], size: number, count: number): boolean[][] {
  const mines = makeGrid(size, false);
  const candidates: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (r + c < 3) continue; // skip near-origin cells
      const exits = ALL_DIRS.filter((d) => !walls[r][c][d]).length;
      if (exits === 1) candidates.push([r, c]);
    }
  }
  // Fisher-Yates shuffle then pick first N
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (let i = 0; i < Math.min(count, candidates.length); i++) {
    mines[candidates[i][0]][candidates[i][1]] = true;
  }
  return mines;
}

// ── Patrol: one-cell step via right-hand wall-follower ────────────────────
// Priority: turn right, go straight, turn left, reverse.

function stepPatrol(
  p: { row: number; col: number; dir: Direction },
  walls: WallCell[][]
): { row: number; col: number; dir: Direction } {
  const { row: r, col: c, dir } = p;
  for (const d of [CW[dir], dir, CCW[dir], OPPOSITE[dir]] as Direction[]) {
    if (!walls[r][c][d]) {
      const [dr, dc] = DIR_DELTA[d];
      return { row: r + dr, col: c + dc, dir: d };
    }
  }
  return p; // isolated cell — shouldn't occur in a spanning-tree maze
}

// ── Create a new game ─────────────────────────────────────────────────────

export function createGame(size: number): GameState {
  const walls = generateMaze(size);
  const now = Date.now();

  // Hazard-free bare state used only for par computation.
  const bare: GameState = {
    size,
    walls,
    painted: makeGrid(size, false),
    paintedAt: makeGrid<number | null>(size, null),
    playerRow: 0,
    playerCol: 0,
    moves: 0,
    won: size === 1,
    lost: false,
    lostReason: null,
    paintedCount: 1,
    par: 0,
    moveLimit: 99999,
    mines: makeGrid(size, false),
    fadeDuration: Infinity,
    timeLimit: 9999,
    deadline: Infinity,
    patrol: null,
    patrolOrigin: null,
  };
  bare.painted[0][0] = true;
  bare.paintedAt[0][0] = now;

  const par = solve(bare).length;

  const mineCount = size <= 8 ? 1 : size <= 12 ? 2 : 3;
  const mines = placeMines(walls, size, mineCount);

  const po = Math.min(Math.floor(size * 0.7), size - 1);
  const patrolOrigin = { row: po, col: po, dir: 'n' as Direction };

  const fadeDuration = size <= 8 ? 20_000 : size <= 12 ? 25_000 : 30_000;
  const timeLimit = size <= 8 ? 90 : size <= 12 ? 150 : 210;

  const painted = makeGrid(size, false);
  const paintedAt = makeGrid<number | null>(size, null);
  painted[0][0] = true;
  paintedAt[0][0] = now;

  return {
    size,
    walls,
    painted,
    paintedAt,
    playerRow: 0,
    playerCol: 0,
    moves: 0,
    won: size === 1,
    lost: false,
    lostReason: null,
    paintedCount: 1,
    par,
    moveLimit: Math.ceil(par * 2.2),
    mines,
    fadeDuration,
    timeLimit,
    deadline: Infinity, // timer starts when briefing is dismissed
    patrol: { ...patrolOrigin },
    patrolOrigin,
  };
}

// ── Reset (same maze, restart run) ────────────────────────────────────────
// forGhost: clears mines, patrol, and fade so the solver demo runs cleanly.

export function resetGame(state: GameState, forGhost = false): GameState {
  const now = Date.now();
  const painted = makeGrid(state.size, false);
  const paintedAt = makeGrid<number | null>(state.size, null);
  painted[0][0] = true;
  paintedAt[0][0] = now;

  return {
    ...state,
    painted,
    paintedAt,
    playerRow: 0,
    playerCol: 0,
    moves: 0,
    won: state.size === 1,
    lost: false,
    lostReason: null,
    paintedCount: 1,
    deadline: now + state.timeLimit * 1000,
    patrol: forGhost ? null : state.patrolOrigin ? { ...state.patrolOrigin } : null,
    mines: forGhost ? makeGrid(state.size, false) : state.mines,
    fadeDuration: forGhost ? Infinity : state.fadeDuration,
  };
}

// ── Slide the player ──────────────────────────────────────────────────────
// The player slides until:
//   (a) they hit a wall, OR
//   (b) they land on a cell with a perpendicular opening (a junction).
// Hazard checks: mines (instant death), patrol collision, move limit.
// paintedAt is refreshed on EVERY pass-through, not just first visit, so
// re-sliding over a cell resets its fade timer.

export function slide(state: GameState, dir: Direction): GameState {
  if (state.won || state.lost) return state;

  const { walls, size } = state;
  let r = state.playerRow;
  let c = state.playerCol;
  const [dr, dc] = DIR_DELTA[dir];
  const [p1, p2] = PERPS[dir];
  let moved = false;
  const now = Date.now();

  const newPainted = state.painted.map((row) => [...row]);
  const newPaintedAt = state.paintedAt.map((row) => [...row]);
  let paintedCount = state.paintedCount;

  while (!walls[r][c][dir]) {
    r += dr;
    c += dc;
    moved = true;

    if (!newPainted[r][c]) {
      newPainted[r][c] = true;
      paintedCount++;
    }
    newPaintedAt[r][c] = now; // refresh fade timer on every pass-through

    // Mine hit — stop and die
    if (state.mines[r][c]) {
      let patrol = state.patrol;
      if (patrol !== null) patrol = stepPatrol(patrol, walls);
      return {
        ...state,
        painted: newPainted,
        paintedAt: newPaintedAt,
        playerRow: r,
        playerCol: c,
        moves: state.moves + 1,
        paintedCount,
        patrol,
        lost: true,
        lostReason: 'mine',
      };
    }

    if (!walls[r][c][p1] || !walls[r][c][p2]) break;
  }

  if (!moved) return state;

  const newMoves = state.moves + 1;
  const won = paintedCount === size * size;

  // Advance patrol one step, then check collision with player's new position.
  let patrol = state.patrol;
  let lostToPatrol = false;
  if (patrol !== null && !won) {
    patrol = stepPatrol(patrol, walls);
    if (
      (patrol.row === r && patrol.col === c) || // patrol caught player
      (patrol.row === state.playerRow && patrol.col === state.playerCol) // paths crossed (swap)
    )
      lostToPatrol = true;
  }

  const lostToLimit = !won && !lostToPatrol && newMoves >= state.moveLimit;
  const lost = lostToPatrol || lostToLimit;
  const lostReason: GameState['lostReason'] = lostToPatrol
    ? 'patrol'
    : lostToLimit
      ? 'limit'
      : null;

  return {
    ...state,
    painted: newPainted,
    paintedAt: newPaintedAt,
    playerRow: r,
    playerCol: c,
    moves: newMoves,
    won,
    lost,
    lostReason,
    paintedCount,
    patrol,
  };
}

// ── Apply fade ────────────────────────────────────────────────────────────
// Returns a new state if any cells faded, null if nothing changed.
// Call periodically (e.g. every 500 ms) from the UI layer.

export function applyFade(state: GameState, now: number): GameState | null {
  // Skip if game is over, fade is disabled, or timer hasn't started (briefing shown).
  if (state.won || state.lost || !isFinite(state.fadeDuration) || !isFinite(state.deadline)) {
    return null;
  }

  let changed = false;
  const newPainted = state.painted.map((row) => [...row]);
  let paintedCount = state.paintedCount;

  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (r === 0 && c === 0) continue; // start cell never fades
      const at = state.paintedAt[r][c];
      if (state.painted[r][c] && at !== null && now - at > state.fadeDuration) {
        newPainted[r][c] = false;
        paintedCount--;
        changed = true;
      }
    }
  }

  return changed ? { ...state, painted: newPainted, paintedCount } : null;
}

// ── Star rating ───────────────────────────────────────────────────────────

export function getStars(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.5)) return 2;
  return 1;
}

// ── Canvas rendering ──────────────────────────────────────────────────────
// time: DOMHighResTimeStamp from requestAnimationFrame (animations)
// now:  Date.now() wall-clock (fade-age calculation); defaults to Date.now()

export function render(
  canvas: HTMLCanvasElement,
  state: GameState,
  time: number,
  isGhost = false,
  now = Date.now()
): void {
  const { size, walls, painted, paintedAt, playerRow, playerCol } = state;
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const cw = W / size;
  const ch = H / size;
  const ws = Math.max(2, Math.floor(Math.min(cw, ch) / 10));

  // Background doubles as the maze wall colour; red-tinted on loss.
  ctx.fillStyle = state.lost ? '#3a0000' : '#22c55e';
  ctx.fillRect(0, 0, W, H);

  const freshColor = isGhost ? '#0a1a2e' : '#0d2b15';
  const emptyColor = '#040e07';

  // ── Cell floors and corridors ───────────────────────────────────────────
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = Math.round(col * cw);
      const y = Math.round(row * ch);
      const x2 = Math.round((col + 1) * cw);
      const y2 = Math.round((row + 1) * ch);

      let floorColor = emptyColor;
      if (painted[row][col]) {
        const at = paintedAt[row][col];
        const fadeRatio =
          isFinite(state.fadeDuration) && !isFinite(state.deadline) === false && at !== null
            ? Math.min((now - at) / state.fadeDuration, 1)
            : 0;
        floorColor = fadeRatio < 0.65 ? freshColor : fadeRatio < 0.85 ? '#0e1e0c' : '#16190a'; // warm dim — about to vanish
      }

      ctx.fillStyle = floorColor;
      ctx.fillRect(x + ws, y + ws, x2 - x - 2 * ws, y2 - y - 2 * ws);

      // East corridor
      if (!walls[row][col].e && col + 1 < size) {
        ctx.fillStyle = painted[row][col] || painted[row][col + 1] ? freshColor : emptyColor;
        ctx.fillRect(x2 - ws, y + ws, 2 * ws, y2 - y - 2 * ws);
      }
      // South corridor
      if (!walls[row][col].s && row + 1 < size) {
        ctx.fillStyle = painted[row][col] || painted[row + 1][col] ? freshColor : emptyColor;
        ctx.fillRect(x + ws, y2 - ws, x2 - x - 2 * ws, 2 * ws);
      }
    }
  }

  // ── Mine markers (orange ×) ─────────────────────────────────────────────
  if (!isGhost) {
    const pad = Math.min(cw, ch) * 0.22;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = Math.max(1.5, Math.min(cw, ch) * 0.07);
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 8;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (state.mines[row][col]) {
          const x1 = col * cw + pad,
            y1 = row * ch + pad;
          const x2 = (col + 1) * cw - pad,
            y2 = (row + 1) * ch - pad;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.moveTo(x2, y1);
          ctx.lineTo(x1, y2);
          ctx.stroke();
        }
      }
    }
    ctx.shadowBlur = 0;
  }

  // ── Blinking IED dots on uncleared non-mine cells ───────────────────────
  const dotAlpha = 0.55 + 0.45 * Math.sin(time / 300);
  const dotRadius = Math.min(cw, ch) * 0.11;
  ctx.fillStyle = '#ef4444';
  ctx.globalAlpha = dotAlpha;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!painted[row][col] && !state.mines[row][col]) {
        ctx.beginPath();
        ctx.arc((col + 0.5) * cw, (row + 0.5) * ch, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // ── Patrol ball (orange, pulsing) ───────────────────────────────────────
  if (state.patrol && !isGhost) {
    const { row: pr, col: pc } = state.patrol;
    const px = (pc + 0.5) * cw;
    const py = (pr + 0.5) * ch;
    const pulse = 0.85 + 0.15 * Math.sin(time / 180);
    const pr2 = Math.min(cw, ch) * 0.2 * pulse;
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 12 * pulse;
    ctx.beginPath();
    ctx.arc(px, py, pr2, 0, Math.PI * 2);
    ctx.fillStyle = '#fb923c';
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ── Player / ghost ball ─────────────────────────────────────────────────
  const ballX = (playerCol + 0.5) * cw;
  const ballY = (playerRow + 0.5) * ch;
  const ballR = Math.min(cw, ch) * 0.22;
  const ballColor = isGhost ? '#93c5fd' : '#4ade80';
  const glowColor = isGhost ? '#60a5fa' : '#22c55e';

  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
  ctx.fillStyle = ballColor;
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── Loss tint ───────────────────────────────────────────────────────────
  if (state.lost) {
    ctx.fillStyle = 'rgba(160,0,0,0.22)';
    ctx.fillRect(0, 0, W, H);
  }
}

// ── Ghost solver ──────────────────────────────────────────────────────────
// Greedy: always pick the slide covering the most new cells.
// Fallback: BFS to navigate toward a position from which progress is possible.
// Pass a hazard-free state (resetGame with forGhost=true) so the solver is
// unaffected by mines or patrol.

export function solve(initialState: GameState): Direction[] {
  let state: GameState = {
    ...initialState,
    painted: initialState.painted.map((row) => [...row]),
  };

  const moves: Direction[] = [];
  const MAX = initialState.size * initialState.size * 8;

  while (!state.won && moves.length < MAX) {
    let bestDir: Direction | null = null;
    let bestGain = 0;

    for (const dir of ALL_DIRS) {
      const next = slide(state, dir);
      const gain = next.paintedCount - state.paintedCount;
      if (gain > bestGain) {
        bestGain = gain;
        bestDir = dir;
      }
    }

    if (bestDir !== null) {
      state = slide(state, bestDir);
      moves.push(bestDir);
    } else {
      const path = findPathToProgress(state);
      if (path.length === 0) break;
      for (const dir of path) {
        state = slide(state, dir);
        moves.push(dir);
      }
    }
  }

  return moves;
}

function findPathToProgress(state: GameState): Direction[] {
  type Item = { r: number; c: number; path: Direction[] };
  const start = `${state.playerRow},${state.playerCol}`;
  const visited = new Set<string>([start]);
  const queue: Item[] = [{ r: state.playerRow, c: state.playerCol, path: [] }];

  while (queue.length > 0) {
    const { r, c, path } = queue.shift()!;
    const testState = { ...state, playerRow: r, playerCol: c };

    for (const dir of ALL_DIRS) {
      if (slide(testState, dir).paintedCount > state.paintedCount) return path;
    }

    for (const dir of ALL_DIRS) {
      const next = slide(testState, dir);
      const key = `${next.playerRow},${next.playerCol}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ r: next.playerRow, c: next.playerCol, path: [...path, dir] });
      }
    }
  }

  return [];
}

// ── localStorage best-score helpers ──────────────────────────────────────

function bestKey(size: number): string {
  return `amaze-best-${size}`;
}

export function getBestScore(size: number): number | null {
  const v = localStorage.getItem(bestKey(size));
  return v ? Number(v) : null;
}

export function saveBestScore(size: number, moves: number): void {
  const prev = getBestScore(size);
  if (prev === null || moves < prev) {
    try {
      localStorage.setItem(bestKey(size), String(moves));
    } catch {
      /* storage full */
    }
  }
}
