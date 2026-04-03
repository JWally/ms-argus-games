// Ball Sort engine
//
// Each tube holds up to TUBE_CAPACITY balls.  Clicking a tube selects it;
// clicking again pours the top consecutive same-colored group into the
// destination (if valid).  The puzzle is solved when every tube is either
// empty or filled with a single colour.

export const TUBE_CAPACITY = 4;

export const BALL_COLORS = [
  { name: 'red', hex: '#ef4444' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'green', hex: '#22c55e' },
  { name: 'yellow', hex: '#eab308' },
  { name: 'purple', hex: '#a855f7' },
  { name: 'orange', hex: '#f97316' },
  { name: 'pink', hex: '#ec4899' },
  { name: 'teal', hex: '#14b8a6' },
] as const;

export type ColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Tube = ColorIndex[];

export const DIFFICULTIES = {
  easy: { colors: 5, emptyTubes: 2 },
  medium: { colors: 6, emptyTubes: 1 },
  hard: { colors: 7, emptyTubes: 1 },
} as const;

export type DifficultyKey = keyof typeof DIFFICULTIES;

export interface GameState {
  tubes: Tube[];
  selected: number | null;
  moves: number;
  won: boolean;
  difficulty: DifficultyKey;
  history: Tube[][];
}

// ── Tube helpers ──────────────────────────────────────────────────────

/** Returns the top consecutive group of same-coloured balls, or null if empty. */
export function topGroup(tube: Tube): { color: ColorIndex; count: number } | null {
  if (tube.length === 0) return null;
  const color = tube[tube.length - 1];
  let count = 0;
  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] === color) count++;
    else break;
  }
  return { color, count };
}

export function canPour(tubes: Tube[], from: number, to: number): boolean {
  if (from === to) return false;
  const src = tubes[from];
  const dst = tubes[to];
  if (src.length === 0) return false;

  const group = topGroup(src)!;
  const freeSpace = TUBE_CAPACITY - dst.length;
  if (freeSpace < group.count) return false;
  if (dst.length === 0) return true;
  return dst[dst.length - 1] === group.color;
}

function pour(tubes: Tube[], from: number, to: number): Tube[] {
  const next = tubes.map((t) => [...t]);
  const group = topGroup(next[from])!;
  const balls = next[from].splice(next[from].length - group.count, group.count);
  next[to].push(...balls);
  return next;
}

export function isSolved(tubes: Tube[]): boolean {
  return tubes.every(
    (t) => t.length === 0 || (t.length === TUBE_CAPACITY && t.every((c) => c === t[0]))
  );
}

// ── Puzzle generation ──────────────────────────────────────────────────

function scramble(colors: number, emptyTubes: number): Tube[] {
  // Build a pool of all balls, shuffle it, then fill tubes.
  // This avoids the infinite-recursion trap that occurs when starting from
  // a fully-sorted state and applying group pours: whole colour groups just
  // rotate between positions and the state is always "solved".
  const pool: ColorIndex[] = [];
  for (let c = 0; c < colors; c++) {
    for (let i = 0; i < TUBE_CAPACITY; i++) pool.push(c as ColorIndex);
  }
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const tubes: Tube[] = [];
  for (let i = 0; i < colors; i++) {
    tubes.push(pool.slice(i * TUBE_CAPACITY, (i + 1) * TUBE_CAPACITY) as Tube);
  }
  for (let i = 0; i < emptyTubes; i++) tubes.push([]);

  // Retry on the astronomically unlikely chance the shuffle happens to be sorted
  if (isSolved(tubes)) return scramble(colors, emptyTubes);
  return tubes;
}

export function createGame(difficulty: DifficultyKey): GameState {
  const { colors, emptyTubes } = DIFFICULTIES[difficulty];
  return {
    tubes: scramble(colors, emptyTubes),
    selected: null,
    moves: 0,
    won: false,
    difficulty,
    history: [],
  };
}

// ── Game actions ──────────────────────────────────────────────────────

export function selectTube(state: GameState, idx: number): GameState {
  if (state.won) return state;

  const { tubes, selected } = state;

  if (selected === idx) return { ...state, selected: null }; // deselect

  if (selected === null) {
    if (tubes[idx].length === 0) return state;
    return { ...state, selected: idx };
  }

  // Another tube was selected — try to pour
  if (canPour(tubes, selected, idx)) {
    const newTubes = pour(tubes, selected, idx);
    const won = isSolved(newTubes);
    return {
      ...state,
      tubes: newTubes,
      selected: null,
      moves: state.moves + 1,
      won,
      history: [...state.history, tubes],
    };
  }

  // Invalid pour — switch selection to the clicked tube (if non-empty)
  if (tubes[idx].length > 0) return { ...state, selected: idx };
  return state;
}

export function undoMove(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const prev = state.history[state.history.length - 1];
  return {
    ...state,
    tubes: prev,
    selected: null,
    moves: state.moves - 1,
    won: false,
    history: state.history.slice(0, -1),
  };
}

// ── localStorage ──────────────────────────────────────────────────────

function bestKey(d: DifficultyKey): string {
  return `ball-sort-best-${d}`;
}

export function getBestScore(d: DifficultyKey): number | null {
  const v = localStorage.getItem(bestKey(d));
  return v ? Number(v) : null;
}

export function saveBestScore(d: DifficultyKey, moves: number): void {
  const prev = getBestScore(d);
  if (prev === null || moves < prev) {
    try {
      localStorage.setItem(bestKey(d), String(moves));
    } catch {
      /* storage full */
    }
  }
}
