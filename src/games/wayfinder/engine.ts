// ── Wayfinder engine (TSP puzzle) ─────────────────────────────────────
// Chart the shortest Hamiltonian circuit through all cities.
// n≤14: exact Held-Karp DP (O(n²·2^n))
// n>14: nearest-neighbour seed + 2-opt improvement (~5% of optimal)

export interface City { id: number; x: number; y: number }

export interface LBEntry { overshoot: number; date: string }

export interface GameState {
  width: number;
  height: number;
  phase: 'ready' | 'routing' | 'done' | 'failed';
  frameCount: number;
  cities: City[];
  route: number[];
  routeLength: number;
  optRoute: number[];
  optLength: number;
  fuelLimit: number;       // optLength * 1.20
  hoverCity: number;
  numCities: number;
  isExact: boolean;
  optAnim: number;
  briefingInstant: boolean; // skip the typewriter on ready screen
  missionFailed: boolean;
  leaderboard: LBEntry[];   // top scores for this numCities (loaded at game start)
  playerRank: number;       // 1-based rank of the just-saved score, -1 if not yet saved
}

export const MIN_CITIES  = 6;
export const MAX_CITIES  = 20;
const FUEL_FACTOR        = 1.20;  // 20 % buffer
const CITY_RADIUS        = 9;
const CLUSTER_RADIUS     = 52;
const MIN_CENTER_SEP     = 130;
const PADDING            = 44;
const ANIM_WAIT          = 50;
const ANIM_PER_SEG       = 20;

// ── Leaderboard (localStorage) ────────────────────────────────────────────

const lbKey = (n: number) => `wayfinder_lb_${n}`;

export function loadLeaderboard(n: number): LBEntry[] {
  try { return JSON.parse(localStorage.getItem(lbKey(n)) ?? '[]'); }
  catch { return []; }
}

function saveScore(n: number, overshoot: number): { board: LBEntry[]; rank: number } {
  const entry: LBEntry = { overshoot, date: new Date().toLocaleDateString() };
  const board = loadLeaderboard(n);
  board.push(entry);
  board.sort((a, b) => a.overshoot - b.overshoot);
  const top = board.slice(0, 10);
  try { localStorage.setItem(lbKey(n), JSON.stringify(top)); } catch { /* ignore */ }
  const rank = top.findIndex(e => e === entry) + 1;
  return { board: top, rank: rank > 0 ? rank : top.length };
}

// ── Public API ────────────────────────────────────────────────────────────

export function initGame(
  width: number, height: number,
  numCities = 8, briefingInstant = false,
): GameState {
  const cities    = generateCities(numCities, width, height);
  const { route: optRoute, exact: isExact } = solveTSP(cities);
  const optLength = tourLength(cities, optRoute);
  return {
    width, height,
    phase: 'ready',
    frameCount: briefingInstant ? 99999 : 0,
    cities, route: [], routeLength: 0,
    optRoute, optLength,
    fuelLimit: optLength * FUEL_FACTOR,
    hoverCity: -1,
    numCities, isExact,
    optAnim: 0,
    briefingInstant,
    missionFailed: false,
    leaderboard: loadLeaderboard(numCities),
    playerRank: -1,
  };
}

export function newGame(state: GameState, numCities?: number, briefingInstant?: boolean): GameState {
  const n        = numCities ?? state.numCities;
  const instant  = briefingInstant ?? state.briefingInstant;
  const cities   = generateCities(n, state.width, state.height);
  const { route: optRoute, exact: isExact } = solveTSP(cities);
  const optLength = tourLength(cities, optRoute);
  return {
    ...state,
    phase: 'routing',
    frameCount: 0,
    cities, route: [], routeLength: 0,
    optRoute, optLength,
    fuelLimit: optLength * FUEL_FACTOR,
    hoverCity: -1,
    numCities: n, isExact,
    optAnim: 0,
    briefingInstant: instant,
    missionFailed: false,
    leaderboard: loadLeaderboard(n),
    playerRank: -1,
  };
}

export function startRouting(state: GameState): GameState {
  return {
    ...state, phase: 'routing',
    route: [], routeLength: 0, hoverCity: -1, optAnim: 0,
    missionFailed: false, playerRank: -1,
  };
}

export function resetRoute(state: GameState): GameState {
  if (state.phase !== 'routing') return state;
  return { ...state, route: [], routeLength: 0, hoverCity: -1 };
}

export function undoMove(state: GameState): GameState {
  if (state.phase !== 'routing' || state.route.length === 0) return state;
  const route       = state.route.slice(0, -1);
  const routeLength = partialLength(state.cities, route);
  return { ...state, route, routeLength };
}

