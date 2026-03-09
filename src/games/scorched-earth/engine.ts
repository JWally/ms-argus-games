// Scorched Earth — Canvas game engine
// Handles terrain generation, physics, rendering, and game logic.

// ─── Types ───────────────────────────────────────────────────────────────────

export type WeaponId = 'basic' | 'napalm' | 'mirv' | 'deaths-head';

export interface Weapon {
  id: WeaponId;
  name: string;
  radius: number;
  damage: number;
  color: string;
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  basic: { id: 'basic', name: 'Missile', radius: 20, damage: 25, color: '#facc15' },
  napalm: { id: 'napalm', name: 'Napalm', radius: 35, damage: 35, color: '#f97316' },
  mirv: { id: 'mirv', name: 'MIRV', radius: 18, damage: 20, color: '#ef4444' },
  'deaths-head': {
    id: 'deaths-head',
    name: "Death's Head",
    radius: 60,
    damage: 50,
    color: '#dc2626',
  },
};

interface Tank {
  x: number;
  y: number;
  hp: number;
  angle: number; // degrees, 0 = right, 90 = up, 180 = left
  color: string;
  barrelColor: string;
  label: string;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
  weapon: Weapon;
}

interface Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  phase: 'expand' | 'fade';
}

interface DamagePopup {
  x: number;
  y: number;
  amount: number;
  alpha: number;
  vy: number;
}

export type GamePhase =
  | 'player-aim'
  | 'player-fire'
  | 'ai-wait'
  | 'ai-fire'
  | 'explosion'
  | 'game-over';

export interface GameState {
  phase: GamePhase;
  terrain: number[]; // height at each x pixel
  player: Tank;
  ai: Tank;
  projectile: Projectile | null;
  explosions: Explosion[];
  popups: DamagePopup[];
  winner: 'player' | 'ai' | null;
  screenShake: number;
  aiTimer: number;
  width: number;
  height: number;
}

// ─── Terrain Generation ──────────────────────────────────────────────────────

function generateTerrain(w: number, h: number): number[] {
  const terrain: number[] = new Array(w);
  // 4 layered sine waves with random params
  const waves = Array.from({ length: 4 }, () => ({
    amp: (Math.random() * 0.12 + 0.03) * h,
    freq: Math.random() * 0.008 + 0.002,
    phase: Math.random() * Math.PI * 2,
  }));
  const baseHeight = h * 0.5;

  for (let x = 0; x < w; x++) {
    let y = baseHeight;
    for (const wave of waves) {
      y += Math.sin(x * wave.freq + wave.phase) * wave.amp;
    }
    // Clamp between 30%-70% of canvas height (from top)
    terrain[x] = Math.max(h * 0.3, Math.min(h * 0.7, y));
  }
  return terrain;
}

// ─── Tank Placement ──────────────────────────────────────────────────────────

function placeTank(
  terrain: number[],
  xCenter: number,
  color: string,
  barrelColor: string,
  label: string
): Tank {
  const y = terrain[Math.round(xCenter)];
  return { x: xCenter, y, hp: 100, angle: 45, color, barrelColor, label };
}

// ─── Init ────────────────────────────────────────────────────────────────────

export function initGame(width: number, height: number): GameState {
  const terrain = generateTerrain(width, height);
  const playerX = Math.round(width * 0.15 + Math.random() * width * 0.1);
  const aiX = Math.round(width * 0.75 + Math.random() * width * 0.1);

  return {
    phase: 'player-aim',
    terrain,
    player: placeTank(terrain, playerX, '#3b82f6', '#60a5fa', 'YOU'),
    ai: placeTank(terrain, aiX, '#ef4444', '#f87171', 'CPU'),
    projectile: null,
    explosions: [],
    popups: [],
    winner: null,
    screenShake: 0,
    aiTimer: 0,
    width,
    height,
  };
}

// ─── Fire ────────────────────────────────────────────────────────────────────

const GRAVITY = 0.15;
const POWER_SCALE = 0.14;

