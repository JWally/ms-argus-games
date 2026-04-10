// Rock-Paper-Scissors engine — Enhanced Ensemble Predictor
//
// Five Markov-chain context tables run simultaneously; a meta-learner picks
// whichever predictor has been most accurate recently.  Tables persist in
// localStorage so the AI fingerprints each user's tendencies across sessions.
//
// Predictor contexts:
//   t1   — P(next | prev_choice)                         3 cells
//   t2   — P(next | prev_2_choices)                      9 cells
//   to   — P(next | prev_choice, prev_outcome)           9 cells   ← richer WSLS
//   t2o  — P(next | prev_2_choices, prev_outcome)       27 cells
//   tg   — P(next)  global bias (no context)             1 cell
//
// Meta-learner: out-of-sample scoring each round → hit-rate per predictor →
// blend toward Nash (uniform 1/3) when no predictor beats the chance baseline.
//
// References:
//   Wang, Xu, Zhou — "Social cycling and conditional responses in the
//   Rock-Paper-Scissors game", Scientific Reports 4, 5830 (2014)

export type Choice = 'rock' | 'paper' | 'scissors';
export type Outcome = 'win' | 'lose' | 'tie';
export type Mode = 'vs-ai' | 'coach';

export const CHOICES: Choice[] = ['rock', 'paper', 'scissors'];
export const TOTAL_ROUNDS = 30;

export interface Round {
  // vs-ai:  humanChoice = user's pick;      aiChoice = AI's pick
  // coach:  humanChoice = opponent's pick;  aiChoice = suggested pick for user
  humanChoice: Choice;
  aiChoice: Choice;
  outcome: Outcome; // vs-ai: from user's perspective; coach: suggestion vs opponent
}

export interface GameState {
  mode: Mode;
  rounds: Round[];
  humanScore: number; // wins (vs-ai) or correct suggestions (coach)
  aiScore: number; // AI wins (vs-ai); unused in coach
  seriesOver: boolean;
  seriesWinner: 'human' | 'ai' | 'tie' | null;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function outcomeFor(mine: Choice, theirs: Choice): Outcome {
  if (mine === theirs) return 'tie';
  const mi = CHOICES.indexOf(mine);
  const ti = CHOICES.indexOf(theirs);
  return (ti + 1) % 3 === mi ? 'win' : 'lose';
}

function beatOf(c: Choice): Choice {
  return CHOICES[(CHOICES.indexOf(c) + 1) % 3];
}

const ci = (c: Choice) => CHOICES.indexOf(c);
const randomChoice = (): Choice => CHOICES[Math.floor(Math.random() * 3)];

// Deterministic argmax with random tie-breaking; null when table is empty
function argmax(counts: [number, number, number]): Choice | null {
  const total = counts[0] + counts[1] + counts[2];
  if (total === 0) return null;
  const max = Math.max(...counts);
  const tied = counts.reduce<number[]>((a, v, i) => (v === max ? [...a, i] : a), []);
  return CHOICES[tied[Math.floor(Math.random() * tied.length)]];
}

// ─── Frequency tables ─────────────────────────────────────────────────────────

type FreqTable = Record<string, [number, number, number]>;

const tGet = (t: FreqTable, k: string): [number, number, number] => t[k] ?? [0, 0, 0];

const tInc = (t: FreqTable, k: string, c: Choice): void => {
  if (!t[k]) t[k] = [0, 0, 0];
  t[k][ci(c)]++;
};

// ─── Persistent memory ────────────────────────────────────────────────────────

const STORAGE_KEY = 'rps-memory-v2';

interface Memory {
  t1: FreqTable; // context: prev choice
  t2: FreqTable; // context: prev 2 choices
  to: FreqTable; // context: prev choice + outcome
  t2o: FreqTable; // context: prev 2 choices + outcome
  tg: [number, number, number]; // global choice counts
  // rolling accuracy per predictor (indices 0-4 → t1, t2, to, t2o, tg)
  hits: number[];
  trials: number[];
}

function emptyMemory(): Memory {
  return {
    t1: {},
    t2: {},
    to: {},
    t2o: {},
    tg: [0, 0, 0],
    hits: [0, 0, 0, 0, 0],
    trials: [0, 0, 0, 0, 0],
  };
}

function loadMemory(): Memory {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const parsed = JSON.parse(s) as Partial<Memory>;
      return { ...emptyMemory(), ...parsed };
    }
  } catch {
    /* empty */
  }
  return emptyMemory();
}

function saveMemory(m: Memory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    /* empty */
  }
}

// Module-level singleton: loaded once, mutated each round, saved to localStorage
let mem: Memory = loadMemory();

export function resetMemory(): void {
  mem = emptyMemory();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* empty */
  }
}

