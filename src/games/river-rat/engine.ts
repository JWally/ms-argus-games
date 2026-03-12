// ── River Rat game engine ────────────────────────────────────────────
// A cute mouse in an inner tube floats DOWNSTREAM, dodging obstacles.

// ── Types ────────────────────────────────────────────────────────────

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'log' | 'rock' | 'duck' | 'lily' | 'fish';
  bumped: boolean; // hit while star-powered — makes ducks angry
}

interface Collectible {
  x: number;
  y: number;
  type: 'cheese' | 'star';
  collected: boolean;
}

interface Splash {
  x: number;
  y: number;
  life: number;
}

export interface GameState {
  width: number;
  height: number;
  ratX: number;
  ratY: number;
  scroll: number;
  scrollSpeed: number;
  obstacles: Obstacle[];
  collectibles: Collectible[];
  splashes: Splash[];
  bankSeed: number; // seed offset for smooth bank curves
  score: number;
  health: number; // 0-100
  phase: 'ready' | 'playing' | 'dead' | 'game-over';
  frameCount: number;
  starPower: number; // frames of star invincibility remaining
  distance: number;
}

// ── Constants ────────────────────────────────────────────────────────

const RAT_SIZE = 22;
const MAX_HEALTH = 100;
const OBSTACLE_TYPES: Obstacle['type'][] = ['log', 'rock', 'duck', 'lily', 'fish'];

// ── Difficulty scaling ──────────────────────────────────────────────

function getScrollSpeed(distance: number): number {
  return 1.5 + Math.min(distance / 800, 2.0);
}

function getSpawnRate(distance: number): number {
  return Math.max(40, 90 - Math.floor(distance / 200) * 5);
}

function getRiverWidth(width: number, distance: number): number {
  const base = width * 0.72;
  const narrow = Math.min(distance / 2000, 0.2) * width;
  return Math.max(base - narrow, width * 0.45);
}

// ── Smooth bank edges ───────────────────────────────────────────────
// Returns the left-bank-right-edge and right-bank-left-edge at a given y

function getBankEdges(
  width: number,
  distance: number,
  y: number,
  scroll: number
): { left: number; right: number } {
  const riverW = getRiverWidth(width, distance);
  const bankW = (width - riverW) / 2;
  // Gentle S-curves, not per-row wobble
  const t = (y + scroll) * 0.003;
  const wobble = Math.sin(t) * 12 + Math.sin(t * 2.3) * 6;
  return {
    left: bankW + wobble,
    right: width - bankW + wobble,
  };
}

// ── Init ─────────────────────────────────────────────────────────────

export function initGame(width: number, height: number): GameState {
  return {
    width,
    height,
    ratX: width / 2,
    ratY: height * 0.3, // near top — going downstream
    scroll: 0,
    scrollSpeed: 1.5,
    obstacles: [],
    collectibles: [],
    splashes: [],
    bankSeed: 0,
    score: 0,
    health: MAX_HEALTH,
    phase: 'ready',
    frameCount: 0,
    starPower: 0,
    distance: 0,
  };
}

// ── Move rat ─────────────────────────────────────────────────────────

export function moveRat(state: GameState, x: number): GameState {
  if (state.phase !== 'playing' && state.phase !== 'ready') return state;
  const clamped = Math.max(RAT_SIZE, Math.min(state.width - RAT_SIZE, x));
  return { ...state, ratX: clamped };
}

// ── Start ────────────────────────────────────────────────────────────

export function startPlaying(state: GameState): GameState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'playing' };
}

// ── Spawn helpers ───────────────────────────────────────────────────

function spawnObstacle(state: GameState): Obstacle | null {
  const edges = getBankEdges(state.width, state.distance, state.height, state.scroll);
  const riverLeft = edges.left + 10;
  const riverRight = edges.right - 10;
  const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];

  const sizes: Record<Obstacle['type'], { w: number; h: number }> = {
    log: { w: 60 + Math.random() * 40, h: 14 },
    rock: { w: 28 + Math.random() * 16, h: 24 + Math.random() * 12 },
    duck: { w: 22, h: 20 },
    lily: { w: 30, h: 28 },
    fish: { w: 26, h: 16 },
  };

  const size = sizes[type];
  const x = riverLeft + Math.random() * (riverRight - riverLeft - size.w);

  // Spawn BELOW screen (ahead/downstream)
  return { x, y: state.height + size.h + 10, w: size.w, h: size.h, type, bumped: false };
}