interface FireParams {
  state: GameState;
  fromTank: Tank;
  angleDeg: number;
  power: number;
  weapon: Weapon;
  flipAngle: boolean;
}

export function fireProjectile(p: FireParams): GameState {
  const { state, fromTank, angleDeg, power, weapon, flipAngle } = p;
  const angleRad = ((flipAngle ? 180 - angleDeg : angleDeg) * Math.PI) / 180;
  const speed = power * POWER_SCALE;
  const barrelLen = 18;
  const bx = fromTank.x + Math.cos(angleRad) * barrelLen;
  const by = fromTank.y - 8 - Math.sin(angleRad) * barrelLen;

  return {
    ...state,
    projectile: {
      x: bx,
      y: by,
      vx: Math.cos(angleRad) * speed,
      vy: -Math.sin(angleRad) * speed,
      trail: [],
      weapon,
    },
  };
}

// ─── Physics Tick ────────────────────────────────────────────────────────────

export function tick(state: GameState, dt: number): GameState {
  let s = { ...state };

  // Update damage popups
  s.popups = s.popups
    .map((p) => ({ ...p, y: p.y + p.vy * dt, vy: p.vy - 0.02 * dt, alpha: p.alpha - 0.015 * dt }))
    .filter((p) => p.alpha > 0);

  // Screen shake decay
  if (s.screenShake > 0) {
    s.screenShake = Math.max(0, s.screenShake - 0.3 * dt);
  }

  // Explosion animation
  if (s.explosions.length > 0) {
    s.explosions = s.explosions
      .map((e) => {
        if (e.phase === 'expand') {
          const newR = e.radius + 2.5 * dt;
          if (newR >= e.maxRadius) {
            return { ...e, radius: e.maxRadius, phase: 'fade' as const, alpha: 1 };
          }
          return { ...e, radius: newR };
        }
        // fade
        return { ...e, alpha: e.alpha - 0.04 * dt };
      })
      .filter((e) => e.alpha > 0);
  }

  // Projectile physics
  if (s.projectile) {
    const p = s.projectile;
    const newTrail = [...p.trail, { x: p.x, y: p.y }].slice(-40);
    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;
    const nvy = p.vy + GRAVITY * dt;

    // Out of bounds
    if (nx < 0 || nx >= s.width || ny > s.height + 50) {
      s = { ...s, projectile: null };
      s = endTurn(s);
      return s;
    }

    // Hit terrain?
    const terrainX = Math.round(nx);
    if (terrainX >= 0 && terrainX < s.width && ny >= s.terrain[terrainX]) {
      return handleImpact(s, nx, ny);
    }

    s = { ...s, projectile: { ...p, x: nx, y: ny, vy: nvy, trail: newTrail } };
  }

  // AI wait timer
  if (s.phase === 'ai-wait') {
    s.aiTimer += dt;
    if (s.aiTimer >= 60) {
      // ~1 second at 60fps
      s = aiFireTurn(s);
    }
  }

  return s;
}

// ─── Impact / Explosion ─────────────────────────────────────────────────────

function handleImpact(state: GameState, x: number, y: number): GameState {
  const weapon = state.projectile!.weapon;
  let s: GameState = {
    ...state,
    projectile: null,
    phase: 'explosion',
    screenShake: weapon.radius > 40 ? 12 : weapon.radius > 30 ? 6 : 3,
    explosions: [
      ...state.explosions,
      {
        x,
        y,
        radius: 2,
        maxRadius: weapon.radius,
        color: weapon.color,
        alpha: 1,
        phase: 'expand',
      },
    ],
  };

  // Carve terrain
  s = carveTerrain(s, x, y, weapon.radius);

  // Damage tanks
  s = applyDamage(s, x, y, weapon);

  // Update tank Y positions to match terrain
  s.player = { ...s.player, y: s.terrain[Math.round(s.player.x)] };
  s.ai = { ...s.ai, y: s.terrain[Math.round(s.ai.x)] };

  // Check win condition (deferred to let explosion play)
  setTimeout(() => {}, 0); // explosions handled in tick

  return s;
}

