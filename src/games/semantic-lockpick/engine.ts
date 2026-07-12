export interface WordEntry {
  word: string;
  vector: readonly number[];
}

export interface Puzzle {
  id: string;
  target: WordEntry;
  neighbors: RankedWord[];
}

export interface RankedWord {
  word: string;
  rank: number;
  score: number;
  heat: number;
}

export interface GuessResult extends RankedWord {
  exact: boolean;
  label: 'LOCKED' | 'BURNING' | 'HOT' | 'WARM' | 'SIGNAL' | 'COLD';
}

const TARGETS = [
  'orchard',
  'harbor',
  'cipher',
  'market',
  'laboratory',
  'theater',
  'summit',
  'verdict',
  'factory',
  'satellite',
  'library',
  'hospital',
  'galaxy',
  'casino',
  'subway',
] as const;

export const RANK_SPACE_SIZE = 1000;

const WORDS: WordEntry[] = [
  { word: 'orchard', vector: [9.6, 1.4, 7.8, 0.4, 1.7, 0.8, 0.5, 2.1] },
  { word: 'apple', vector: [8.9, 1.1, 9.2, 0.3, 1.0, 0.4, 0.2, 1.1] },
  { word: 'peach', vector: [8.4, 1.0, 8.8, 0.3, 0.8, 0.3, 0.1, 1.0] },
  { word: 'grove', vector: [9.4, 1.0, 5.3, 0.2, 1.2, 0.5, 0.3, 1.9] },
  { word: 'vineyard', vector: [8.6, 1.7, 7.4, 0.4, 1.3, 0.5, 0.2, 2.2] },
  { word: 'harvest', vector: [8.2, 1.5, 7.6, 0.5, 1.1, 1.8, 0.3, 2.1] },
  { word: 'farmer', vector: [7.8, 1.2, 6.9, 0.3, 0.8, 1.4, 0.4, 3.0] },
  { word: 'meadow', vector: [9.2, 0.8, 3.7, 0.2, 0.8, 0.4, 0.2, 1.4] },
  { word: 'forest', vector: [9.8, 0.4, 2.3, 0.3, 1.1, 0.8, 0.7, 0.9] },
  { word: 'garden', vector: [8.9, 2.0, 5.8, 0.4, 1.0, 0.5, 0.2, 2.5] },

  { word: 'harbor', vector: [3.8, 8.8, 2.1, 1.2, 1.0, 4.4, 1.6, 3.2] },
  { word: 'dock', vector: [3.0, 8.4, 1.7, 1.1, 0.7, 4.7, 1.2, 2.8] },
  { word: 'ship', vector: [2.9, 8.5, 1.4, 1.1, 0.7, 5.2, 1.8, 2.6] },
  { word: 'anchor', vector: [2.7, 8.0, 0.8, 0.9, 0.5, 3.5, 1.6, 2.1] },
  { word: 'marina', vector: [3.9, 8.2, 2.0, 1.0, 0.6, 3.2, 0.8, 3.8] },
  { word: 'lighthouse', vector: [4.5, 8.0, 0.9, 1.5, 1.5, 3.4, 2.3, 2.6] },
  { word: 'tide', vector: [6.0, 7.5, 0.7, 0.5, 2.3, 3.8, 1.0, 1.0] },
  { word: 'bridge', vector: [2.7, 7.5, 0.5, 2.0, 1.0, 4.8, 1.0, 3.7] },
  { word: 'ferry', vector: [2.3, 8.1, 1.0, 1.0, 0.5, 5.8, 1.1, 3.1] },
  { word: 'subway', vector: [0.8, 8.7, 0.4, 3.0, 0.7, 7.2, 1.1, 4.9] },

  { word: 'cipher', vector: [0.5, 1.1, 0.3, 9.6, 7.8, 1.0, 4.2, 1.0] },
  { word: 'encryption', vector: [0.4, 0.8, 0.2, 9.8, 8.1, 0.8, 4.0, 0.8] },
  { word: 'password', vector: [0.2, 1.2, 0.3, 8.7, 5.8, 0.6, 4.7, 1.8] },
  { word: 'decoder', vector: [0.5, 0.9, 0.2, 9.2, 6.7, 1.0, 3.8, 0.8] },
  { word: 'secret', vector: [0.8, 1.3, 0.5, 7.2, 4.7, 0.5, 5.5, 2.0] },
  { word: 'algorithm', vector: [0.3, 0.8, 0.1, 8.5, 8.9, 1.0, 1.7, 0.6] },
  { word: 'firewall', vector: [0.3, 1.4, 0.2, 8.6, 5.8, 0.7, 5.2, 1.0] },
  { word: 'hacker', vector: [0.2, 1.2, 0.2, 8.8, 5.6, 1.2, 7.0, 1.5] },
  { word: 'riddle', vector: [0.9, 0.8, 0.3, 6.2, 5.0, 0.6, 1.9, 2.2] },
  { word: 'signal', vector: [0.8, 3.2, 0.2, 6.8, 7.3, 3.9, 2.0, 1.3] },

  { word: 'market', vector: [1.6, 7.7, 8.1, 1.0, 0.7, 3.0, 1.0, 8.7] },
  { word: 'bazaar', vector: [1.7, 7.6, 7.8, 0.7, 0.5, 2.8, 1.0, 8.2] },
  { word: 'vendor', vector: [1.3, 7.2, 7.7, 0.6, 0.3, 2.4, 0.6, 8.7] },
  { word: 'auction', vector: [0.8, 6.8, 5.2, 0.7, 0.4, 2.5, 1.0, 9.2] },
  { word: 'merchant', vector: [1.0, 6.9, 6.6, 0.7, 0.4, 2.2, 0.7, 9.1] },
  { word: 'currency', vector: [0.3, 5.0, 2.0, 2.0, 1.0, 1.1, 1.0, 9.7] },
  { word: 'grocery', vector: [1.8, 6.6, 8.9, 0.4, 0.4, 1.8, 0.3, 7.3] },
  { word: 'mall', vector: [0.8, 7.4, 5.4, 0.8, 0.3, 2.4, 0.5, 8.2] },
  { word: 'casino', vector: [0.5, 7.6, 2.4, 1.0, 0.9, 2.5, 5.7, 9.2] },
  { word: 'bank', vector: [0.4, 6.1, 1.5, 1.9, 0.7, 1.1, 2.0, 9.8] },

  { word: 'laboratory', vector: [1.0, 2.2, 0.4, 3.0, 9.7, 0.8, 1.8, 2.0] },
  { word: 'experiment', vector: [1.0, 1.8, 0.3, 2.5, 9.4, 1.0, 1.3, 1.6] },
  { word: 'microscope', vector: [0.8, 1.4, 0.2, 2.3, 9.1, 0.3, 0.8, 0.8] },
  { word: 'chemist', vector: [1.0, 1.8, 0.7, 1.8, 8.7, 0.5, 1.4, 2.0] },
  { word: 'formula', vector: [0.4, 0.8, 0.2, 3.8, 9.0, 0.4, 0.6, 0.9] },
  { word: 'reactor', vector: [0.7, 2.7, 0.2, 3.2, 8.4, 1.2, 5.5, 1.0] },
  { word: 'vaccine', vector: [1.2, 2.5, 0.4, 1.8, 8.1, 0.5, 2.0, 3.0] },
  { word: 'hospital', vector: [1.0, 5.5, 1.0, 1.2, 7.2, 1.0, 3.0, 5.0] },
  { word: 'doctor', vector: [0.8, 4.8, 1.1, 0.8, 7.4, 1.0, 1.8, 5.8] },
  { word: 'telescope', vector: [0.5, 1.2, 0.1, 3.8, 8.7, 1.5, 0.7, 0.8] },

  { word: 'theater', vector: [0.7, 6.3, 1.0, 0.6, 0.7, 1.6, 1.2, 7.6] },
  { word: 'stage', vector: [0.5, 5.7, 0.7, 0.6, 0.5, 1.4, 0.8, 7.2] },
  { word: 'actor', vector: [0.4, 5.0, 0.6, 0.5, 0.4, 1.1, 1.0, 7.8] },
  { word: 'drama', vector: [0.5, 4.8, 0.6, 0.4, 0.5, 0.7, 3.2, 7.5] },
  { word: 'opera', vector: [0.6, 5.3, 0.7, 0.4, 0.6, 1.0, 0.8, 8.1] },
  { word: 'curtain', vector: [0.4, 5.0, 0.4, 0.3, 0.2, 0.7, 0.4, 6.4] },
  { word: 'ticket', vector: [0.3, 6.5, 1.5, 0.8, 0.2, 2.2, 0.5, 7.8] },
  { word: 'applause', vector: [0.4, 5.4, 0.5, 0.2, 0.3, 0.8, 0.4, 8.3] },
  { word: 'cinema', vector: [0.4, 6.0, 1.0, 1.2, 0.5, 1.2, 1.0, 7.8] },
  { word: 'gallery', vector: [0.8, 6.0, 0.8, 0.6, 0.6, 1.2, 0.4, 8.0] },

  { word: 'summit', vector: [8.1, 2.2, 0.4, 0.5, 1.8, 6.2, 3.3, 3.0] },
  { word: 'mountain', vector: [9.3, 1.0, 0.3, 0.4, 1.5, 5.4, 3.1, 1.5] },
  { word: 'peak', vector: [8.7, 1.0, 0.2, 0.4, 1.4, 5.7, 2.7, 1.4] },
  { word: 'climber', vector: [8.0, 1.1, 0.4, 0.4, 1.0, 6.8, 4.0, 2.2] },
  { word: 'altitude', vector: [7.6, 0.8, 0.1, 0.7, 3.0, 5.6, 2.5, 1.1] },
  { word: 'expedition', vector: [7.8, 1.8, 0.5, 0.8, 1.3, 7.2, 4.0, 2.6] },
  { word: 'glacier', vector: [9.0, 0.7, 0.1, 0.3, 2.2, 4.0, 3.0, 0.8] },
  { word: 'trail', vector: [8.4, 1.2, 0.5, 0.4, 0.8, 6.0, 1.8, 1.8] },
  { word: 'elevation', vector: [7.5, 0.9, 0.1, 0.6, 2.7, 4.8, 1.8, 1.0] },
  { word: 'compass', vector: [5.8, 2.2, 0.2, 2.2, 2.5, 5.5, 1.6, 1.0] },

  { word: 'verdict', vector: [0.3, 5.4, 0.2, 1.0, 1.0, 0.5, 6.7, 7.0] },
  { word: 'trial', vector: [0.2, 5.2, 0.3, 0.8, 0.8, 0.5, 7.0, 6.6] },
  { word: 'judge', vector: [0.2, 5.2, 0.2, 0.8, 0.6, 0.4, 6.7, 6.7] },
  { word: 'jury', vector: [0.2, 4.9, 0.2, 0.5, 0.5, 0.4, 6.4, 6.9] },
  { word: 'guilty', vector: [0.2, 3.8, 0.2, 0.5, 0.5, 0.3, 8.5, 5.8] },
  { word: 'appeal', vector: [0.3, 4.6, 0.2, 0.8, 0.7, 0.5, 5.5, 6.3] },
  { word: 'evidence', vector: [0.4, 3.8, 0.2, 2.1, 4.0, 0.4, 5.6, 4.8] },
  { word: 'witness', vector: [0.4, 4.0, 0.3, 0.9, 1.0, 0.4, 5.8, 6.1] },
  { word: 'justice', vector: [0.4, 4.8, 0.2, 0.8, 0.7, 0.3, 5.2, 7.0] },
  { word: 'prison', vector: [0.2, 4.8, 0.2, 0.5, 0.4, 0.5, 8.4, 4.8] },

  { word: 'factory', vector: [0.7, 6.8, 2.2, 4.8, 5.0, 5.5, 2.2, 6.0] },
  { word: 'machine', vector: [0.4, 5.8, 0.8, 6.0, 5.5, 4.8, 1.8, 3.8] },
  { word: 'assembly', vector: [0.5, 6.2, 1.6, 4.4, 4.4, 4.7, 1.0, 5.3] },
  { word: 'robot', vector: [0.3, 4.8, 0.3, 8.3, 6.0, 4.0, 1.8, 2.5] },
  { word: 'warehouse', vector: [0.6, 7.0, 2.2, 2.8, 2.2, 4.5, 1.3, 6.8] },
  { word: 'engine', vector: [0.5, 4.8, 0.3, 6.5, 5.2, 5.3, 1.8, 2.8] },
  { word: 'steel', vector: [0.4, 4.2, 0.2, 4.7, 4.0, 2.8, 1.7, 3.0] },
  { word: 'conveyor', vector: [0.3, 5.8, 0.6, 5.2, 3.8, 6.3, 1.2, 4.2] },
  { word: 'prototype', vector: [0.5, 2.8, 0.3, 5.5, 7.0, 2.2, 1.5, 2.7] },
  { word: 'circuit', vector: [0.2, 2.8, 0.1, 8.0, 6.8, 1.8, 1.5, 1.5] },

  { word: 'satellite', vector: [1.5, 2.2, 0.1, 8.0, 8.7, 6.6, 1.2, 1.5] },
  { word: 'orbit', vector: [2.0, 1.2, 0.1, 6.8, 8.5, 7.0, 0.9, 0.8] },
  { word: 'rocket', vector: [1.8, 1.8, 0.2, 6.7, 8.0, 8.4, 4.0, 1.0] },
  { word: 'antenna', vector: [0.8, 2.8, 0.1, 7.8, 7.2, 4.5, 0.8, 1.2] },
  { word: 'telemetry', vector: [0.5, 2.3, 0.1, 8.2, 8.3, 4.0, 0.8, 1.0] },
  { word: 'planet', vector: [4.5, 1.0, 0.1, 2.8, 7.8, 4.5, 0.8, 0.7] },
  { word: 'galaxy', vector: [3.8, 0.8, 0.1, 2.8, 8.5, 5.2, 0.8, 0.5] },
  { word: 'astronaut', vector: [2.5, 1.8, 0.2, 4.8, 8.2, 7.3, 2.0, 2.0] },
  { word: 'meteor', vector: [4.2, 0.8, 0.1, 2.7, 7.4, 6.4, 3.8, 0.5] },
  { word: 'navigation', vector: [1.8, 3.8, 0.2, 5.8, 5.8, 6.8, 1.0, 2.0] },

  { word: 'library', vector: [0.8, 5.8, 0.4, 2.8, 6.2, 0.5, 0.3, 7.0] },
  { word: 'archive', vector: [0.7, 4.8, 0.2, 3.2, 6.3, 0.4, 0.4, 6.2] },
  { word: 'book', vector: [0.7, 4.8, 0.3, 1.7, 5.5, 0.3, 0.4, 6.8] },
  { word: 'index', vector: [0.4, 3.8, 0.1, 4.5, 6.0, 0.2, 0.2, 4.8] },
  { word: 'catalog', vector: [0.5, 4.2, 0.4, 4.2, 5.5, 0.3, 0.2, 5.5] },
  { word: 'librarian', vector: [0.7, 5.5, 0.3, 1.8, 5.2, 0.4, 0.2, 7.4] },
  { word: 'novel', vector: [0.8, 4.5, 0.3, 0.8, 4.2, 0.3, 1.6, 7.5] },
  { word: 'lecture', vector: [0.7, 4.8, 0.3, 1.8, 6.7, 0.5, 0.4, 7.2] },
  { word: 'school', vector: [1.0, 5.8, 0.7, 1.2, 6.8, 1.0, 0.5, 7.3] },
  { word: 'museum', vector: [1.0, 5.8, 0.6, 0.9, 5.4, 0.8, 0.3, 7.7] },
] as const;