function spawnCollectible(state: GameState): Collectible | null {
  const edges = getBankEdges(state.width, state.distance, state.height, state.scroll);
  const riverLeft = edges.left + 20;
  const riverRight = edges.right - 20;
  const type = Math.random() < 0.75 ? 'cheese' : 'star';
  const x = riverLeft + Math.random() * (riverRight - riverLeft);

  // Spawn below screen
  return { x, y: state.height + 15, type, collected: false };
}

// ── Collision ────────────────────────────────────────────────────────

interface Circle {
  cx: number;
  cy: number;
  r: number;
}
interface RectBounds {
  rx: number;
  ry: number;
  rw: number;
  rh: number;
}

function circleRect(c: Circle, rect: RectBounds): boolean {
  const nearX = Math.max(rect.rx, Math.min(c.cx, rect.rx + rect.rw));
  const nearY = Math.max(rect.ry, Math.min(c.cy, rect.ry + rect.rh));
  const dx = c.cx - nearX;
  const dy = c.cy - nearY;
  return dx * dx + dy * dy < c.r * c.r;
}

// ── Tick helpers ────────────────────────────────────────────────────

function collectItems(ratX: number, ratY: number, items: Collectible[]) {
  let healAmount = 0;
  let score = 0;
  let grantStar = false;
  const splashes: Splash[] = [];
  let collectibles = items;
  const range = (RAT_SIZE + 10) * (RAT_SIZE + 10);

  for (let i = 0; i < collectibles.length; i++) {
    const c = collectibles[i];
    if (c.collected) continue;
    const dx = ratX - c.x;
    const dy = ratY - c.y;
    if (dx * dx + dy * dy >= range) continue;

    collectibles = collectibles === items ? [...items] : collectibles;
    collectibles[i] = { ...c, collected: true };
    if (c.type === 'cheese') {
      healAmount += 20;
      score += 5;
    } else {
      grantStar = true;
      score += 10;
      splashes.push({ x: c.x, y: c.y, life: 1 });
    }
  }

  return { collectibles, score, healAmount, grantStar, splashes };
}

interface BankCheckInput {
  ratX: number;
  ratY: number;
  width: number;
  distance: number;
  scroll: number;
  starPower: number;
}

function checkBankCollision(p: BankCheckInput): boolean {
  if (p.starPower > 0) return false;
  const edges = getBankEdges(p.width, p.distance, p.ratY, p.scroll);
  return p.ratX - RAT_SIZE < edges.left || p.ratX + RAT_SIZE > edges.right;
}

interface ObsCollisionResult {
  hit: boolean;
  obstacles: Obstacle[];
  score: number;
  splashes: Splash[];
}

function checkObstacleCollisions(
  ratX: number,
  ratY: number,
  obstacles: Obstacle[],
  starPower: number
): ObsCollisionResult {
  const rat: Circle = { cx: ratX, cy: ratY, r: RAT_SIZE * 0.8 };
  let score = 0;
  const splashes: Splash[] = [];
  let result = obstacles;

  for (let i = 0; i < result.length; i++) {
    const o = result[i];
    if (!circleRect(rat, { rx: o.x, ry: o.y, rw: o.w, rh: o.h })) continue;

    if (starPower > 0) {
      // Star power — smash through! Mark as bumped for angry face
      result = result === obstacles ? [...obstacles] : result;
      result[i] = { ...o, bumped: true };
      score += 15;
      splashes.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, life: 1 });
      continue;
    }

    // Normal hit
    return { hit: true, obstacles: result, score, splashes };
  }

  return { hit: false, obstacles: result, score, splashes };
}

// ── Tick ─────────────────────────────────────────────────────────────