function carveTerrain(state: GameState, cx: number, cy: number, radius: number): GameState {
  const terrain = [...state.terrain];
  const r = Math.round(radius);
  for (let dx = -r; dx <= r; dx++) {
    const tx = Math.round(cx) + dx;
    if (tx < 0 || tx >= terrain.length) continue;
    const maxDepth = Math.sqrt(Math.max(0, r * r - dx * dx));
    // Only carve if the terrain is within the blast zone
    const craterBottom = cy + maxDepth;
    if (terrain[tx] < craterBottom) {
      // Push terrain down in the crater area
      const distFromCenter = Math.abs(cy - terrain[tx]);
      if (distFromCenter < maxDepth) {
        terrain[tx] = Math.min(state.height, terrain[tx] + maxDepth - distFromCenter);
      }
    }
  }
  return { ...state, terrain };
}

function applyDamage(state: GameState, x: number, y: number, weapon: Weapon): GameState {
  let s = { ...state };
  const popups: DamagePopup[] = [...s.popups];

  // Check each tank
  for (const who of ['player', 'ai'] as const) {
    const tank = s[who];
    const dist = Math.sqrt((tank.x - x) ** 2 + (tank.y - y) ** 2);
    if (dist < weapon.radius + 15) {
      // Full damage at center, linear falloff
      const factor = Math.max(0, 1 - dist / (weapon.radius + 15));
      const dmg = Math.round(weapon.damage * factor);
      if (dmg > 0) {
        s = { ...s, [who]: { ...tank, hp: Math.max(0, tank.hp - dmg) } };
        popups.push({ x: tank.x, y: tank.y - 30, amount: dmg, alpha: 1.5, vy: -1 });
      }
    }
  }

  s.popups = popups;
  return s;
}

function endTurn(state: GameState): GameState {
  // Check win
  if (state.player.hp <= 0) {
    return { ...state, phase: 'game-over', winner: 'ai' };
  }
  if (state.ai.hp <= 0) {
    return { ...state, phase: 'game-over', winner: 'player' };
  }

  if (state.phase === 'player-fire' || state.phase === 'explosion') {
    // Was player's turn, switch to AI
    if (state.explosions.length > 0) return state; // wait for explosions
    return { ...state, phase: 'ai-wait', aiTimer: 0 };
  }
  // Was AI's turn, switch to player
  if (state.explosions.length > 0) return state;
  return { ...state, phase: 'player-aim' };
}

// ─── AI ──────────────────────────────────────────────────────────────────────

function aiFireTurn(state: GameState): GameState {
  const ai = state.ai;
  const player = state.player;

  // Calculate rough angle toward player
  const dx = player.x - ai.x;
  const dy = -(player.y - ai.y); // canvas y is inverted
  const baseAngle = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
  // AI fires to the left (toward player), so angle is from the AI's perspective
  const angle = Math.max(10, Math.min(170, baseAngle + (Math.random() - 0.5) * 30));
  const power = Math.max(30, Math.min(100, 55 + (Math.random() - 0.5) * 20));

  const weapon = WEAPONS.basic;
  // AI is on the right, fires left — flip angle
  const s = fireProjectile({
    state,
    fromTank: ai,
    angleDeg: angle,
    power,
    weapon,
    flipAngle: true,
  });
  s.phase = 'ai-fire';
  return s;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;

  ctx.save();

  // Screen shake
  if (state.screenShake > 0) {
    const sx = (Math.random() - 0.5) * state.screenShake;
    const sy = (Math.random() - 0.5) * state.screenShake;
    ctx.translate(sx, sy);
  }

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#0f172a');
  skyGrad.addColorStop(0.6, '#1e3a5f');
  skyGrad.addColorStop(1, '#3b82f6');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Terrain
  drawTerrain(ctx, state);

  // Tanks
  drawTank(ctx, state.player, false);
  drawTank(ctx, state.ai, true);

  // HP bars
  drawHPBar(ctx, state.player, width);
  drawHPBar(ctx, state.ai, width);

  // Projectile
  if (state.projectile) {
    drawProjectile(ctx, state.projectile);
  }

  // Explosions
  for (const exp of state.explosions) {
    drawExplosion(ctx, exp);
  }

  // Damage popups
  for (const popup of state.popups) {
    drawPopup(ctx, popup);
  }

  ctx.restore();
}