const WORD_BY_NAME = new Map(WORDS.map((entry) => [entry.word, entry]));

const ASSOCIATION_LADDERS: Record<string, readonly string[]> = {
  orchard: [
    'orchard',
    'grove',
    'apple',
    'peach',
    'vineyard',
    'harvest',
    'farmer',
    'garden',
    'meadow',
    'forest',
  ],
  harbor: [
    'harbor',
    'dock',
    'ship',
    'marina',
    'anchor',
    'ferry',
    'lighthouse',
    'tide',
    'bridge',
    'subway',
  ],
  cipher: [
    'cipher',
    'encryption',
    'decoder',
    'password',
    'secret',
    'firewall',
    'hacker',
    'algorithm',
    'riddle',
    'signal',
  ],
  market: [
    'market',
    'bazaar',
    'vendor',
    'merchant',
    'grocery',
    'auction',
    'mall',
    'currency',
    'bank',
    'casino',
  ],
  laboratory: [
    'laboratory',
    'experiment',
    'microscope',
    'chemist',
    'formula',
    'reactor',
    'vaccine',
    'telescope',
    'prototype',
    'doctor',
  ],
  theater: [
    'theater',
    'stage',
    'actor',
    'drama',
    'opera',
    'curtain',
    'applause',
    'ticket',
    'cinema',
    'gallery',
  ],
  summit: [
    'summit',
    'peak',
    'mountain',
    'altitude',
    'climber',
    'expedition',
    'elevation',
    'trail',
    'glacier',
    'compass',
  ],
  verdict: [
    'verdict',
    'trial',
    'judge',
    'jury',
    'guilty',
    'appeal',
    'evidence',
    'witness',
    'justice',
    'prison',
  ],
  factory: [
    'factory',
    'assembly',
    'machine',
    'conveyor',
    'warehouse',
    'robot',
    'engine',
    'steel',
    'prototype',
    'circuit',
  ],
  satellite: [
    'satellite',
    'orbit',
    'antenna',
    'telemetry',
    'rocket',
    'navigation',
    'astronaut',
    'planet',
    'galaxy',
    'meteor',
  ],
  library: [
    'library',
    'librarian',
    'book',
    'archive',
    'catalog',
    'index',
    'novel',
    'lecture',
    'school',
    'museum',
  ],
  hospital: [
    'hospital',
    'doctor',
    'vaccine',
    'chemist',
    'laboratory',
    'trial',
    'evidence',
    'school',
    'market',
    'library',
  ],
  galaxy: [
    'galaxy',
    'planet',
    'meteor',
    'telescope',
    'astronaut',
    'satellite',
    'orbit',
    'rocket',
    'navigation',
    'signal',
  ],
  casino: [
    'casino',
    'bank',
    'currency',
    'auction',
    'market',
    'mall',
    'ticket',
    'theater',
    'guilty',
    'prison',
  ],
  subway: [
    'subway',
    'ferry',
    'bridge',
    'navigation',
    'dock',
    'harbor',
    'mall',
    'ticket',
    'market',
    'warehouse',
  ],
};