export function visitCity(state: GameState, cityId: number): GameState {
  if (state.phase !== 'routing') return state;
  if (state.route.includes(cityId)) return state;

  const route = [...state.route, cityId];
  let routeLength = state.routeLength;
  if (route.length > 1) {
    routeLength += cityDist(
      state.cities[route[route.length - 2]],
      state.cities[cityId],
    );
  }

  if (route.length === state.numCities) {
    // Close the loop
    routeLength += cityDist(state.cities[route[0]], state.cities[cityId]);
    const failed      = routeLength > state.fuelLimit;
    const overshoot   = Math.round(((routeLength - state.optLength) / state.optLength) * 100);
    const isSubOpt    = routeLength > state.optLength * 1.001;

    let leaderboard   = state.leaderboard;
    let playerRank    = -1;

    if (!failed) {
      const saved   = saveScore(state.numCities, overshoot);
      leaderboard   = saved.board;
      playerRank    = saved.rank;
    }

    return {
      ...state, route, routeLength,
      phase: failed ? 'failed' : 'done',
      hoverCity: -1,
      missionFailed: failed,
      optAnim: failed ? Infinity : (isSubOpt ? -ANIM_WAIT : Infinity),
      leaderboard,
      playerRank,
    };
  }

  return { ...state, route, routeLength, hoverCity: -1 };
}

export function setHoverCity(state: GameState, px: number, py: number): GameState {
  if (state.phase !== 'routing') return { ...state, hoverCity: -1 };
  let nearest = -1, minDist = CITY_RADIUS * 2.5;
  for (const city of state.cities) {
    if (state.route.includes(city.id)) continue;
    const d = Math.hypot(city.x - px, city.y - py);
    if (d < minDist) { minDist = d; nearest = city.id; }
  }
  return { ...state, hoverCity: nearest };
}

export function tick(state: GameState, _dt: number): GameState {
  const next = { ...state, frameCount: state.frameCount + 1 };
  if ((state.phase === 'done' || state.phase === 'failed') && state.optAnim < Infinity) {
    next.optAnim = state.optAnim + 1;
  }
  return next;
}

// ── City generation ───────────────────────────────────────────────────────

function generateCities(n: number, width: number, height: number): City[] {
  const numClusters = Math.max(2, Math.round(n / 3.5));
  const centers     = placeCenters(numClusters, width, height);
  if (centers.length < numClusters) return generateUniform(n, width, height);

  const cities: City[] = [];
  let attempts = 0;
  while (cities.length < n && attempts < 8000) {
    attempts++;
    const cx    = centers[cities.length % centers.length];
    const angle = Math.random() * Math.PI * 2;
    const r     = Math.random() * CLUSTER_RADIUS;
    const x     = Math.round(Math.max(PADDING, Math.min(width  - PADDING, cx.x + Math.cos(angle) * r)));
    const y     = Math.round(Math.max(PADDING, Math.min(height - PADDING, cx.y + Math.sin(angle) * r)));
    if (!cities.some(c => Math.hypot(c.x - x, c.y - y) < 22))
      cities.push({ id: cities.length, x, y });
  }
  return cities.length === n ? cities : generateUniform(n, width, height);
}

function placeCenters(k: number, w: number, h: number): { x: number; y: number }[] {
  const centers: { x: number; y: number }[] = [];
  let attempts = 0;
  while (centers.length < k && attempts < 3000) {
    attempts++;
    const x = PADDING + CLUSTER_RADIUS + Math.random() * (w - PADDING * 2 - CLUSTER_RADIUS * 2);
    const y = PADDING + CLUSTER_RADIUS + Math.random() * (h - PADDING * 2 - CLUSTER_RADIUS * 2);
    if (!centers.some(c => Math.hypot(c.x - x, c.y - y) < MIN_CENTER_SEP))
      centers.push({ x, y });
  }
  return centers;
}

function generateUniform(n: number, w: number, h: number): City[] {
  const cities: City[] = [];
  let attempts = 0;
  while (cities.length < n && attempts < 5000) {
    attempts++;
    const x = Math.round(PADDING + Math.random() * (w - PADDING * 2));
    const y = Math.round(PADDING + Math.random() * (h - PADDING * 2));
    if (!cities.some(c => Math.hypot(c.x - x, c.y - y) < 40))
      cities.push({ id: cities.length, x, y });
  }
  return cities;
}

// ── TSP solvers ───────────────────────────────────────────────────────────

function solveTSP(cities: City[]): { route: number[]; exact: boolean } {
  return cities.length <= 14
    ? { route: heldKarp(cities), exact: true }
    : { route: nnTwoOpt(cities), exact: false };
}

function heldKarp(cities: City[]): number[] {
  const n = cities.length, INF = Infinity;
  const dist = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => cityDist(cities[i], cities[j])));
  const size = 1 << n;
  const dp   = Array.from({ length: size }, () => Array<number>(n).fill(INF));
  const par  = Array.from({ length: size }, () => Array<number>(n).fill(-1));
  dp[1][0] = 0;
  for (let mask = 1; mask < size; mask++) {
    for (let u = 0; u < n; u++) {
      if (!(mask & (1 << u)) || dp[mask][u] === INF) continue;
      for (let v = 0; v < n; v++) {
        if (mask & (1 << v)) continue;
        const nm = mask | (1 << v), cost = dp[mask][u] + dist[u][v];
        if (cost < dp[nm][v]) { dp[nm][v] = cost; par[nm][v] = u; }
      }
    }
  }
  const full = size - 1;
  let minCost = INF, last = 1;
  for (let u = 1; u < n; u++) {
    const cost = dp[full][u] + dist[u][0];
    if (cost < minCost) { minCost = cost; last = u; }
  }
  const route: number[] = [];
  let mask = full, curr = last;
  while (curr !== -1) { route.push(curr); const prev = par[mask][curr]; mask ^= (1 << curr); curr = prev; }
  return route.reverse();
}

