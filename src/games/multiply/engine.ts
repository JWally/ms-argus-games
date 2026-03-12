// ── Multiplication Facts game engine ─────────────────────────────────

export interface Problem {
  a: number;
  b: number;
  answer: number;
}

export interface AnsweredProblem extends Problem {
  userAnswer: number;
  correct: boolean;
  timeMs: number;
}

export interface GameState {
  factor: number | null; // null = random mode
  problems: Problem[];
  current: number; // index into problems
  answered: AnsweredProblem[];
  phase: 'menu' | 'playing' | 'done';
  startTime: number; // ms timestamp for current problem
  totalStartTime: number; // ms timestamp for whole round
  streak: number; // current consecutive correct answers
  freezeAvailable: boolean; // earned at 3-streak, one use per round
  freezeActive: boolean; // timer is currently frozen
  freezeEnd: number; // timestamp when freeze expires
  frozenMs: number; // total ms deducted from timer due to freezes
}

// ── Generate problems ───────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateProblems(factor: number | null): Problem[] {
  const multipliers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  if (factor !== null) {
    // Specific factor: go through 1-12 in random order
    return shuffle(
      multipliers.map((m) => {
        // Randomize which side the factor appears on
        const flip = Math.random() < 0.5;
        const a = flip ? m : factor;
        const b = flip ? factor : m;
        return { a, b, answer: a * b };
      })
    );
  }

  // Random mode: pick 12 random problems from the full table
  const all: Problem[] = [];
  for (const x of multipliers) {
    for (const y of multipliers) {
      if (x <= y) {
        all.push({ a: x, b: y, answer: x * y });
      }
    }
  }
  const picked = shuffle(all).slice(0, 12);
  return picked.map((p) => {
    const flip = Math.random() < 0.5;
    return flip ? p : { a: p.b, b: p.a, answer: p.answer };
  });
}

// ── Start a round ───────────────────────────────────────────────────

export function startRound(factor: number | null): GameState {
  const now = Date.now();
  return {
    factor,
    problems: generateProblems(factor),
    current: 0,
    answered: [],
    phase: 'playing',
    startTime: now,
    totalStartTime: now,
    streak: 0,
    freezeAvailable: false,
    freezeActive: false,
    freezeEnd: 0,
    frozenMs: 0,
  };
}

// ── Submit an answer ────────────────────────────────────────────────

export function submitAnswer(state: GameState, userAnswer: number): GameState {
  if (state.phase !== 'playing') return state;

  const now = Date.now();
  const problem = state.problems[state.current];
  const correct = userAnswer === problem.answer;
  const result: AnsweredProblem = {
    ...problem,
    userAnswer,
    correct,
    timeMs: now - state.startTime,
  };

  const answered = [...state.answered, result];
  const next = state.current + 1;
  const streak = correct ? state.streak + 1 : 0;

  // Award freeze at 3-streak (if not already earned this round)
  const freezeAvailable = state.freezeAvailable || streak >= 3;

  const base = { ...state, answered, current: next, startTime: now, streak, freezeAvailable };

  if (next >= state.problems.length) {
    return { ...base, phase: 'done' };
  }

  return base;
}

export const FREEZE_DURATION = 5000; // 5 seconds

export function activateFreeze(state: GameState): GameState {
  if (!state.freezeAvailable || state.freezeActive) return state;
  return {
    ...state,
    freezeAvailable: false,
    freezeActive: true,
    freezeEnd: Date.now() + FREEZE_DURATION,
  };
}

export function tickFreeze(state: GameState): GameState {
  if (!state.freezeActive) return state;
  if (Date.now() >= state.freezeEnd) {
    return { ...state, freezeActive: false, frozenMs: state.frozenMs + FREEZE_DURATION };
  }
  return state;
}

// ── Stats ───────────────────────────────────────────────────────────

export function totalTime(state: GameState): number {
  if (state.phase !== 'done' || state.answered.length === 0) return 0;
  const raw = state.answered.reduce((sum, a) => sum + a.timeMs, 0);
  return Math.max(0, raw - state.frozenMs);
}

export function correctCount(state: GameState): number {
  return state.answered.filter((a) => a.correct).length;
}

// ── Best time persistence ───────────────────────────────────────────

function bestKey(factor: number | null): string {
  return `multiply-best-${factor ?? 'random'}`;
}

export function getBestTime(factor: number | null): number | null {
  const v = localStorage.getItem(bestKey(factor));
  return v ? Number(v) : null;
}

export function saveBestTime(factor: number | null, ms: number, perfect: boolean): void {
  if (!perfect) return; // only save if all correct
  const prev = getBestTime(factor);
  if (prev === null || ms < prev) {
    localStorage.setItem(bestKey(factor), String(ms));
  }
}

export function formatTime(ms: number): string {
  const secs = ms / 1000;
  return secs.toFixed(1) + 's';
}