function centeredCosine(a: readonly number[], b: readonly number[]): number {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] - meanA;
    const bv = b[i] - meanB;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  return dot / Math.sqrt(magA * magB);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function dateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function normalizeGuess(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, '');
}

export function getPuzzle(key = dateKey()): Puzzle {
  const targetWord = TARGETS[hashString(key) % TARGETS.length];
  const target = WORD_BY_NAME.get(targetWord);
  if (!target) throw new Error(`Missing target word: ${targetWord}`);
  const neighbors = rankWords(target.word);
  return { id: key, target, neighbors };
}

export function listWords(): string[] {
  return WORDS.map((entry) => entry.word);
}

export function rankWords(targetWord: string): RankedWord[] {
  const target = WORD_BY_NAME.get(targetWord);
  if (!target) return [];
  const ladder = ASSOCIATION_LADDERS[targetWord] ?? [targetWord];
  const ladderSet = new Set(ladder);
  const ladderEntries = ladder
    .filter((word) => WORD_BY_NAME.has(word))
    .map((word, index) => ({
      word,
      score: Math.max(0.62, 1 - index * 0.045),
      rank: index === 0 ? 1 : index + 1,
    }));
  const fallbackEntries = WORDS.filter((entry) => !ladderSet.has(entry.word))
    .map((entry) => ({
      word: entry.word,
      score: Math.min(0.28, Math.max(-0.35, centeredCosine(entry.vector, target.vector) * 0.25)),
    }))
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
    .map((entry, index) => ({
      ...entry,
      rank: 200 + Math.round((index / Math.max(1, WORDS.length - ladderEntries.length - 1)) * 800),
    }));

  return [...ladderEntries, ...fallbackEntries].map((entry) => ({
    ...entry,
    heat: 1 - (entry.rank - 1) / (RANK_SPACE_SIZE - 1),
  }));
}

export function scoreGuess(targetWord: string, rawGuess: string): GuessResult | null {
  const guess = normalizeGuess(rawGuess);
  if (!WORD_BY_NAME.has(guess)) return null;
  const ranked = rankWords(targetWord).find((entry) => entry.word === guess);
  if (!ranked) return null;
  return {
    ...ranked,
    exact: ranked.rank === 1,
    label: labelForRank(ranked.rank),
  };
}

export function labelForRank(rank: number): GuessResult['label'] {
  if (rank === 1) return 'LOCKED';
  if (rank <= 5) return 'BURNING';
  if (rank <= 12) return 'HOT';
  if (rank <= 28) return 'WARM';
  if (rank <= 120) return 'SIGNAL';
  return 'COLD';
}

export function formatScore(score: number): string {
  return score.toFixed(3);
}

export function getStarterWords(): string[] {
  return ['forest', 'mall', 'password', 'doctor', 'stage', 'mountain', 'robot', 'book'];
}