function nnTwoOpt(cities: City[]): number[] {
  const n = cities.length;
  const dist = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => cityDist(cities[i], cities[j])));
  let best: number[] = [], bestLen = Infinity;
  for (let start = 0; start < Math.min(n, 8); start++) {
    const vis = new Uint8Array(n), route = [start]; vis[start] = 1;
    for (let step = 1; step < n; step++) {
      const last = route[route.length - 1];
      let nd = Infinity, nn = -1;
      for (let j = 0; j < n; j++) if (!vis[j] && dist[last][j] < nd) { nd = dist[last][j]; nn = j; }
      route.push(nn); vis[nn] = 1;
    }
    const len = tourLength(cities, route);
    if (len < bestLen) { bestLen = len; best = route; }
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const [a, b, c, d] = [best[i], best[i+1], best[j], best[(j+1)%n]];
        if (dist[a][c] + dist[b][d] < dist[a][b] + dist[c][d] - 0.001) {
          best = [...best.slice(0,i+1), ...best.slice(i+1,j+1).reverse(), ...best.slice(j+1)];
          improved = true;
        }
      }
    }
  }
  return best;
}

function tourLength(cities: City[], route: number[]): number {
  if (route.length < 2) return 0;
  let len = 0;
  for (let i = 0; i < route.length; i++)
    len += cityDist(cities[route[i]], cities[route[(i+1) % route.length]]);
  return len;
}

function partialLength(cities: City[], route: number[]): number {
  if (route.length < 2) return 0;
  let len = 0;
  for (let i = 0; i < route.length - 1; i++)
    len += cityDist(cities[route[i]], cities[route[i+1]]);
  return len;
}

function cityDist(a: City, b: City): number { return Math.hypot(a.x - b.x, a.y - b.y); }

// ── Canvas rendering ──────────────────────────────────────────────────────

const BG_COLOR    = '#0a0a1a';
const CITY_COLOR  = '#22c55e';
const CITY_VIS    = '#166534';
const CITY_HOVER  = '#4ade80';
const CITY_START  = '#f59e0b';
const ROUTE_COLOR = '#22c55e';
const ROUTE_DIM   = 'rgba(34,197,94,0.35)';
const OPT_COLOR   = '#22d3ee';
const OPT_DIM     = 'rgba(34,211,238,0.55)';
const TEXT_DIM    = '#64748b';
const WIN_GLOW    = '#22c55e';
const RED_BRIGHT  = '#ff4444';
const RED_DIM     = '#cc2222';
const RED_GLOW    = '#ff000088';
const GRID_COLOR  = 'rgba(34,197,94,0.06)';
const GRID_TEXT   = 'rgba(34,197,94,0.45)';

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, width, height, state.frameCount);

  if (state.phase === 'ready') {
    drawCities(ctx, state);
    drawReadyOverlay(ctx, state);
    return;
  }

  if (state.phase === 'routing') {
    drawPreviewLine(ctx, state);
    drawRoutingLines(ctx, state);
    drawCities(ctx, state);
    drawRoutingHud(ctx, state);
    return;
  }

  if (state.phase === 'failed') {
    drawDoneRoute(ctx, state, 0.35);
    drawCities(ctx, state);
    drawFailedOverlay(ctx, state);
    return;
  }

  // Done
  const totalAnim   = state.numCities * ANIM_PER_SEG;
  const animRunning = state.optAnim >= 0 && state.optAnim < totalAnim;
  const animWaiting = state.optAnim < 0;

  drawDoneRoute(ctx, state, animRunning || animWaiting ? 0.4 : 1);
  drawCities(ctx, state);

  if (animWaiting)   { drawAnalysingLabel(ctx, state, false); return; }
  if (animRunning)   { drawOptRouteAnimated(ctx, state); drawAnalysingLabel(ctx, state, true); return; }

  drawOptRoute(ctx, state);
  drawDoneOverlay(ctx, state);
}

