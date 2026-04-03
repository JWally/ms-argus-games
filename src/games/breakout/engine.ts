// ── Breakout game engine ─────────────────────────────────────────────

export interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  hits: number; // hits remaining
  maxHits: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface GameState {
  width: number;
  height: number;
  ball: Ball;
  paddle: Paddle;
  bricks: Brick[];
  particles: Particle[];
  lives: number;
  score: number;
  level: number;
  phase: 'ready' | 'playing' | 'dead' | 'game-over' | 'win';
  combo: number;
}

// ── Constants ───────────────────────────────────────────────────────

const BALL_SPEED = 4.5;
const BALL_RADIUS = 5;
const PADDLE_H = 12;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_H = 16;
const BRICK_GAP = 3;
const BRICK_TOP = 60;

const ROW_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];

// ── Create bricks for a level ───────────────────────────────────────

function createBricks(width: number, level: number): Brick[] {
  const bricks: Brick[] = [];
  const totalGapW = (BRICK_COLS + 1) * BRICK_GAP;
  const brickW = (width - totalGapW) / BRICK_COLS;

  for (let row = 0; row < BRICK_ROWS; row++) {
    const hits = row < 2 && level > 1 ? 2 : 1;
    for (let col = 0; col < BRICK_COLS; col++) {
      bricks.push({
        x: BRICK_GAP + col * (brickW + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_H + BRICK_GAP),
        w: brickW,
        h: BRICK_H,
        color: ROW_COLORS[row],
        hits,
        maxHits: hits,
      });
    }
  }
  return bricks;
}

// ── Init ────────────────────────────────────────────────────────────

export function initGame(width: number, height: number): GameState {
  const paddleW = Math.min(80, width * 0.22);
  return {
    width,
    height,
    ball: {
      x: width / 2,
      y: height - 40 - BALL_RADIUS,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
    },
    paddle: {
      x: width / 2 - paddleW / 2,
      y: height - 30,
      w: paddleW,
      h: PADDLE_H,
    },
    bricks: createBricks(width, 1),
    particles: [],
    lives: 3,
    score: 0,
    level: 1,
    phase: 'ready',
    combo: 0,
  };
}

// ── Launch ball ─────────────────────────────────────────────────────

export function launchBall(state: GameState): GameState {
  if (state.phase !== 'ready') return state;
  // Random angle between -30 and 30 degrees from straight up
  const angle = ((Math.random() - 0.5) * 60 * Math.PI) / 180 - Math.PI / 2;
  return {
    ...state,
    phase: 'playing',
    ball: {
      ...state.ball,
      vx: Math.cos(angle) * BALL_SPEED,
      vy: Math.sin(angle) * BALL_SPEED,
    },
    combo: 0,
  };
}

// ── Move paddle ─────────────────────────────────────────────────────

export function movePaddle(state: GameState, x: number): GameState {
  const px = Math.max(0, Math.min(state.width - state.paddle.w, x - state.paddle.w / 2));
  const paddle = { ...state.paddle, x: px };

  // In ready phase, ball follows paddle
  if (state.phase === 'ready') {
    return {
      ...state,
      paddle,
      ball: {
        ...state.ball,
        x: px + paddle.w / 2,
      },
    };
  }

  return { ...state, paddle };
}

// ── Brick collision ─────────────────────────────────────────────────

interface BrickCollisionResult {
  bricks: Brick[];
  bvx: number;
  bvy: number;
  combo: number;
  score: number;
  particles: Particle[];
}

interface BrickCollisionInput {
  bricks: Brick[];
  bx: number;
  by: number;
  radius: number;
  bvx: number;
  bvy: number;
  combo: number;
  score: number;
  particles: Particle[];
}