// ─── Context key builders ─────────────────────────────────────────────────────

const k1 = (r: Round) => r.humanChoice;
const k2 = (a: Round, b: Round) => `${a.humanChoice}|${b.humanChoice}`;
const ko = (r: Round) => `${r.humanChoice}|${r.outcome}`;
const k2o = (a: Round, b: Round) => `${a.humanChoice}|${b.humanChoice}|${b.outcome}`;

// ─── Five predictors ──────────────────────────────────────────────────────────
// Returns what each predictor thinks the HUMAN will throw next.
// null = insufficient data (predictor abstains).

function allPredictions(rounds: Round[]): (Choice | null)[] {
  const n = rounds.length;
  if (n === 0) return [null, null, null, null, null];

  const last = rounds[n - 1];
  const prev = n >= 2 ? rounds[n - 2] : null;

  return [
    argmax(tGet(mem.t1, k1(last))),
    prev ? argmax(tGet(mem.t2, k2(prev, last))) : null,
    argmax(tGet(mem.to, ko(last))),
    prev ? argmax(tGet(mem.t2o, k2o(prev, last))) : null,
    argmax([...mem.tg]),
  ];
}

// ─── Memory update (call after every round) ───────────────────────────────────
// Score predictors first (out-of-sample), THEN update tables.

function updateMemory(rounds: Round[]): void {
  const n = rounds.length;
  if (n === 0) return;

  const last = rounds[n - 1];
  const actual = last.humanChoice;

  // 1. Score each predictor on this round (before tables are updated)
  if (n >= 2) {
    const preds = allPredictions(rounds.slice(0, n - 1));
    for (const [i, p] of preds.entries()) {
      if (p !== null) {
        mem.trials[i]++;
        if (p === actual) mem.hits[i]++;
      }
    }
  }

  // 2. Update context tables
  mem.tg[ci(actual)]++;
  if (n >= 2) {
    const prev = rounds[n - 2];
    tInc(mem.t1, k1(prev), actual);
    tInc(mem.to, ko(prev), actual);
    if (n >= 3) {
      const p2 = rounds[n - 3];
      tInc(mem.t2, k2(p2, prev), actual);
      tInc(mem.t2o, k2o(p2, prev), actual);
    }
  }

  saveMemory(mem);
}

// ─── Meta-learner ─────────────────────────────────────────────────────────────
// Kelly-criterion-style confidence blend:
//   hit-rate < NASH_FLOOR  → treat predictor as useless
//   hit-rate > TRUST_CEIL  → fully trust it
//   in between             → linearly blend toward Nash

const NASH_FLOOR = 0.34; // barely above 1/3 chance
const TRUST_CEIL = 0.46; // meaningfully above chance
const MIN_TRIALS = 3; // need at least this many scored rounds

function predictHuman(rounds: Round[]): Choice {
  if (rounds.length === 0) return randomChoice();

  const preds = allPredictions(rounds);
  const hitRates = mem.trials.map((t, i) => (t < MIN_TRIALS ? 1 / 3 : mem.hits[i] / t));

  // Pick the predictor with the highest hit-rate that has a valid prediction
  let bestIdx = -1;
  let bestRate = NASH_FLOOR;
  for (let i = 0; i < preds.length; i++) {
    if (preds[i] !== null && hitRates[i] > bestRate) {
      bestRate = hitRates[i];
      bestIdx = i;
    }
  }

  if (bestIdx === -1) {
    // No predictor beats Nash — fall back to t1 counts (most data) or pure random
    const counts = tGet(mem.t1, k1(rounds[rounds.length - 1]));
    const total = counts[0] + counts[1] + counts[2];
    if (total >= 2) {
      let r = Math.random() * total;
      for (let i = 0; i < 3; i++) {
        r -= counts[i];
        if (r < 0) return CHOICES[i];
      }
    }
    return randomChoice();
  }

  const prediction = preds[bestIdx]!;
  const trustFraction = Math.min(1, (bestRate - NASH_FLOOR) / (TRUST_CEIL - NASH_FLOOR));

  return Math.random() < trustFraction ? prediction : randomChoice();
}

// ─── Coach-mode opponent prediction (WSLS) ────────────────────────────────────
// Opponent's outcome is the inverse of the suggestion outcome

function wsls(lastChoice: Choice, lastOutcome: Outcome): Choice {
  if (lastOutcome === 'win') return lastChoice;
  return CHOICES[(CHOICES.indexOf(lastChoice) + 1) % 3];
}

function predictOpponent(rounds: Round[]): Choice {
  if (rounds.length === 0) return randomChoice();
  const last = rounds[rounds.length - 1];
  const opponentOutcome: Outcome =
    last.outcome === 'win' ? 'lose' : last.outcome === 'lose' ? 'win' : 'tie';
  if (opponentOutcome !== 'tie') return wsls(last.humanChoice, opponentOutcome);
  return randomChoice();
}