// ── Grid ──────────────────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, _frame: number): void {
  const step = 60;
  const cols  = 'ABCDEFGHIJKLMNOPQRSTUVWX';
  ctx.font      = `11px 'Share Tech Mono', monospace`;
  ctx.fillStyle = GRID_TEXT;

  // Vertical lines — labelled A, B, C… at top
  let col = 0;
  for (let x = step; x < w; x += step) {
    ctx.strokeStyle = GRID_COLOR; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.fillStyle = GRID_TEXT; ctx.textAlign = 'center';
    ctx.fillText(cols[col] ?? '', x, 11);
    col++;
  }

  // Horizontal lines — labelled 1, 2, 3… on both sides
  let row = 1;
  for (let y = step; y < h; y += step) {
    ctx.strokeStyle = GRID_COLOR; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillStyle = GRID_TEXT;
    ctx.textAlign = 'left';  ctx.fillText(String(row), 2, y - 2);
    ctx.textAlign = 'right'; ctx.fillText(String(row), w - 2, y - 2);
    row++;
  }
}

// ── Cities ────────────────────────────────────────────────────────────────

function drawCities(ctx: CanvasRenderingContext2D, state: GameState): void {
  const routing = state.phase === 'routing';
  for (const city of state.cities) {
    const isVisited = state.route.includes(city.id);
    const isHover   = state.hoverCity === city.id;
    const isFirst   = state.route[0] === city.id;
    const isStart   = state.route.length === 0 || (routing && isFirst && !isVisited);

    const r = isHover ? CITY_RADIUS + 3 : CITY_RADIUS;

    let fill = CITY_COLOR;
    if (isStart && routing)  fill = CITY_START;
    else if (isHover)        fill = CITY_HOVER;
    else if (isVisited)      fill = CITY_VIS;

    ctx.shadowColor = isStart && routing ? CITY_START : fill;
    ctx.shadowBlur  = isHover ? 12 : (isVisited ? 0 : 6);
    ctx.beginPath();
    ctx.arc(city.x, city.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Small dot center marker (replaces number label)
    ctx.beginPath();
    ctx.arc(city.x, city.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isVisited ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)';
    ctx.fill();
  }
}

// ── Routes ────────────────────────────────────────────────────────────────

function drawRoutingLines(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.route.length < 2) return;
  ctx.strokeStyle = ROUTE_COLOR; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(state.cities[state.route[0]].x, state.cities[state.route[0]].y);
  for (let i = 1; i < state.route.length; i++)
    ctx.lineTo(state.cities[state.route[i]].x, state.cities[state.route[i]].y);
  ctx.stroke();
}

function drawPreviewLine(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.route.length === 0 || state.hoverCity < 0) return;
  const last  = state.cities[state.route[state.route.length - 1]];
  const hover = state.cities[state.hoverCity];
  ctx.strokeStyle = ROUTE_DIM; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(hover.x, hover.y); ctx.stroke();
  ctx.setLineDash([]);
}

function drawDoneRoute(ctx: CanvasRenderingContext2D, state: GameState, alpha: number): void {
  if (state.route.length < 2) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.strokeStyle = ROUTE_COLOR; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(state.cities[state.route[0]].x, state.cities[state.route[0]].y);
  for (let i = 1; i < state.route.length; i++)
    ctx.lineTo(state.cities[state.route[i]].x, state.cities[state.route[i]].y);
  ctx.closePath(); ctx.stroke(); ctx.restore();
}

function drawOptRoute(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.optRoute.length < 2) return;
  ctx.strokeStyle = OPT_DIM; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
  ctx.lineJoin = 'round'; ctx.shadowColor = OPT_COLOR; ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(state.cities[state.optRoute[0]].x, state.cities[state.optRoute[0]].y);
  for (let i = 1; i < state.optRoute.length; i++)
    ctx.lineTo(state.cities[state.optRoute[i]].x, state.cities[state.optRoute[i]].y);
  ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
}

function drawOptRouteAnimated(ctx: CanvasRenderingContext2D, state: GameState): void {
  const route = [...state.optRoute, state.optRoute[0]];
  const seg   = Math.min(Math.floor(state.optAnim / ANIM_PER_SEG), route.length - 1);
  const t     = (state.optAnim % ANIM_PER_SEG) / ANIM_PER_SEG;
  if (seg === 0 && t === 0) return;

  ctx.strokeStyle = OPT_COLOR; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.shadowColor = OPT_COLOR; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(state.cities[route[0]].x, state.cities[route[0]].y);
  for (let i = 1; i <= seg && i < route.length; i++)
    ctx.lineTo(state.cities[route[i]].x, state.cities[route[i]].y);
  if (seg < route.length - 1 && t > 0) {
    const f = state.cities[route[seg]], to = state.cities[route[seg+1]];
    ctx.lineTo(f.x + (to.x - f.x) * t, f.y + (to.y - f.y) * t);
  }
  ctx.stroke(); ctx.shadowBlur = 0;

  if (seg < route.length - 1) {
    const f = state.cities[route[seg]], to = state.cities[route[Math.min(seg+1, route.length-1)]];
    ctx.beginPath();
    ctx.arc(f.x + (to.x - f.x) * t, f.y + (to.y - f.y) * t, 4, 0, Math.PI * 2);
    ctx.fillStyle = OPT_COLOR; ctx.shadowColor = OPT_COLOR; ctx.shadowBlur = 10;
    ctx.fill(); ctx.shadowBlur = 0;
  }
}

