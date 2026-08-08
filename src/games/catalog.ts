// ── Game catalog ──────────────────────────────────────────────────────
// Lightweight registry used by the GameCabinet shell (MORE GAMES rail).
// Hub.tsx still owns the rich list (descriptions, icons); keep the two in
// sync until Hub is refactored to consume this catalog.

export type GameTag = 'Arcade' | 'Strategy' | 'Puzzle' | 'Brain' | 'Diagnostic';

export const TAG_STYLE: Record<GameTag, { color: string; border: string; bg: string }> = {
  Arcade: { color: '#4ade80', border: '#1a6632', bg: '#0a2a14' },
  Strategy: { color: '#fbbf24', border: '#78350f', bg: '#1c1206' },
  Puzzle: { color: '#22d3ee', border: '#164e63', bg: '#061a1c' },
  Brain: { color: '#c4b5fd', border: '#4c3d99', bg: '#120f2a' },
  Diagnostic: { color: '#94a3b8', border: '#475569', bg: '#0f172a' },
};

export interface GameLink {
  id: string;
  name: string;
  path: string;
  tag: GameTag;
}

export const GAME_LINKS: GameLink[] = [
  { id: 'ataxx', name: 'Ataxx', path: '/ataxx', tag: 'Strategy' },
  { id: 'breakout', name: 'Breakout', path: '/breakout', tag: 'Arcade' },
  { id: 'flappy', name: 'Flappy Bird', path: '/flappy', tag: 'Arcade' },
  { id: 'multiply', name: 'Multiply', path: '/multiply', tag: 'Brain' },
  { id: 'checkers', name: 'Checkers', path: '/checkers', tag: 'Strategy' },
  { id: 'peg-solitaire', name: 'Peg Solitaire', path: '/peg-solitaire', tag: 'Puzzle' },
  { id: 'connect-4', name: 'Connect 4', path: '/connect-4', tag: 'Strategy' },
  { id: 'color-flood', name: 'Color Flood', path: '/color-flood', tag: 'Puzzle' },
  { id: 'spelling-bee', name: 'Spelling Bee', path: '/spelling-bee', tag: 'Brain' },
  { id: 'card-counter', name: 'Card Counter', path: '/card-counter', tag: 'Brain' },
  { id: 'rps', name: 'Rock Paper Scissors', path: '/rps', tag: 'Brain' },
  { id: 'battleship', name: 'Battleship', path: '/battleship', tag: 'Strategy' },
  { id: 'ball-sort', name: 'Ball Sort', path: '/ball-sort', tag: 'Puzzle' },
  { id: 'go', name: 'Go', path: '/go', tag: 'Strategy' },
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', path: '/tic-tac-toe', tag: 'Strategy' },
  { id: 'hanoi', name: 'Tower of Hanoi', path: '/hanoi-hilton', tag: 'Puzzle' },
  { id: 'scan', name: 'BOT-BUSTER', path: '/bot-buster', tag: 'Diagnostic' },
  { id: 'proxy-or-not', name: 'Proxy or Not', path: '/proxy-or-not', tag: 'Diagnostic' },
];