export function tick(state: GameState, dt: number): GameState {
  if (state.phase !== 'playing') return state;

  const frameCount = state.frameCount + dt;
  const distance = state.distance + state.scrollSpeed * dt;
  const scrollSpeed = getScrollSpeed(distance);
  const scroll = state.scroll + scrollSpeed * dt;
  const starPower = Math.max(0, state.starPower - dt);

  // Move obstacles UP (toward rat — rat is going downstream)
  let obstacles = state.obstacles
    .map((o) => ({ ...o, y: o.y - scrollSpeed * dt }))
    .filter((o) => o.y + o.h > -50 && !o.bumped);

  // Move collectibles up
  let collectibles = state.collectibles
    .map((c) => ({ ...c, y: c.y - scrollSpeed * dt }))
    .filter((c) => c.y > -50 && !c.collected);

  // Update splashes
  const splashes = state.splashes
    .map((s) => ({ ...s, life: s.life - 0.04 * dt }))
    .filter((s) => s.life > 0);

  // Spawn obstacles from bottom
  const spawnRate = getSpawnRate(distance);
  if (frameCount % spawnRate < dt) {
    const obs = spawnObstacle({ ...state, distance, scroll });
    if (obs) obstacles = [...obstacles, obs];
  }

  // Spawn collectibles
  if (frameCount % 120 < dt && Math.random() < 0.4) {
    const col = spawnCollectible({ ...state, distance, scroll });
    if (col) collectibles = [...collectibles, col];
  }

  let score = state.score;
  let health = state.health;
  let newStarPower = starPower;
  const newSplashes = [...splashes];

  // Score every 50 distance
  const prevDist50 = Math.floor(state.distance / 50);
  const currDist50 = Math.floor(distance / 50);
  if (currDist50 > prevDist50) score += currDist50 - prevDist50;

  // Collect items
  const collected = collectItems(state.ratX, state.ratY, collectibles);
  collectibles = collected.collectibles;
  score += collected.score;
  health = Math.min(MAX_HEALTH, health + collected.healAmount);
  if (collected.grantStar) newStarPower = 300; // ~5 seconds at 60fps
  newSplashes.push(...collected.splashes);

  // Check bank collision
  if (
    checkBankCollision({
      ratX: state.ratX,
      ratY: state.ratY,
      width: state.width,
      distance,
      scroll,
      starPower: newStarPower,
    })
  ) {
    health -= 20;
    newSplashes.push({ x: state.ratX, y: state.ratY, life: 1 });
    if (health <= 0) {
      return {
        ...state,
        health: 0,
        phase: 'game-over',
        obstacles,
        collectibles,
        splashes: newSplashes,
        score,
        frameCount,
        distance,
        scrollSpeed,
        scroll,
        starPower: newStarPower,
      };
    }
    // Push rat away from bank
    const edges = getBankEdges(state.width, distance, state.ratY, scroll);
    const safeX = Math.max(
      edges.left + RAT_SIZE + 5,
      Math.min(edges.right - RAT_SIZE - 5, state.ratX)
    );
    return {
      ...state,
      ratX: safeX,
      health,
      obstacles,
      collectibles,
      splashes: newSplashes,
      score,
      frameCount,
      distance,
      scrollSpeed,
      scroll,
      starPower: 60,
    };
  }

  // Check obstacle collisions
  const obsResult = checkObstacleCollisions(state.ratX, state.ratY, obstacles, newStarPower);
  obstacles = obsResult.obstacles;
  score += obsResult.score;
  newSplashes.push(...obsResult.splashes);

  if (obsResult.hit) {
    health -= 25;
    newSplashes.push({ x: state.ratX, y: state.ratY, life: 1 });
    if (health <= 0) {
      return {
        ...state,
        health: 0,
        phase: 'game-over',
        obstacles,
        collectibles,
        splashes: newSplashes,
        score,
        frameCount,
        distance,
        scrollSpeed,
        scroll,
        starPower: newStarPower,
      };
    }
    return {
      ...state,
      health,
      obstacles,
      collectibles,
      splashes: newSplashes,
      score,
      frameCount,
      distance,
      scrollSpeed,
      scroll,
      starPower: 60,
    };
  }

  return {
    ...state,
    obstacles,
    collectibles,
    splashes: newSplashes,
    score,
    health,
    frameCount,
    distance,
    scrollSpeed,
    scroll,
    starPower: newStarPower,
  };
}