function collideBricks(input: BrickCollisionInput): BrickCollisionResult {
  const { bricks, bx, by, radius, bvx, bvy, combo, score, particles } = input;
  let result = bricks;
  let reflected = false;
  let rvx = bvx;
  let rvy = bvy;
  let c = combo;
  let s = score;
  let p = particles;

  for (let i = 0; i < result.length; i++) {
    const b = result[i];
    const hit =
      bx + radius > b.x && bx - radius < b.x + b.w && by + radius > b.y && by - radius < b.y + b.h;
    if (!hit) continue;

    if (!reflected) {
      const oL = bx + radius - b.x;
      const oR = b.x + b.w - (bx - radius);
      const oT = by + radius - b.y;
      const oB = b.y + b.h - (by - radius);
      const min = Math.min(oL, oR, oT, oB);
      if (min === oT || min === oB) rvy = -rvy;
      else rvx = -rvx;
      reflected = true;
    }

    result = result === bricks ? [...bricks] : result;
    if (result[i].hits <= 1) {
      result.splice(i, 1);
      i--;
      c++;
      s += 10 * c;
      p = [...p, ...spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color)];
    } else {
      result[i] = { ...result[i], hits: result[i].hits - 1 };
      s += 5;
    }
  }

  return { bricks: result, bvx: rvx, bvy: rvy, combo: c, score: s, particles: p };
}

// ── Tick ────────────────────────────────────────────────────────────

export function tick(state: GameState, dt: number): GameState {
  if (state.phase !== 'playing') {
    // Still update particles in non-playing phases
    if (state.particles.length > 0) {
      return {
        ...state,
        particles: tickParticles(state.particles, dt),
      };
    }
    return state;
  }

  const { ball, paddle, bricks, phase, level } = state;
  let { score, combo, lives, particles } = state;
  const { width, height } = state;

  // Move ball
  let bx = ball.x + ball.vx * dt;
  let by = ball.y + ball.vy * dt;
  let bvx = ball.vx;
  let bvy = ball.vy;

  // Wall collisions
  if (bx - ball.radius <= 0) {
    bx = ball.radius;
    bvx = Math.abs(bvx);
  } else if (bx + ball.radius >= width) {
    bx = width - ball.radius;
    bvx = -Math.abs(bvx);
  }
  if (by - ball.radius <= 0) {
    by = ball.radius;
    bvy = Math.abs(bvy);
  }

  // Paddle collision
  if (
    bvy > 0 &&
    by + ball.radius >= paddle.y &&
    by + ball.radius <= paddle.y + paddle.h + 4 &&
    bx >= paddle.x - 2 &&
    bx <= paddle.x + paddle.w + 2
  ) {
    // Reflect based on where ball hit paddle (gives player angle control)
    const hitPos = (bx - paddle.x) / paddle.w; // 0..1
    const angle = ((hitPos - 0.5) * 140 * Math.PI) / 180 - Math.PI / 2;
    const speed = Math.sqrt(bvx * bvx + bvy * bvy);
    bvx = Math.cos(angle) * speed;
    bvy = Math.sin(angle) * speed;
    by = paddle.y - ball.radius;
    combo = 0;

    // Ensure ball always moves upward after paddle hit
    if (bvy > 0) bvy = -bvy;
  }

  // Ball fell below paddle
  if (by > height + 20) {
    lives--;
    if (lives <= 0) {
      return {
        ...state,
        lives: 0,
        phase: 'game-over',
        ball: { ...ball, x: bx, y: by, vx: 0, vy: 0 },
        particles,
      };
    }
    // Reset ball on paddle
    const resetX = paddle.x + paddle.w / 2;
    return {
      ...state,
      lives,
      phase: 'dead',
      ball: {
        x: resetX,
        y: height - 40 - BALL_RADIUS,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
      },
      combo: 0,
      particles,
    };
  }

  // Brick collisions
  const brickResult = collideBricks({
    bricks,
    bx,
    by,
    radius: ball.radius,
    bvx,
    bvy,
    combo,
    score,
    particles,
  });
  bvx = brickResult.bvx;
  bvy = brickResult.bvy;
  combo = brickResult.combo;
  score = brickResult.score;
  particles = tickParticles(brickResult.particles, dt);

  // Level clear
  if (brickResult.bricks.length === 0) {
    const nextLevel = level + 1;
    const newBricksSet = createBricks(width, nextLevel);
    const resetX = paddle.x + paddle.w / 2;
    // Speed up slightly each level
    return {
      ...state,
      bricks: newBricksSet,
      level: nextLevel,
      score,
      phase: 'ready',
      ball: {
        x: resetX,
        y: height - 40 - BALL_RADIUS,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
      },
      particles,
      combo: 0,
    };
  }

  return {
    ...state,
    ball: { ...ball, x: bx, y: by, vx: bvx, vy: bvy },
    bricks: brickResult.bricks,
    particles,
    score,
    combo,
    lives,
    phase,
  };
}

