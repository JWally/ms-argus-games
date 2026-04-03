// ── Spelling Bee game engine ──────────────────────────────────────────

const STORAGE_KEY = 'spelling-bee-lists';
const ACTIVE_LIST_KEY = 'spelling-bee-active';

export interface WordList {
  id: string;
  name: string;
  words: string[];
  createdAt: number;
}

export interface AnsweredWord {
  word: string;
  userAnswer: string;
  correct: boolean;
  timeMs: number;
}

export type GamePhase = 'setup' | 'playing' | 'done';

export interface GameState {
  phase: GamePhase;
  listId: string | null;
  words: string[];
  current: number;
  answered: AnsweredWord[];
  startTime: number;
  wordStartTime: number;
}

// ── Word list persistence ────────────────────────────────────────────

export function getSavedLists(): WordList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveList(name: string, words: string[]): WordList {
  const lists = getSavedLists();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newList: WordList = { id, name, words, createdAt: Date.now() };
  lists.push(newList);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    /* storage full */
  }
  return newList;
}

export function deleteList(id: string): void {
  const lists = getSavedLists().filter((l) => l.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    /* storage full */
  }
  const active = localStorage.getItem(ACTIVE_LIST_KEY);
  if (active === id) localStorage.removeItem(ACTIVE_LIST_KEY);
}

export function getActiveListId(): string | null {
  return localStorage.getItem(ACTIVE_LIST_KEY);
}

export function setActiveListId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_LIST_KEY, id);
  } catch {
    /* storage full */
  }
}

// ── Parse words from raw text ────────────────────────────────────────

export function parseWords(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0 && /^[a-z'-]+$/i.test(w));
}

// ── Game logic ───────────────────────────────────────────────────────

export function startGame(words: string[], listId: string): GameState {
  // Shuffle the words
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const now = Date.now();
  return {
    phase: 'playing',
    listId,
    words: shuffled,
    current: 0,
    answered: [],
    startTime: now,
    wordStartTime: now,
  };
}

export function submitAnswer(state: GameState, userAnswer: string): GameState {
  if (state.phase !== 'playing') return state;

  const word = state.words[state.current];
  const correct = userAnswer.trim().toLowerCase() === word.toLowerCase();
  const now = Date.now();

  const answered: AnsweredWord[] = [
    ...state.answered,
    {
      word,
      userAnswer: userAnswer.trim().toLowerCase(),
      correct,
      timeMs: now - state.wordStartTime,
    },
  ];

  const nextIndex = state.current + 1;
  const done = nextIndex >= state.words.length;

  return {
    ...state,
    current: done ? state.current : nextIndex,
    answered,
    phase: done ? 'done' : 'playing',
    wordStartTime: done ? state.wordStartTime : now,
  };
}

export function skipWord(state: GameState): GameState {
  return submitAnswer(state, '');
}

export function correctCount(state: GameState): number {
  return state.answered.filter((a) => a.correct).length;
}

export function totalTime(state: GameState): number {
  const last = state.answered[state.answered.length - 1];
  if (!last) return 0;
  return state.answered.reduce((sum, a) => sum + a.timeMs, 0);
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  if (m > 0) return `${m}:${sec.toString().padStart(2, '0')}.${tenths}`;
  return `${sec}.${tenths}s`;
}

// ── Text-to-Speech ──────────────────────────────────────────────────

let voicesReady = false;

function ensureVoices(): Promise<void> {
  if (voicesReady) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (voices.length > 0) {
      voicesReady = true;
      resolve();
      return;
    }
    synth.addEventListener(
      'voiceschanged',
      () => {
        voicesReady = true;
        resolve();
      },
      { once: true }
    );
  });
}

// Warm up voices eagerly so they're ready when the user clicks
if ('speechSynthesis' in window) {
  ensureVoices();
}

export async function speakWord(word: string): Promise<void> {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  await ensureVoices();
  synth.cancel();
  // eslint-disable-next-line no-undef
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.lang = 'en-US';
  // Pick an English voice explicitly if available
  const voices = synth.getVoices();
  const english = voices.find((v) => v.lang.startsWith('en') && v.localService);
  if (english) utterance.voice = english;
  synth.speak(utterance);
}