// ── Rendering ────────────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;

  // Water background
  const waterGrad = ctx.createLinearGradient(0, 0, 0, height);
  waterGrad.addColorStop(0, '#0c5e8f');
  waterGrad.addColorStop(0.5, '#0e6fa8');
  waterGrad.addColorStop(1, '#0c5e8f');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, 0, width, height);

  drawWaterRipples(ctx, state);
  drawBanks(ctx, state);

  for (const c of state.collectibles) {
    if (!c.collected) drawCollectible(ctx, c, state.frameCount);
  }

  for (const o of state.obstacles) {
    drawObstacle(ctx, o, state.frameCount);
  }

  drawSplashes(ctx, state.splashes);
  drawRat(ctx, state);
  drawHUD(ctx, state);
  drawOverlays(ctx, state);
}

function drawSplashes(ctx: CanvasRenderingContext2D, splashes: Splash[]): void {
  for (const s of splashes) {
    ctx.globalAlpha = s.life;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 + s.life * 2;
      const r = (1 - s.life) * 20;
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(angle) * r, s.y + Math.sin(angle) * r, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawOverlays(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;

  if (state.phase === 'ready') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RIVER RAT', width / 2, height * 0.35);
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Drag to steer — dodge obstacles!', width / 2, height * 0.45);
    ctx.fillText('Tap to start', width / 2, height * 0.55);
  }

  if (state.phase === 'game-over') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', width / 2, height * 0.35);
    ctx.font = 'bold 28px "Press Start 2P", monospace';
    ctx.fillText(String(state.score), width / 2, height * 0.47);
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`${Math.floor(state.distance)}m downstream`, width / 2, height * 0.55);
    ctx.fillText('Tap to restart', width / 2, height * 0.63);
  }
}