function drawTerrain(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { terrain, width, height } = state;
  const grad = ctx.createLinearGradient(0, height * 0.3, 0, height);
  grad.addColorStop(0, '#4a7c3f');
  grad.addColorStop(0.3, '#3d6b35');
  grad.addColorStop(0.7, '#6b4226');
  grad.addColorStop(1, '#4a2d1a');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x < width; x++) {
    ctx.lineTo(x, terrain[x]);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
}

function drawTank(ctx: CanvasRenderingContext2D, tank: Tank, facingLeft: boolean): void {
  const { x, y } = tank;
  if (tank.hp <= 0) {
    // Draw wreckage
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 12, y - 6, 24, 6);
    return;
  }

  // Body
  ctx.fillStyle = tank.color;
  ctx.fillRect(x - 12, y - 10, 24, 10);

  // Turret dome
  ctx.beginPath();
  ctx.arc(x, y - 10, 7, Math.PI, 0);
  ctx.fill();

  // Barrel
  const angleRad = ((facingLeft ? 180 - tank.angle : tank.angle) * Math.PI) / 180;
  const barrelLen = 18;
  const bx = x + Math.cos(angleRad) * barrelLen;
  const by = y - 10 - Math.sin(angleRad) * barrelLen;

  ctx.strokeStyle = tank.barrelColor;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // Treads
  ctx.fillStyle = '#333';
  ctx.fillRect(x - 14, y - 2, 28, 4);
}

function drawHPBar(ctx: CanvasRenderingContext2D, tank: Tank, _canvasWidth: number): void {
  const barW = 36;
  const barH = 5;
  const bx = tank.x - barW / 2;
  const by = tank.y - 28;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

  // HP fill
  const hpFrac = Math.max(0, tank.hp / 100);
  const hpColor = hpFrac > 0.5 ? '#22c55e' : hpFrac > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = hpColor;
  ctx.fillRect(bx, by, barW * hpFrac, barH);

  // Label
  ctx.fillStyle = '#fff';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${tank.label} ${tank.hp}`, tank.x, by - 3);
}

function drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile): void {
  // Trail
  ctx.strokeStyle = 'rgba(255,255,200,0.3)';
  ctx.lineWidth = 1;
  if (proj.trail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(proj.trail[0].x, proj.trail[0].y);
    for (let i = 1; i < proj.trail.length; i++) {
      ctx.lineTo(proj.trail[i].x, proj.trail[i].y);
    }
    ctx.stroke();
  }

  // Projectile
  ctx.fillStyle = proj.weapon.color;
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
  ctx.fill();

  // Glow
  ctx.fillStyle = 'rgba(255,255,200,0.5)';
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawExplosion(ctx: CanvasRenderingContext2D, exp: Explosion): void {
  // Outer glow
  ctx.globalAlpha = exp.alpha * 0.4;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(exp.x, exp.y, exp.radius * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Main explosion
  ctx.globalAlpha = exp.alpha * 0.8;
  ctx.fillStyle = exp.color;
  ctx.beginPath();
  ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
  ctx.fill();

  // Inner bright core
  ctx.globalAlpha = exp.alpha;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(exp.x, exp.y, exp.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawPopup(ctx: CanvasRenderingContext2D, popup: DamagePopup): void {
  ctx.globalAlpha = Math.min(1, popup.alpha);
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`-${popup.amount}`, popup.x, popup.y);
  ctx.globalAlpha = 1;
}

// ─── Helpers for checking if explosions finished ─────────────────────────────

export function checkPostExplosion(state: GameState): GameState {
  if (state.phase === 'explosion' && state.explosions.length === 0) {
    return endTurn(state);
  }
  return state;
}
