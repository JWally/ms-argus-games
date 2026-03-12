// ── Flappy Bird game engine ──────────────────────────────────────────

interface Pipe {
  x: number;
  gapY: number; // center of the gap
  gapSize: number; // height of the gap (varies with difficulty)
  scored: boolean;
}

export interface GameState {
  width: number;
  height: number;
  birdY: number;
  birdVY: number;
  pipes: Pipe[];
  score: number;
  phase: 'ready' | 'playing' | 'dead';
  frameCount: number;
}

// ── Constants ───────────────────────────────────────────────────────

const BIRD_X_RATIO = 0.2;
const BIRD_RADIUS = 13;
const PIPE_WIDTH = 44;

// ── Progressive difficulty — everything scales with score ───────────

function getGravity(score: number): number {
  // Start gentle, ramp up over ~15 pipes
  return 0.18 + Math.min(score, 15) * 0.008;
}

function getFlapForce(score: number): number {
  // Gentle flap early, slightly stronger later to match gravity
  return -(3.8 + Math.min(score, 15) * 0.1);
}

function getGapSize(score: number): number {
  // Very wide early, narrows over ~20 pipes
  return 180 - Math.min(score, 20) * 3;
}

function getPipeSpeed(score: number): number {
  // Slow start, ramps up
  return 1.4 + Math.min(score, 20) * 0.06;
}

function getPipeSpacing(score: number): number {
  // Wide spacing early, tightens
  return 240 - Math.min(score, 15) * 5;
}

// ── Init ────────────────────────────────────────────────────────────

export function initGame(width: number, height: number): GameState {
  return {
    width,
    height,
    birdY: height * 0.4,
    birdVY: 0,
    pipes: [],
    score: 0,
    phase: 'ready',
    frameCount: 0,
  };
}

// ── Flap ────────────────────────────────────────────────────────────

export function flap(state: GameState): GameState {
  if (state.phase === 'dead') return state;

  const force = getFlapForce(state.score);
  if (state.phase === 'ready') {
    return { ...state, phase: 'playing', birdVY: force, frameCount: 0 };
  }

  return { ...state, birdVY: force };
}

// ── Tick ────────────────────────────────────────────────────────────

export function tick(state: GameState, dt: number): GameState {
  if (state.phase !== 'playing') return state;

  const { width, height } = state;
  const birdX = width * BIRD_X_RATIO;
  const frameCount = state.frameCount + dt;

  // Bird physics (difficulty scales with score)
  const gravity = getGravity(state.score);
  let birdVY = state.birdVY + gravity * dt;
  let birdY = state.birdY + birdVY * dt;

  // Ceiling
  if (birdY < BIRD_RADIUS) {
    birdY = BIRD_RADIUS;
    birdVY = 0;
  }

  // Floor
  if (birdY + BIRD_RADIUS >= height) {
    return { ...state, birdY: height - BIRD_RADIUS, birdVY: 0, phase: 'dead', frameCount };
  }

  // Move pipes and spawn new ones
  const pipeSpeed = getPipeSpeed(state.score);
  const gapSize = getGapSize(state.score);
  const pipeSpacing = getPipeSpacing(state.score);

  let pipes = state.pipes.map((p) => ({ ...p, x: p.x - pipeSpeed * dt }));

  // Remove off-screen pipes
  pipes = pipes.filter((p) => p.x + PIPE_WIDTH > -10);

  // Spawn new pipe
  const lastPipe = pipes.length > 0 ? pipes[pipes.length - 1] : null;
  const spawnX = lastPipe ? lastPipe.x + pipeSpacing : width + 60;
  if (!lastPipe || lastPipe.x < width - pipeSpacing) {
    const minGap = gapSize / 2 + 30;
    const maxGap = height - gapSize / 2 - 30;
    const gapY = minGap + Math.random() * (maxGap - minGap);
    pipes.push({ x: spawnX, gapY, gapSize, scored: false });
  }

  // Collision detection & scoring
  let score = state.score;
  for (let i = 0; i < pipes.length; i++) {
    const p = pipes[i];
    const pipeRight = p.x + PIPE_WIDTH;

    // Score: bird passed the pipe
    if (!p.scored && p.x + PIPE_WIDTH < birdX) {
      pipes = [...pipes];
      pipes[i] = { ...p, scored: true };
      score++;
    }

    // Collision: check if bird overlaps pipe
    if (birdX + BIRD_RADIUS > p.x && birdX - BIRD_RADIUS < pipeRight) {
      const halfGap = p.gapSize / 2;
      const inGap =
        birdY > p.gapY - halfGap + BIRD_RADIUS && birdY < p.gapY + halfGap - BIRD_RADIUS;
      if (!inGap) {
        return { ...state, birdY, birdVY, pipes, score, phase: 'dead', frameCount };
      }
    }
  }

  return { ...state, birdY, birdVY, pipes, score, phase: 'playing', frameCount };
}

// ── Rendering ───────────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  const birdX = width * BIRD_X_RATIO;

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#1a1a2e');
  skyGrad.addColorStop(1, '#16213e');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Ground line
  ctx.fillStyle = '#2a4a3a';
  ctx.fillRect(0, height - 2, width, 2);

  // Pipes
  for (const pipe of state.pipes) {
    drawPipe(ctx, pipe, height);
  }

  // Bird
  drawBird(ctx, birdX, state.birdY, state.birdVY, state.phase);

  // Score
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(state.score), width / 2, 50);

  // Ready text
  if (state.phase === 'ready') {
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Tap to start', width / 2, height * 0.6);
  }

  // Dead overlay
  if (state.phase === 'dead') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', width / 2, height * 0.38);

    ctx.font = 'bold 36px "Press Start 2P", monospace';
    ctx.fillText(String(state.score), width / 2, height * 0.5);

    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Tap to restart', width / 2, height * 0.6);
  }
}

function drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe, height: number): void {
  const topBottom = pipe.gapY - pipe.gapSize / 2;
  const botTop = pipe.gapY + pipe.gapSize / 2;

  // Pipe body
  ctx.fillStyle = '#4ade80';
  // Top pipe
  ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topBottom);
  // Bottom pipe
  ctx.fillRect(pipe.x, botTop, PIPE_WIDTH, height - botTop);

  // Pipe caps (wider lip)
  const capH = 6;
  const capW = PIPE_WIDTH + 8;
  const capX = pipe.x - 4;
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(capX, topBottom - capH, capW, capH);
  ctx.fillRect(capX, botTop, capW, capH);

  // Dark edge for depth
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(pipe.x + PIPE_WIDTH - 6, 0, 6, topBottom);
  ctx.fillRect(pipe.x + PIPE_WIDTH - 6, botTop, 6, height - botTop);
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vy: number,
  phase: string
): void {
  ctx.save();
  ctx.translate(x, y);

  // Tilt based on velocity
  const tilt = phase === 'ready' ? 0 : Math.max(-0.4, Math.min(0.6, vy * 0.06));
  ctx.rotate(tilt);

  // Body
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_RADIUS, BIRD_RADIUS * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  const wingFlap = phase === 'playing' ? Math.sin(Date.now() * 0.015) * 4 : 0;
  ctx.ellipse(-2, 2 + wingFlap, 8, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(7, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(10, -1);
  ctx.lineTo(17, 1);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ── High score ──────────────────────────────────────────────────────

export function getHighScore(): number {
  const v = localStorage.getItem('flappy-high');
  return v ? Number(v) : 0;
}

export function saveHighScore(score: number): void {
  const prev = getHighScore();
  if (score > prev) {
    localStorage.setItem('flappy-high', String(score));
  }
}