function drawWaterRipples(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  // Ripples scroll DOWN (river flowing downstream)
  const offset = (state.scroll * 2) % 30;
  for (let y = -30 - offset; y < state.height + 30; y += 30) {
    ctx.beginPath();
    for (let x = 0; x < state.width; x += 5) {
      const wy = y + Math.sin((x + state.scroll) * 0.04) * 4;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }
}

function drawBanks(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height, distance, scroll } = state;

  // Draw smooth bank edges using continuous curves
  // Left bank
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let y = 0; y <= height; y += 4) {
    const edges = getBankEdges(width, distance, y, scroll);
    ctx.lineTo(edges.left, y);
  }
  ctx.lineTo(0, height);
  ctx.closePath();
  const leftGrad = ctx.createLinearGradient(0, 0, width * 0.2, 0);
  leftGrad.addColorStop(0, '#2d5a1e');
  leftGrad.addColorStop(0.6, '#3a7a28');
  leftGrad.addColorStop(1, '#4a9030');
  ctx.fillStyle = leftGrad;
  ctx.fill();

  // Right bank
  ctx.beginPath();
  ctx.moveTo(width, 0);
  for (let y = 0; y <= height; y += 4) {
    const edges = getBankEdges(width, distance, y, scroll);
    ctx.lineTo(edges.right, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  const rightGrad = ctx.createLinearGradient(width * 0.8, 0, width, 0);
  rightGrad.addColorStop(0, '#4a9030');
  rightGrad.addColorStop(0.4, '#3a7a28');
  rightGrad.addColorStop(1, '#2d5a1e');
  ctx.fillStyle = rightGrad;
  ctx.fill();

  // Grass tufts along edges
  drawBankGrassLine(ctx, state, true);
  drawBankGrassLine(ctx, state, false);
}

function drawBankGrassLine(ctx: CanvasRenderingContext2D, state: GameState, isLeft: boolean): void {
  ctx.fillStyle = '#5ab340';
  const dir = isLeft ? 1 : -1;
  for (let y = 5; y < state.height; y += 18) {
    const edges = getBankEdges(state.width, state.distance, y, state.scroll);
    const x = isLeft ? edges.left : edges.right;
    const sway = Math.sin((state.scroll + y) * 0.02) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x + (6 + sway) * dir, y - 2);
    ctx.lineTo(x + 2 * dir, y - 1);
    ctx.closePath();
    ctx.fill();
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, frame: number): void {
  const cx = obs.x + obs.w / 2;
  const cy = obs.y + obs.h / 2;

  switch (obs.type) {
    case 'log':
      drawLog(ctx, cx, cy, obs);
      break;
    case 'rock':
      drawRock(ctx, cx, cy, obs);
      break;
    case 'duck':
      drawDuck(ctx, cx, cy, obs, frame);
      break;
    case 'lily':
      drawLily(ctx, cx, cy);
      break;
    case 'fish':
      drawFish(ctx, cx, cy, frame);
      break;
  }
}

function drawLog(ctx: CanvasRenderingContext2D, cx: number, cy: number, obs: Obstacle): void {
  ctx.fillStyle = '#8B5E3C';
  ctx.beginPath();
  ctx.ellipse(cx, cy, obs.w / 2, obs.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6B3F1F';
  ctx.beginPath();
  ctx.ellipse(cx, cy, obs.w / 2 - 3, obs.h / 2 - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7B4E2C';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx - obs.w * 0.2, cy, 4, obs.h / 3, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawRock(ctx: CanvasRenderingContext2D, cx: number, cy: number, obs: Obstacle): void {
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  ctx.ellipse(cx, cy, obs.w / 2, obs.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - 3, obs.w / 4, obs.h / 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawDuck(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  obs: Obstacle,
  frame: number
): void {
  const bob = Math.sin(frame * 0.08) * 2;
  const angry = obs.bumped;

  // Body
  ctx.fillStyle = angry ? '#f59e0b' : '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(cx, cy + bob, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(cx + 6, cy - 6 + bob, 6, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = angry ? '#dc2626' : '#f97316';
  ctx.beginPath();
  ctx.moveTo(cx + 11, cy - 6 + bob);
  ctx.lineTo(cx + 17, cy - (angry ? 4 : 5) + bob);
  ctx.lineTo(cx + 11, cy - 3 + bob);
  ctx.closePath();
  ctx.fill();

  if (angry) {
    // Angry eyebrows + X eyes
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    // Left eyebrow (angled down)
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - 11 + bob);
    ctx.lineTo(cx + 8, cy - 9 + bob);
    ctx.stroke();
    // X eyes
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + 7, cy - 9 + bob);
    ctx.lineTo(cx + 9, cy - 7 + bob);
    ctx.moveTo(cx + 9, cy - 9 + bob);
    ctx.lineTo(cx + 7, cy - 7 + bob);
    ctx.stroke();
    // Exclamation marks
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', cx + 14, cy - 12 + bob);
  } else {
    // Normal eye
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx + 8, cy - 8 + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLily(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0.2, Math.PI * 2 - 0.2);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawFish(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number): void {
  const jump = Math.sin(frame * 0.1) * 3;
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.ellipse(cx, cy + jump, 13, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + jump);
  ctx.lineTo(cx - 18, cy - 5 + jump);
  ctx.lineTo(cx - 18, cy + 5 + jump);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx + 6, cy - 2 + jump, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(cx + 6.5, cy - 2 + jump, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCollectible(ctx: CanvasRenderingContext2D, col: Collectible, frame: number): void {
  const bob = Math.sin(frame * 0.06) * 2;
  const glow = 0.5 + Math.sin(frame * 0.08) * 0.3;

  if (col.type === 'cheese') {
    ctx.fillStyle = `rgba(251, 191, 36, ${glow + 0.3})`;
    ctx.beginPath();
    ctx.arc(col.x, col.y + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(col.x - 7, col.y + 4 + bob);
    ctx.lineTo(col.x, col.y - 7 + bob);
    ctx.lineTo(col.x + 7, col.y + 4 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(col.x - 2, col.y + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(col.x + 3, col.y + 2 + bob, 1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Star — rainbow glow
    const hue = (frame * 3) % 360;
    ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${glow})`;
    ctx.beginPath();
    ctx.arc(col.x, col.y + bob, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
    drawStar(ctx, { cx: col.x, cy: col.y + bob, spikes: 5, outer: 10, inner: 5 });
  }
}

interface StarParams {
  cx: number;
  cy: number;
  spikes: number;
  outer: number;
  inner: number;
}

function drawStar(ctx: CanvasRenderingContext2D, s: StarParams): void {
  ctx.beginPath();
  for (let i = 0; i < s.spikes * 2; i++) {
    const r = i % 2 === 0 ? s.outer : s.inner;
    const angle = (Math.PI * i) / s.spikes - Math.PI / 2;
    const x = s.cx + Math.cos(angle) * r;
    const y = s.cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawRat(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { ratX, ratY, starPower, frameCount } = state;

  // Blink after taking damage (short invincibility)
  if (starPower > 0 && starPower < 60 && Math.floor(frameCount / 4) % 2 === 0) return;

  ctx.save();
  ctx.translate(ratX, ratY);

  const tubeWobble = Math.sin(frameCount * 0.05) * 1.5;
  const powered = starPower >= 60;

  // Rainbow glow when star-powered
  if (powered) {
    const hue = (frameCount * 5) % 360;
    ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.3)`;
    ctx.beginPath();
    ctx.arc(0, 0, RAT_SIZE + 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner tube
  ctx.fillStyle = powered ? `hsl(${(frameCount * 5) % 360}, 80%, 50%)` : '#ec4899';
  ctx.beginPath();
  ctx.ellipse(0, 2 + tubeWobble, RAT_SIZE, RAT_SIZE * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = powered ? `hsl(${(frameCount * 5 + 40) % 360}, 80%, 60%)` : '#f472b6';
  ctx.beginPath();
  ctx.ellipse(-4, -2 + tubeWobble, RAT_SIZE * 0.6, RAT_SIZE * 0.4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0c5e8f';
  ctx.beginPath();
  ctx.ellipse(0, 2 + tubeWobble, RAT_SIZE * 0.5, RAT_SIZE * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouse body
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.ellipse(0, -4 + tubeWobble, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(0, -14 + tubeWobble, 8, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#d1d5db';
  ctx.beginPath();
  ctx.ellipse(-6, -20 + tubeWobble, 5, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, -20 + tubeWobble, 5, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath();
  ctx.ellipse(-6, -20 + tubeWobble, 3, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, -20 + tubeWobble, 3, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eyes — bigger when star-powered (excited!)
  const eyeSize = powered ? 2.5 : 2;
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-3, -15 + tubeWobble, eyeSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3, -15 + tubeWobble, eyeSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-2.5, -16 + tubeWobble, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3.5, -16 + tubeWobble, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.arc(0, -12 + tubeWobble, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Whiskers
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 0.5;
  for (const side of [-1, 1]) {
    for (const a of [-0.2, 0, 0.2]) {
      ctx.beginPath();
      ctx.moveTo(side * 3, -12 + tubeWobble);
      ctx.lineTo(side * 12, -12 + a * 10 + tubeWobble);
      ctx.stroke();
    }
  }

  // Paws
  ctx.fillStyle = '#d1d5db';
  ctx.beginPath();
  ctx.ellipse(-RAT_SIZE * 0.7, 0 + tubeWobble, 4, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(RAT_SIZE * 0.7, 0 + tubeWobble, 4, 3, 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Wake/trail BELOW rat (behind — rat is going downstream/down)
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(ratX, ratY - 20 - i * 12, RAT_SIZE - i * 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width } = state;

  // Health bar (top left)
  const barW = 80;
  const barH = 8;
  const barX = 10;
  const barY = 14;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 4);
  ctx.fill();

  // Health fill
  const healthPct = state.health / MAX_HEALTH;
  const healthColor = healthPct > 0.5 ? '#22c55e' : healthPct > 0.25 ? '#eab308' : '#ef4444';
  ctx.fillStyle = healthColor;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * healthPct, barH, 4);
  ctx.fill();

  // Health label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HP', barX, barY - 2);

  // Score
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${state.score}`, width / 2, 24);

  // Distance
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`${Math.floor(state.distance)}m`, width / 2, 38);

  // Star power indicator
  if (state.starPower >= 60) {
    const hue = (state.frameCount * 5) % 360;
    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`★ ${Math.ceil(state.starPower / 60)}s`, width - 10, 24);
  }
}

// ── High score ──────────────────────────────────────────────────────

export function getHighScore(): number {
  const v = localStorage.getItem('river-rat-high');
  return v ? Number(v) : 0;
}

export function saveHighScore(score: number): void {
  const prev = getHighScore();
  if (score > prev) {
    localStorage.setItem('river-rat-high', String(score));
  }
}