function drawAnalysingLabel(ctx: CanvasRenderingContext2D, state: GameState, active: boolean): void {
  const dots = active ? '.'.repeat(Math.floor(state.frameCount / 15) % 4) : '';
  ctx.font = `bold 14px 'Share Tech Mono', monospace`;
  ctx.fillStyle = active ? OPT_COLOR : TEXT_DIM;
  ctx.textAlign = 'center';
  ctx.shadowColor = active ? OPT_COLOR : 'transparent';
  ctx.shadowBlur  = active ? 6 : 0;
  ctx.fillText(`ANALYSING OPTIMAL ROUTE${dots}`, state.width / 2, state.height - 20);
  ctx.shadowBlur = 0;
}

// ── HUD ───────────────────────────────────────────────────────────────────

function drawRoutingHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  const used      = Math.round(state.routeLength);
  const limit     = Math.round(state.fuelLimit);
  const remaining = Math.max(0, limit - used);
  const pct       = Math.min(1, state.routeLength / state.fuelLimit);

  // Top row
  ctx.font = `12px 'Share Tech Mono', monospace`;
  ctx.textAlign = 'left';  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(`BASES: ${state.route.length}/${state.numCities}`, 12, 22);
  ctx.textAlign = 'right'; ctx.fillStyle = ROUTE_DIM;
  ctx.fillText('U=UNDO  R=RESET', width - 12, 22);

  // Fuel gauge area at bottom
  const gaugeY = height - 62;
  const barW   = width - 48, barH = 8;
  const barX   = 24;

  // Gauge label
  const fuelColor = pct > 0.9 ? '#ef4444' : pct > 0.75 ? '#f59e0b' : ROUTE_COLOR;
  ctx.font = `bold 22px 'Share Tech Mono', monospace`;
  ctx.textAlign   = 'center';
  ctx.fillStyle   = fuelColor;
  ctx.shadowColor = fuelColor; ctx.shadowBlur = 8;
  ctx.fillText(`${used} km`, width / 2, gaugeY);
  ctx.shadowBlur  = 0;

  // Fuel bar background
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, barX, gaugeY + 6, barW, barH, 3); ctx.fill();

  // Fuel bar fill
  const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  fillGrad.addColorStop(0,   '#22c55e');
  fillGrad.addColorStop(0.7, '#f59e0b');
  fillGrad.addColorStop(1,   '#ef4444');
  ctx.fillStyle = fillGrad;
  ctx.shadowColor = fuelColor; ctx.shadowBlur = 4;
  roundRect(ctx, barX, gaugeY + 6, barW * pct, barH, 3); ctx.fill();
  ctx.shadowBlur  = 0;

  // 20% limit tick mark
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(barX + barW, gaugeY + 4);
  ctx.lineTo(barX + barW, gaugeY + 6 + barH + 2);
  ctx.stroke();

  // Remaining / limit text
  ctx.font      = `11px 'Share Tech Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(`REMAINING: ${remaining} km`, barX, gaugeY + 24);
  ctx.textAlign = 'right';
  ctx.fillStyle = pct > 0.9 ? '#ef4444' : TEXT_DIM;
  ctx.fillText(`LIMIT: ${limit} km`, barX + barW, gaugeY + 24);
}

// ── Overlays ──────────────────────────────────────────────────────────────

const BRIEF_SPEED = 3;

// Static sections — fuel budget appended dynamically in draw
const BRIEF_STATIC = [
  { label: 'SITUATION:', body: 'YOUR TROOPS ARE RUNNING LOW ON SUPPLIES AND YOU ARE RUNNING LOW ON FUEL.' },
  { label: 'YOUR MISSION:', body: "PLOT THE SHORTEST ROUTE TO DELIVER SUPPLIES TO ALL YOUR TROOPS, WHILE CONSERVING AS MUCH FUEL AS POSSIBLE. WE'RE COUNTING ON YOU! GOOD LUCK!" },
];

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' '), lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawReadyOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  ctx.fillStyle = 'rgba(6,4,10,0.88)';
  ctx.fillRect(0, 0, width, height);

  const cx   = width / 2;
  const pad  = 24;
  const maxW = width - pad * 2;
  const bodyFont = `15px 'Share Tech Mono', monospace`;

  // Header
  ctx.textAlign   = 'center';
  ctx.font        = `bold 13px 'Share Tech Mono', monospace`;
  ctx.fillStyle   = RED_BRIGHT;
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 18;
  ctx.fillText('◄ MISSION BRIEFING ►', cx, 30);
  ctx.shadowBlur  = 8; ctx.fillText('◄ MISSION BRIEFING ►', cx, 30);
  ctx.shadowBlur  = 0;

  ctx.strokeStyle = RED_DIM; ctx.lineWidth = 1;
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(pad, 38); ctx.lineTo(width - pad, 38); ctx.stroke();
  ctx.shadowBlur  = 0;

  // Build lines including dynamic fuel budget section
  ctx.font = bodyFont;
  type BLine = { text: string; isLabel: boolean };
  const sections = [
    ...BRIEF_STATIC,
    { label: 'FUEL BUDGET:', body: `${Math.round(state.fuelLimit)} KM — DO NOT EXCEED.` },
  ];
  const allLines: BLine[] = [];
  for (let s = 0; s < sections.length; s++) {
    if (s > 0) allLines.push({ text: '', isLabel: false });
    allLines.push({ text: sections[s].label, isLabel: true });
    for (const l of wrapText(ctx, sections[s].body, maxW))
      allLines.push({ text: l, isLabel: false });
  }

  const totalChars = allLines.reduce((a, l) => a + (l.text.length || 1), 0);
  const revealed   = state.briefingInstant
    ? totalChars
    : Math.min(totalChars, state.frameCount * BRIEF_SPEED);

  const lineH = 21;
  let charsLeft = revealed, y = 52;
  let cursorX = pad, cursorY = 52;

  for (const line of allLines) {
    if (y > height - 90) break;
    const chars = line.text.length || 1;
    const show  = Math.min(chars, charsLeft);
    charsLeft  -= show;
    if (show <= 0) break;

    const txt = line.text.slice(0, show);

    if (line.isLabel) {
      ctx.font      = `bold 13px 'Share Tech Mono', monospace`;
      ctx.fillStyle = RED_BRIGHT;
      ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 10;
      ctx.textAlign = 'left'; ctx.fillText(txt, pad, y);
      ctx.shadowBlur = 0;
      cursorX = pad + ctx.measureText(txt).width + 2;
    } else if (line.text !== '') {
      ctx.font      = bodyFont;
      ctx.fillStyle = '#d0d0d0';
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left'; ctx.fillText(txt, pad, y);
      cursorX = pad + ctx.measureText(txt).width + 2;
    }
    cursorY = y;
    y += line.text === '' ? lineH * 0.55 : lineH;
  }

  // Blinking cursor
  if (revealed < totalChars && Math.floor(state.frameCount / 18) % 2 === 0) {
    ctx.fillStyle = RED_BRIGHT; ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 8;
    ctx.fillRect(cursorX, cursorY - 13, 9, 15); ctx.shadowBlur = 0;
  }

  // Personal best (show once briefing mostly done)
  if (revealed > totalChars * 0.85) {
    const lb = state.leaderboard;
    ctx.font      = `11px 'Share Tech Mono', monospace`;
    ctx.textAlign = 'center';
    if (lb.length === 0) {
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText('NO PREVIOUS ATTEMPTS', cx, height - 72);
    } else {
      ctx.fillStyle = lb[0].overshoot === 0 ? WIN_GLOW : '#cc4444';
      ctx.fillText(
        `PERSONAL BEST: ${lb[0].overshoot === 0 ? 'OPTIMAL' : `+${lb[0].overshoot}%`}  ·  ${lb.length} ATTEMPT${lb.length !== 1 ? 'S' : ''}`,
        cx, height - 72,
      );
    }
  }

  // LET'S GO button
  const bw = 160, bh = 44, bx = cx - 80, by = height - 60;
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = revealed >= totalChars ? 16 : 4;
  ctx.fillStyle   = '#3a0a0a';
  roundRect(ctx, bx, by, bw, bh, 6); ctx.fill();
  ctx.strokeStyle = revealed >= totalChars ? RED_BRIGHT : RED_DIM;
  ctx.lineWidth   = 1.5; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.font        = `bold 17px 'Share Tech Mono', monospace`;
  ctx.fillStyle   = revealed >= totalChars ? RED_BRIGHT : RED_DIM;
  ctx.textAlign   = 'center';
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = revealed >= totalChars ? 12 : 0;
  ctx.fillText("LET'S GO", cx, by + bh / 2 + 6); ctx.shadowBlur = 0;
}

function drawDoneOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  const playerLen = Math.round(state.routeLength);
  const optLen    = Math.round(state.optLength);
  const overshoot = Math.round(((playerLen - optLen) / optLen) * 100);
  const isOptimal = playerLen <= optLen * 1.001;
  const lb        = state.leaderboard;
  const lbRows    = Math.min(lb.length, 3);
  const optLabel  = state.isExact ? 'OPTIMAL' : 'BEST KNOWN';

  const pad    = 20;
  const panelW = Math.min(width - 32, 320);
  const panelX = (width - panelW) / 2;
  const innerW = panelW - pad * 2;

  // Content height: header(32) + divider(12) + lines(110) + leaderboard + buttons
  const lbH    = lb.length > 0 ? 20 + lbRows * 24 : 0;
  const panelH = 32 + 12 + 110 + lbH + 10 + 36 + 10 + 36 + 16;
  const panelY = Math.max(8, height / 2 - panelH / 2 - 10);

  // Panel background
  ctx.fillStyle = 'rgba(6,4,10,0.92)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 6); ctx.fill();
  ctx.strokeStyle = RED_DIM; ctx.lineWidth = 1.5;
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;

  // Header — same as mission briefing
  ctx.textAlign   = 'center';
  ctx.font        = `bold 19px 'Share Tech Mono', monospace`;
  ctx.fillStyle   = RED_BRIGHT;
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 14;
  const headerText = isOptimal ? '◄ OPTIMAL ROUTE ►' : '◄ MISSION COMPLETE ►';
  ctx.fillText(headerText, width / 2, panelY + 24);
  ctx.shadowBlur  = 6; ctx.fillText(headerText, width / 2, panelY + 24);
  ctx.shadowBlur  = 0;

  // Divider
  ctx.strokeStyle = RED_DIM; ctx.lineWidth = 1;
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(panelX + pad, panelY + 34);
  ctx.lineTo(panelX + panelW - pad, panelY + 34);
  ctx.stroke(); ctx.shadowBlur = 0;

  // Fuel used — large
  let y = panelY + 70;
  ctx.font      = `bold 39px 'Share Tech Mono', monospace`;
  ctx.fillStyle = ROUTE_COLOR; ctx.shadowColor = ROUTE_COLOR; ctx.shadowBlur = 6;
  ctx.fillText(`${playerLen} km`, width / 2, y); ctx.shadowBlur = 0;

  // Optimal comparison
  y += 30;
  ctx.font      = `18px 'Share Tech Mono', monospace`;
  ctx.fillStyle = RED_DIM;
  ctx.fillText(`${optLabel}: ${optLen} km`, width / 2, y);

  // Overshoot / efficiency
  y += 26;
  ctx.font      = `19px 'Share Tech Mono', monospace`;
  ctx.fillStyle = isOptimal ? WIN_GLOW : (overshoot <= 10 ? '#cc4444' : '#993333');
  ctx.fillText(
    isOptimal ? 'PERFECT EFFICIENCY' : `+${overshoot}% OVER ${optLabel}`,
    width / 2, y,
  );

  // Rank
  if (state.playerRank > 0) {
    y += 24;
    const rc = state.playerRank === 1 ? RED_BRIGHT : state.playerRank <= 3 ? '#cc4444' : '#7a2222';
    ctx.font      = `18px 'Share Tech Mono', monospace`;
    ctx.fillStyle = rc;
    ctx.fillText(`RANK #${state.playerRank} OF ${lb.length} ATTEMPTS`, width / 2, y);
  }

  // Leaderboard
  if (lb.length > 0) {
    y += 14;
    ctx.strokeStyle = 'rgba(255,68,68,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(panelX + pad, y); ctx.lineTo(panelX + panelW - pad, y); ctx.stroke();
    for (let i = 0; i < lbRows; i++) {
      const entry = lb[i];
      y += 24;
      const isMe    = state.playerRank === i + 1;
      ctx.font      = `15px 'Share Tech Mono', monospace`;
      ctx.fillStyle = isMe ? RED_BRIGHT : (i === 0 ? '#cc4444' : '#7a2222');
      ctx.textAlign = 'left';
      ctx.fillText(`#${i+1}  ${entry.overshoot === 0 ? 'OPTIMAL' : `+${entry.overshoot}%`}`, panelX + pad, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = isMe ? RED_BRIGHT : '#5a1515';
      ctx.fillText(isMe ? '◄ YOU' : entry.date, panelX + panelW - pad, y);
    }
  }

  // Buttons — full-width, stacked, red
  const btnH  = 36, btnGap = 8;
  const btnX  = panelX + pad;
  const btnW  = innerW;
  const btn1Y = panelY + panelH - btnH * 2 - btnGap - 12;
  const btn2Y = btn1Y + btnH + btnGap;

  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 6;
  ctx.fillStyle   = '#3a0a0a';
  roundRect(ctx, btnX, btn1Y, btnW, btnH, 4); ctx.fill();
  ctx.strokeStyle = RED_BRIGHT; ctx.lineWidth = 1; ctx.stroke();
  ctx.shadowBlur  = 0;
  ctx.font        = `bold 18px 'Share Tech Mono', monospace`;
  ctx.fillStyle   = RED_BRIGHT; ctx.textAlign = 'center';
  ctx.fillText('TRY AGAIN', btnX + btnW / 2, btn1Y + btnH / 2 + 6);

  ctx.fillStyle   = '#0a1a0a';
  roundRect(ctx, btnX, btn2Y, btnW, btnH, 4); ctx.fill();
  ctx.strokeStyle = WIN_GLOW; ctx.lineWidth = 1; ctx.stroke();
  ctx.font        = `bold 18px 'Share Tech Mono', monospace`;
  ctx.fillStyle   = WIN_GLOW;
  ctx.fillText('NEW MAP', btnX + btnW / 2, btn2Y + btnH / 2 + 6);
}

function drawFailedOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  const panelW = Math.min(width - 32, 280), panelH = 130;
  const panelX = (width - panelW) / 2, panelY = height / 2 - panelH / 2 - 20;

  const pad   = 20;
  const inner = panelW - pad * 2;
  const used  = Math.round(state.routeLength);
  const limit = Math.round(state.fuelLimit);
  const over  = Math.round(((used - limit) / limit) * 100);

  ctx.fillStyle = 'rgba(6,4,10,0.92)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 6); ctx.fill();
  ctx.strokeStyle = RED_DIM; ctx.lineWidth = 1.5;
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;

  // Header
  ctx.textAlign   = 'center';
  ctx.font        = `bold 13px 'Share Tech Mono', monospace`;
  ctx.fillStyle   = RED_BRIGHT;
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 14;
  ctx.fillText('◄ MISSION FAILED ►', width / 2, panelY + 20);
  ctx.shadowBlur  = 6; ctx.fillText('◄ MISSION FAILED ►', width / 2, panelY + 20);
  ctx.shadowBlur  = 0;

  // Divider
  ctx.strokeStyle = RED_DIM; ctx.lineWidth = 1;
  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(panelX + pad, panelY + 28); ctx.lineTo(panelX + panelW - pad, panelY + 28);
  ctx.stroke(); ctx.shadowBlur = 0;

  ctx.font      = `13px 'Share Tech Mono', monospace`;
  ctx.fillStyle = '#fca5a5';
  ctx.fillText('FUEL BUDGET EXCEEDED', width / 2, panelY + 50);

  ctx.font      = `bold 24px 'Share Tech Mono', monospace`;
  ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
  ctx.fillText(`${used} km`, width / 2, panelY + 80); ctx.shadowBlur = 0;

  ctx.font      = `12px 'Share Tech Mono', monospace`;
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(`BUDGET: ${limit} km  ·  +${over}% OVER LIMIT`, width / 2, panelY + 100);

  // Buttons — full-width stacked
  const btnH = 36, btnGap = 8;
  const btnX = panelX + pad, btnW = inner;
  const btn1Y = panelY + panelH - btnH * 2 - btnGap - 12;
  const btn2Y = btn1Y + btnH + btnGap;

  ctx.shadowColor = RED_GLOW; ctx.shadowBlur = 6;
  ctx.fillStyle   = '#3a0a0a';
  roundRect(ctx, btnX, btn1Y, btnW, btnH, 4); ctx.fill();
  ctx.strokeStyle = RED_BRIGHT; ctx.lineWidth = 1; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.font        = `bold 12px 'Share Tech Mono', monospace`;
  ctx.fillStyle   = RED_BRIGHT; ctx.textAlign = 'center';
  ctx.fillText('TRY AGAIN', btnX + btnW / 2, btn1Y + btnH / 2 + 4);

  ctx.fillStyle   = '#0a1a0a';
  roundRect(ctx, btnX, btn2Y, btnW, btnH, 4); ctx.fill();
  ctx.strokeStyle = WIN_GLOW; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle   = WIN_GLOW;
  ctx.fillText('NEW MAP', btnX + btnW / 2, btn2Y + btnH / 2 + 4);
}

