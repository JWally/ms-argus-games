// ── Seeded fake leaderboard ──────────────────────────────────────────
// Generates deterministic but natural-feeling leaderboard entries.
// Player scores are inserted and persisted in localStorage.

export interface LeaderboardEntry {
  name: string;
  score: number;
  isPlayer: boolean;
}

// ── Seeded random (deterministic per game + date) ───────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// ── Name generation ─────────────────────────────────────────────────

const FIRST_NAMES = [
  'Alex',
  'Sam',
  'Jordan',
  'Casey',
  'Riley',
  'Morgan',
  'Taylor',
  'Quinn',
  'Avery',
  'Blake',
  'Cameron',
  'Drew',
  'Emery',
  'Finley',
  'Harper',
  'Jamie',
  'Kai',
  'Logan',
  'Mika',
  'Noah',
  'Parker',
  'Reese',
  'Sage',
  'Skyler',
];

const SUFFIXES = [
  '99',
  '07',
  '23',
  '42',
  '_x',
  '88',
  '01',
  '77',
  '11',
  '55',
  'XD',
  '!',
  '22',
  '33',
  '_',
  '00',
  '10',
  '21',
];

function generateName(rand: () => number): string {
  const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
  if (rand() < 0.4) {
    const suffix = SUFFIXES[Math.floor(rand() * SUFFIXES.length)];
    return first + suffix;
  }
  return first;
}

// ── Generate fake scores ────────────────────────────────────────────
// `baseScore` = a typical "decent" score for this game
// `lowerIsBetter` = true for time-based games (multiply), false for score-based (flappy)

interface LeaderboardConfig {
  gameId: string;
  baseScore: number;
  lowerIsBetter: boolean;
  count?: number;
  spread?: number; // how spread out scores are (multiplier on baseScore)
}

function generateFakeEntries(config: LeaderboardConfig): LeaderboardEntry[] {
  const { gameId, baseScore, lowerIsBetter, count = 10, spread = 0.6 } = config;

  // Seed from gameId + rotating weekly (so board shifts slightly)
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const seed = hashString(gameId + week);
  const rand = seededRandom(seed);

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < count; i++) {
    const name = generateName(rand);
    // Rank-based score: #1 is best, #10 is worst
    const rankFactor = i / count; // 0 = best, 1 = worst
    const variance = (rand() - 0.5) * spread * 0.3;

    let score: number;
    if (lowerIsBetter) {
      // Time-based: #1 has lowest time, #10 has highest
      // Make early slots very beatable (generous times)
      score = baseScore * (0.7 + rankFactor * spread + variance);
    } else {
      // Score-based: #1 has highest score, #10 has lowest
      score = baseScore * (1.3 - rankFactor * spread + variance);
    }

    score = Math.round(score);
    entries.push({ name, score, isPlayer: false });
  }

  // Sort
  if (lowerIsBetter) {
    entries.sort((a, b) => a.score - b.score);
  } else {
    entries.sort((a, b) => b.score - a.score);
  }

  return entries;
}

// ── Public API ──────────────────────────────────────────────────────

function storageKey(gameId: string): string {
  return `leaderboard-${gameId}`;
}

function getPlayerBest(gameId: string, _lowerIsBetter: boolean): number | null {
  const raw = localStorage.getItem(storageKey(gameId));
  if (!raw) return null;
  const data = JSON.parse(raw);
  return data.best ?? null;
}

function savePlayerBest(gameId: string, score: number, lowerIsBetter: boolean): boolean {
  const key = storageKey(gameId);
  const raw = localStorage.getItem(key);
  const data = raw ? JSON.parse(raw) : {};
  const prev = data.best as number | undefined;

  const improved = prev === undefined || (lowerIsBetter ? score < prev : score > prev);

  if (improved) {
    data.best = score;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* storage full */
    }
  }
  return improved;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  playerRank: number | null; // 1-indexed, null if not on board
  isNewBest: boolean;
}

export function getLeaderboard(config: LeaderboardConfig, playerScore?: number): LeaderboardResult {
  const fakes = generateFakeEntries(config);
  const { gameId, lowerIsBetter } = config;

  // Get player's best (or use current score if better)
  let best = getPlayerBest(gameId, lowerIsBetter);
  let isNewBest = false;

  if (playerScore !== undefined) {
    isNewBest = savePlayerBest(gameId, playerScore, lowerIsBetter);
    if (isNewBest) {
      best = playerScore;
    } else if (best === null) {
      best = playerScore;
    }
  }

  // Build combined leaderboard
  const entries = [...fakes];
  if (best !== null) {
    entries.push({ name: 'You', score: best, isPlayer: true });
  }

  // Sort
  if (lowerIsBetter) {
    entries.sort((a, b) => a.score - b.score);
  } else {
    entries.sort((a, b) => b.score - a.score);
  }

  // Trim to top entries (keep player visible)
  const maxEntries = (config.count ?? 10) + 1;
  const playerIdx = entries.findIndex((e) => e.isPlayer);
  const trimmed = entries.slice(0, maxEntries);

  // If player got bumped off, force them in at the end
  if (best !== null && !trimmed.some((e) => e.isPlayer)) {
    trimmed.pop();
    trimmed.push(entries[playerIdx]);
  }

  const playerRank = trimmed.findIndex((e) => e.isPlayer);

  return {
    entries: trimmed,
    playerRank: playerRank >= 0 ? playerRank + 1 : null,
    isNewBest,
  };
}