// ─── Series outcome helpers ───────────────────────────────────────────────────

function computeWinner(
  humanScore: number,
  aiScore: number,
  roundCount: number
): GameState['seriesWinner'] | null {
  if (roundCount < TOTAL_ROUNDS) return null;
  if (humanScore > aiScore) return 'human';
  if (aiScore > humanScore) return 'ai';
  return 'tie';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createGame(mode: Mode = 'vs-ai'): GameState {
  return { mode, rounds: [], humanScore: 0, aiScore: 0, seriesOver: false, seriesWinner: null };
}

export function computeAiChoice(rounds: Round[]): Choice {
  return beatOf(predictHuman(rounds));
}

// Apply a round where the AI choice was already committed up-front
export function finalizeRound(
  state: GameState,
  humanChoice: Choice,
  aiChoice: Choice
): { newState: GameState; outcome: Outcome } {
  if (state.seriesOver || state.rounds.length >= TOTAL_ROUNDS) {
    return { newState: state, outcome: 'tie' };
  }
  const outcome = outcomeFor(humanChoice, aiChoice);
  const newRound = { humanChoice, aiChoice, outcome };
  updateMemory([...state.rounds, newRound]);
  // Ties don't count as a round — only wins/losses advance the round counter
  const rounds = outcome === 'tie' ? state.rounds : [...state.rounds, newRound];
  const humanScore = state.humanScore + (outcome === 'win' ? 1 : 0);
  const aiScore = state.aiScore + (outcome === 'lose' ? 1 : 0);
  const seriesOver = rounds.length >= TOTAL_ROUNDS;
  return {
    newState: {
      ...state,
      rounds,
      humanScore,
      aiScore,
      seriesOver,
      seriesWinner: computeWinner(humanScore, aiScore, rounds.length),
    },
    outcome,
  };
}

export function playRound(
  state: GameState,
  humanChoice: Choice
): { newState: GameState; aiChoice: Choice; outcome: Outcome } {
  if (state.seriesOver || state.rounds.length >= TOTAL_ROUNDS) {
    return { newState: state, aiChoice: 'rock', outcome: 'tie' };
  }
  const aiChoice = computeAiChoice(state.rounds);
  const outcome = outcomeFor(humanChoice, aiChoice);
  const newRound = { humanChoice, aiChoice, outcome };
  updateMemory([...state.rounds, newRound]);
  // Ties don't count as a round — only wins/losses advance the round counter
  const rounds = outcome === 'tie' ? state.rounds : [...state.rounds, newRound];
  const humanScore = state.humanScore + (outcome === 'win' ? 1 : 0);
  const aiScore = state.aiScore + (outcome === 'lose' ? 1 : 0);
  const seriesOver = rounds.length >= TOTAL_ROUNDS;
  return {
    newState: {
      ...state,
      rounds,
      humanScore,
      aiScore,
      seriesOver,
      seriesWinner: computeWinner(humanScore, aiScore, rounds.length),
    },
    aiChoice,
    outcome,
  };
}

export function computeCoachSuggestion(rounds: Round[]): Choice {
  return beatOf(predictOpponent(rounds));
}

export function recordCoachRound(
  state: GameState,
  opponentChoice: Choice,
  suggestion: Choice
): GameState {
  if (state.seriesOver || state.rounds.length >= TOTAL_ROUNDS) return state;
  const outcome = outcomeFor(suggestion, opponentChoice);
  const newRound = { humanChoice: opponentChoice, aiChoice: suggestion, outcome };
  // Ties don't count as a round — only wins/losses advance the round counter
  const rounds = outcome === 'tie' ? state.rounds : [...state.rounds, newRound];
  const humanScore = state.humanScore + (outcome === 'win' ? 1 : 0);
  const seriesOver = rounds.length >= TOTAL_ROUNDS;
  const seriesWinner: GameState['seriesWinner'] = seriesOver
    ? humanScore >= 8
      ? 'human'
      : 'ai'
    : null;
  return { ...state, rounds, humanScore, seriesOver, seriesWinner };
}

export function getRecord(): { wins: number; losses: number } {
  try {
    const s = localStorage.getItem('rps-record');
    if (s) return JSON.parse(s) as { wins: number; losses: number };
  } catch {
    /* empty */
  }
  return { wins: 0, losses: 0 };
}

export function saveResult(winner: 'human' | 'ai' | 'tie'): void {
  const r = getRecord();
  if (winner === 'human') r.wins++;
  else if (winner === 'ai') r.losses++;
  try {
    localStorage.setItem('rps-record', JSON.stringify(r));
  } catch {
    /* empty */
  }
}