// ── Helpers ───────────────────────────────────────────────────────────────

// eslint-disable-next-line max-params
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Hit detection ─────────────────────────────────────────────────────────

export function cityAtPoint(state: GameState, px: number, py: number): number {
  for (const city of state.cities) {
    if (state.route.includes(city.id)) continue;
    if (Math.hypot(city.x - px, city.y - py) <= CITY_RADIUS * 2) return city.id;
  }
  return -1;
}

export function doneButtonAtPoint(state: GameState, px: number, py: number): 'retry' | 'new' | null {
  if (state.phase !== 'done' && state.phase !== 'failed') return null;
  const totalAnim = state.numCities * ANIM_PER_SEG;
  if (state.phase === 'done' && state.optAnim >= 0 && state.optAnim < totalAnim) return null;

  const { width, height } = state;
  const lb     = state.leaderboard;
  const lbRows = state.phase === 'done' ? Math.min(lb.length, 3) : 0;
  const panelH = state.phase === 'done'
    ? 32 + 12 + 110 + (lb.length > 0 ? 20 + lbRows * 24 : 0) + 10 + 36 + 10 + 36 + 16
    : 32 + 12 + 110 + 10 + 36 + 10 + 36 + 16;
  const panelW = Math.min(width - 32, 320);
  const panelX = (width - panelW) / 2;
  const panelY = Math.max(8, height / 2 - panelH / 2 - 10);
  const pad    = 20, btnH = 36, btnGap = 8;
  const btnX   = panelX + pad, btnW = panelW - pad * 2;
  const btn1Y  = panelY + panelH - btnH * 2 - btnGap - 12;
  const btn2Y  = btn1Y + btnH + btnGap;

  if (px >= btnX && px <= btnX + btnW) {
    if (py >= btn1Y && py <= btn1Y + btnH) return 'retry';
    if (py >= btn2Y && py <= btn2Y + btnH) return 'new';
  }
  return null;
}