// ── Continue after death ────────────────────────────────────────────

export function continueAfterDeath(state: GameState): GameState {
  if (state.phase !== 'dead') return state;
  return { ...state, phase: 'ready' };
}

// ── Particles ───────────────────────────────────────────────────────

function spawnParticles(x: number, y: number, color: string): Particle[] {
  const count = 6;
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 1.5 + Math.random() * 2;
    out.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
    });
  }
  return out;
}

function tickParticles(particles: Particle[], dt: number): Particle[] {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      life: p.life - 0.03 * dt,
    }))
    .filter((p) => p.life > 0);
}

// ── Rendering ───────────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;

  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, width, height);

  // Bricks
  for (const brick of state.bricks) {
    const alpha = brick.hits < brick.maxHits ? 0.55 : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = brick.color;

    // Rounded rect
    const r = 3;
    ctx.beginPath();
    ctx.moveTo(brick.x + r, brick.y);
    ctx.lineTo(brick.x + brick.w - r, brick.y);
    ctx.quadraticCurveTo(brick.x + brick.w, brick.y, brick.x + brick.w, brick.y + r);
    ctx.lineTo(brick.x + brick.w, brick.y + brick.h - r);
    ctx.quadraticCurveTo(
      brick.x + brick.w,
      brick.y + brick.h,
      brick.x + brick.w - r,
      brick.y + brick.h
    );
    ctx.lineTo(brick.x + r, brick.y + brick.h);
    ctx.quadraticCurveTo(brick.x, brick.y + brick.h, brick.x, brick.y + brick.h - r);
    ctx.lineTo(brick.x, brick.y + r);
    ctx.quadraticCurveTo(brick.x, brick.y, brick.x + r, brick.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Paddle
  ctx.fillStyle = '#8b5cf6';
  const pr = 6;
  ctx.beginPath();
  ctx.moveTo(state.paddle.x + pr, state.paddle.y);
  ctx.lineTo(state.paddle.x + state.paddle.w - pr, state.paddle.y);
  ctx.quadraticCurveTo(
    state.paddle.x + state.paddle.w,
    state.paddle.y,
    state.paddle.x + state.paddle.w,
    state.paddle.y + pr
  );
  ctx.lineTo(state.paddle.x + state.paddle.w, state.paddle.y + state.paddle.h - pr);
  ctx.quadraticCurveTo(
    state.paddle.x + state.paddle.w,
    state.paddle.y + state.paddle.h,
    state.paddle.x + state.paddle.w - pr,
    state.paddle.y + state.paddle.h
  );
  ctx.lineTo(state.paddle.x + pr, state.paddle.y + state.paddle.h);
  ctx.quadraticCurveTo(
    state.paddle.x,
    state.paddle.y + state.paddle.h,
    state.paddle.x,
    state.paddle.y + state.paddle.h - pr
  );
  ctx.lineTo(state.paddle.x, state.paddle.y + pr);
  ctx.quadraticCurveTo(state.paddle.x, state.paddle.y, state.paddle.x + pr, state.paddle.y);
  ctx.closePath();
  ctx.fill();

  // Ball
  if (state.phase !== 'game-over') {
    // Glow
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, state.ball.radius + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // HUD - top bar
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${state.score}`, 10, 24);

  ctx.textAlign = 'center';
  ctx.fillText(`Level ${state.level}`, width / 2, 24);

  ctx.textAlign = 'right';
  // Lives as dots
  for (let i = 0; i < state.lives; i++) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(width - 14 - i * 18, 20, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Combo indicator
  if (state.combo > 1 && state.phase === 'playing') {
    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`x${state.combo} combo!`, width / 2, 44);
  }
}

// ── High score ──────────────────────────────────────────────────────

export function getHighScore(): number {
  const v = localStorage.getItem('breakout-high');
  return v ? Number(v) : 0;
}

export function saveHighScore(score: number): void {
  const prev = getHighScore();
  if (score > prev) {
    try {
      localStorage.setItem('breakout-high', String(score));
    } catch {
      /* storage full */
    }
  }
}
