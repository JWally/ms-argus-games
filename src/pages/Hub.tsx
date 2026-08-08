import { useNavigate } from 'react-router-dom';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { SiteShell } from '../components/SiteShell';
import { ScanIcon } from './scan/icons/ScanIcon';

// ── Bootstrap Icons (MIT) ──────────────────────────────────────────────
// https://icons.getbootstrap.com

function Ico({ children, className = 'h-14 w-14' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
    >
      {children}
    </svg>
  );
}

const IcoAtaxx = () => (
  <Ico>
    <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h13A1.5 1.5 0 0 1 16 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5zM1.5 1a.5.5 0 0 0-.5.5V5h4V1zM5 6H1v4h4zm1 4h4V6H6zm-1 1H1v3.5a.5.5 0 0 0 .5.5H5zm1 0v4h4v-4zm5 0v4h3.5a.5.5 0 0 0 .5-.5V11zm0-1h4V6h-4zm0-5h4V1.5a.5.5 0 0 0-.5-.5H11zm-1 0V1H6v4z" />
  </Ico>
);
const IcoBreakout = () => (
  <Ico>
    <path d="M0 .5A.5.5 0 0 1 .5 0h15a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H14v2h1.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H14v2h1.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5H2v-2H.5a.5.5 0 0 1-.5-.5v-3A.5.5 0 0 1 .5 6H2V4H.5a.5.5 0 0 1-.5-.5zM3 4v2h4.5V4zm5.5 0v2H13V4zM3 10v2h4.5v-2zm5.5 0v2H13v-2zM1 1v2h3.5V1zm4.5 0v2h5V1zm6 0v2H15V1zM1 7v2h3.5V7zm4.5 0v2h5V7zm6 0v2H15V7zM1 13v2h3.5v-2zm4.5 0v2h5v-2zm6 0v2H15v-2z" />
  </Ico>
);
const IcoFlappy = () => (
  <Ico>
    <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471z" />
  </Ico>
);
const IcoMultiply = () => (
  <Ico>
    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z" />
  </Ico>
);
const IcoCheckers = () => (
  <Ico>
    <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm8.5 0h-1v4h-4v1h4v4h1V7h4V6h-4z" />
    <circle cx="4" cy="11" r="2.5" />
    <circle cx="12" cy="4" r="2.5" opacity=".5" />
  </Ico>
);
const IcoPegSolitaire = () => (
  <Ico>
    <path d="M2 2a2 2 0 1 1 4 0 2 2 0 0 1-4 0m4 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0m4-7a2 2 0 1 1 4 0 2 2 0 0 1-4 0M2 9a2 2 0 1 1 4 0 2 2 0 0 1-4 0m4 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0m4-7a2 2 0 1 1 4 0 2 2 0 0 1-4 0M4 0a4 4 0 0 0 0 0" />
  </Ico>
);
const IcoConnect4 = () => (
  <Ico>
    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5zM2.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5z" />
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="8" cy="9" r="1.5" />
    <circle cx="11" cy="6" r="1.5" />
    <circle cx="11" cy="12" r="1.5" opacity=".35" />
  </Ico>
);
const IcoColorFlood = () => (
  <Ico>
    <path d="M6.192 2.78c-.458-.677-.927-1.248-1.35-1.643a3 3 0 0 0-.71-.515c-.217-.104-.56-.205-.882-.02-.367.213-.427.63-.43.896-.003.304.064.664.173 1.044.196.687.556 1.528 1.035 2.402L.752 8.22c-.277.277-.269.656-.218.918.055.283.187.593.36.903.348.627.92 1.361 1.626 2.068.707.707 1.441 1.278 2.068 1.626.31.173.62.305.903.36.262.05.64.059.918-.218l5.615-5.615c.118.257.092.512.05.939-.03.292-.068.665-.073 1.176v.123h.003a1 1 0 0 0 1.993 0H14v-.057a1 1 0 0 0-.004-.117c-.055-1.25-.7-2.738-1.86-3.494a4 4 0 0 0-.211-.434c-.349-.626-.92-1.36-1.627-2.067S8.857 3.052 8.23 2.704c-.31-.172-.62-.304-.903-.36-.262-.05-.64-.058-.918.219zM4.16 1.867c.381.356.844.922 1.311 1.632l-.704.705c-.382-.727-.66-1.402-.813-1.938a3.3 3.3 0 0 1-.131-.673q.137.09.337.274m.394 3.965c.54.852 1.107 1.567 1.607 2.033a.5.5 0 1 0 .682-.732c-.453-.422-1.017-1.136-1.564-2.027l1.088-1.088q.081.181.183.365c.349.627.92 1.361 1.627 2.068.706.707 1.44 1.278 2.068 1.626q.183.103.365.183l-4.861 4.862-.068-.01c-.137-.027-.342-.104-.608-.252-.524-.292-1.186-.8-1.846-1.46s-1.168-1.32-1.46-1.846c-.147-.265-.225-.47-.251-.607l-.01-.068zm2.87-1.935a2.4 2.4 0 0 1-.241-.561c.135.033.324.11.562.241.524.292 1.186.8 1.846 1.46.45.45.83.901 1.118 1.31a3.5 3.5 0 0 0-1.066.091 11 11 0 0 1-.76-.694c-.66-.66-1.167-1.322-1.458-1.847z" />
  </Ico>
);
const IcoSpellingBee = () => (
  <Ico>
    <path
      fillRule="evenodd"
      d="M8.5 2a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m-2 2a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5m4 0a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5m-6 1.5A.5.5 0 0 1 5 6v4a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m8 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m-10 1A.5.5 0 0 1 3 7v2a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5m12 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5"
    />
  </Ico>
);
const IcoCardCounter = () => (
  <Ico>
    <path d="M7.184 11.246A3.5 3.5 0 0 1 1 9c0-1.602 1.14-2.633 2.66-4.008C4.986 3.792 6.602 2.33 8 0c1.398 2.33 3.014 3.792 4.34 4.992C13.86 6.367 15 7.398 15 9a3.5 3.5 0 0 1-6.184 2.246 20 20 0 0 0 1.582 2.907c.231.35-.02.847-.438.847H6.04c-.419 0-.67-.497-.438-.847a20 20 0 0 0 1.582-2.907" />
  </Ico>
);
const IcoRPS = () => (
  <Ico>
    <path d="M8.864.046C7.908-.193 7.02.53 6.956 1.466c-.072 1.051-.23 2.016-.428 2.59-.125.36-.479 1.013-1.04 1.639-.557.623-1.282 1.178-2.131 1.41C2.685 7.288 2 7.87 2 8.72v4.001c0 .845.682 1.464 1.448 1.545 1.07.114 1.564.415 2.068.723l.048.03c.272.165.578.348.97.484.397.136.861.217 1.466.217h3.5c.937 0 1.599-.477 1.934-1.064a1.86 1.86 0 0 0 .254-.912c0-.152-.023-.312-.077-.464.201-.263.38-.578.488-.901.11-.33.172-.762.004-1.149.069-.13.12-.269.159-.403.077-.27.113-.568.113-.857 0-.288-.036-.585-.113-.856a2 2 0 0 0-.138-.362 1.9 1.9 0 0 0 .234-1.734c-.206-.592-.682-1.1-1.2-1.272-.847-.282-1.803-.276-2.516-.211a10 10 0 0 0-.443.05 9.4 9.4 0 0 0-.062-4.509A1.38 1.38 0 0 0 9.125.111zM11.5 14.721H8c-.51 0-.863-.069-1.14-.164-.281-.097-.506-.228-.776-.393l-.04-.024c-.555-.339-1.198-.731-2.49-.868-.333-.036-.554-.29-.554-.55V8.72c0-.254.226-.543.62-.65 1.095-.3 1.977-.996 2.614-1.708.635-.71 1.064-1.475 1.238-1.978.243-.7.407-1.768.482-2.85.025-.362.36-.594.667-.518l.262.066c.16.04.258.143.288.255a8.34 8.34 0 0 1-.145 4.725.5.5 0 0 0 .595.644l.003-.001.014-.003.058-.014a9 9 0 0 1 1.036-.157c.663-.06 1.457-.054 2.11.164.175.058.45.3.57.65.107.308.087.67-.266 1.022l-.353.353.353.354c.043.043.105.141.154.315.048.167.075.37.075.581 0 .212-.027.414-.075.582-.05.174-.111.272-.154.315l-.353.353.353.354c.047.047.109.177.005.488a2.2 2.2 0 0 1-.505.805l-.353.353.353.354c.006.005.041.05.041.17a.9.9 0 0 1-.121.416c-.165.288-.503.56-1.066.56z" />
  </Ico>
);
const IcoBattleship = () => (
  <Ico>
    <path d="M6 8a2 2 0 1 1 4 0 2 2 0 0 1-4 0M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8" />
    <path d="M8 3a.5.5 0 0 1 .5.5v1.793l1.854 1.853a.5.5 0 0 1-.708.708L8 6.207V8.5a.5.5 0 0 1-1 0V3.5A.5.5 0 0 1 8 3" />
  </Ico>
);
const IcoBallSort = () => (
  <Ico>
    <path d="M11.5 0a.5.5 0 0 1 0 1H11v5.358l4.497 7.36A1.5 1.5 0 0 1 14.214 16H1.786a1.5 1.5 0 0 1-1.283-2.282L5 6.358V1h-.5a.5.5 0 0 1 0-1zm-1 1H5.5v5.5a.5.5 0 0 1-.058.233L1.277 14.08a.5.5 0 0 0 .428.92h12.59a.5.5 0 0 0 .427-.92L10.558 6.733A.5.5 0 0 1 10.5 6.5z" />
    <circle cx="7" cy="11" r="1.5" />
    <circle cx="10" cy="13" r="1.5" opacity=".6" />
    <circle cx="7" cy="14.5" r="1" opacity=".3" />
  </Ico>
);
const IcoGo = () => (
  <Ico>
    <rect x="1" y="1" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1" />
    <line x1="1" y1="4.5" x2="15" y2="4.5" stroke="currentColor" strokeWidth=".4" />
    <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth=".4" />
    <line x1="1" y1="11.5" x2="15" y2="11.5" stroke="currentColor" strokeWidth=".4" />
    <line x1="4.5" y1="1" x2="4.5" y2="15" stroke="currentColor" strokeWidth=".4" />
    <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth=".4" />
    <line x1="11.5" y1="1" x2="11.5" y2="15" stroke="currentColor" strokeWidth=".4" />
    <circle cx="4.5" cy="4.5" r=".9" fill="currentColor" />
    <circle cx="11.5" cy="4.5" r=".9" fill="currentColor" />
    <circle cx="8" cy="8" r=".9" fill="currentColor" />
    <circle cx="4.5" cy="11.5" r=".9" fill="currentColor" />
    <circle cx="11.5" cy="11.5" r=".9" fill="currentColor" />
  </Ico>
);
const IcoTicTacToe = () => (
  <Ico>
    <line x1="5.5" y1="0" x2="5.5" y2="16" stroke="currentColor" strokeWidth=".9" fill="none" />
    <line x1="10.5" y1="0" x2="10.5" y2="16" stroke="currentColor" strokeWidth=".9" fill="none" />
    <line x1="0" y1="5.5" x2="16" y2="5.5" stroke="currentColor" strokeWidth=".9" fill="none" />
    <line x1="0" y1="10.5" x2="16" y2="10.5" stroke="currentColor" strokeWidth=".9" fill="none" />
    <line
      x1="1.5"
      y1="1.5"
      x2="4"
      y2="4"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      fill="none"
    />
    <line
      x1="4"
      y1="1.5"
      x2="1.5"
      y2="4"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth=".9" fill="none" />
    <line
      x1="12"
      y1="12"
      x2="14.5"
      y2="14.5"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      fill="none"
    />
    <line
      x1="14.5"
      y1="12"
      x2="12"
      y2="14.5"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      fill="none"
    />
  </Ico>
);
const IcoHanoi = () => (
  <Ico>
    <line x1="8" y1="1" x2="8" y2="13" stroke="currentColor" strokeWidth=".8" fill="none" />
    <line x1="3" y1="5" x2="3" y2="13" stroke="currentColor" strokeWidth=".8" fill="none" />
    <line x1="13" y1="7" x2="13" y2="13" stroke="currentColor" strokeWidth=".8" fill="none" />
    <rect x="5.5" y="4" width="5" height="2" rx="1" fill="currentColor" />
    <rect x="2" y="7" width="12" height="2" rx="1" fill="currentColor" opacity=".7" />
    <rect x="0" y="10" width="16" height="2" rx="1" fill="currentColor" opacity=".45" />
    <line x1="0" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth=".9" fill="none" />
  </Ico>
);
const IcoProxy = () => (
  <Ico>
    <path d="M8 0 1.5 2.5v4.2c0 4.1 2.7 7.8 6.5 9.3 3.8-1.5 6.5-5.2 6.5-9.3V2.5zm0 1.1 5.5 2.1v3.5c0 3.5-2.2 6.7-5.5 8.2-3.3-1.5-5.5-4.7-5.5-8.2V3.2z" />
    <path d="M4.3 7.5h7.4v1H4.3zm5.1-2.2 2.5 2.7-2.5 2.7-.7-.7 1.8-2-1.8-2z" />
  </Ico>
);

// ── Game definitions ───────────────────────────────────────────────────

type TagKey = 'Arcade' | 'Strategy' | 'Puzzle' | 'Brain' | 'Diagnostic';

interface Game {
  id: string;
  name: string;
  desc: string;
  tag: TagKey;
  path: string;
  Icon: () => ReactElement;
  special?: boolean; // render custom art instead of icon
  external?: boolean; // path is an absolute URL; open via window.location
}

const games: Game[] = [
  {
    id: 'ataxx',
    name: 'Ataxx',
    desc: 'Clone & conquer the board',
    tag: 'Strategy',
    path: '/ataxx',
    Icon: IcoAtaxx,
  },
  {
    id: 'breakout',
    name: 'Breakout',
    desc: 'Smash bricks, chain combos',
    tag: 'Arcade',
    path: '/breakout',
    Icon: IcoBreakout,
  },
  {
    id: 'flappy',
    name: 'Flappy Bird',
    desc: 'Tap to flap, dodge pipes',
    tag: 'Arcade',
    path: '/flappy',
    Icon: IcoFlappy,
  },
  {
    id: 'multiply',
    name: 'Multiply',
    desc: 'Speed-run your times tables',
    tag: 'Brain',
    path: '/multiply',
    Icon: IcoMultiply,
    special: true,
  },
  {
    id: 'checkers',
    name: 'Checkers',
    desc: 'Jump & king on a 6×6 board',
    tag: 'Strategy',
    path: '/checkers',
    Icon: IcoCheckers,
  },
  {
    id: 'peg-solitaire',
    name: 'Peg Solitaire',
    desc: 'Jump pegs, leave just one',
    tag: 'Puzzle',
    path: '/peg-solitaire',
    Icon: IcoPegSolitaire,
  },
  {
    id: 'connect-4',
    name: 'Connect 4',
    desc: 'Outsmart the AI, drop four',
    tag: 'Strategy',
    path: '/connect-4',
    Icon: IcoConnect4,
  },
  {
    id: 'color-flood',
    name: 'Color Flood',
    desc: 'Flood-fill in fewest moves',
    tag: 'Puzzle',
    path: '/color-flood',
    Icon: IcoColorFlood,
  },
  {
    id: 'spelling-bee',
    name: 'Spelling Bee',
    desc: 'Listen, spell, repeat',
    tag: 'Brain',
    path: '/spelling-bee',
    Icon: IcoSpellingBee,
  },
  {
    id: 'card-counter',
    name: 'Card Counter',
    desc: 'Card counting tutor',
    tag: 'Brain',
    path: '/card-counter',
    Icon: IcoCardCounter,
  },
  {
    id: 'rps',
    name: 'Rock Paper Scissors',
    desc: 'AI reads your patterns \xB7 best of 15',
    tag: 'Brain',
    path: '/rps',
    Icon: IcoRPS,
  },
  {
    id: 'battleship',
    name: 'Battleship',
    desc: 'Hunt & sink the enemy fleet',
    tag: 'Strategy',
    path: '/battleship',
    Icon: IcoBattleship,
  },
  {
    id: 'ball-sort',
    name: 'Ball Sort',
    desc: 'Pour matching colours, tube by tube',
    tag: 'Puzzle',
    path: '/ball-sort',
    Icon: IcoBallSort,
  },
  {
    id: 'go',
    name: 'Go',
    desc: 'Surround, capture, conquer the grid',
    tag: 'Strategy',
    path: '/go',
    Icon: IcoGo,
  },
  {
    id: 'tic-tac-toe',
    name: 'Tic-Tac-Toe',
    desc: 'Beat the unbeatable AI · or draw',
    tag: 'Strategy',
    path: '/tic-tac-toe',
    Icon: IcoTicTacToe,
  },
  {
    id: 'hanoi-hilton',
    name: 'Tower of Hanoi',
    desc: 'Move the tower in par moves',
    tag: 'Puzzle',
    path: '/hanoi-hilton',
    Icon: IcoHanoi,
  },
  {
    id: 'proxy-or-not',
    name: 'Proxy or Not',
    desc: 'Call your connection before we do',
    tag: 'Diagnostic',
    path: '/proxy-or-not',
    Icon: IcoProxy,
  },
  {
    id: 'scan',
    name: 'BOT-BUSTER',
    desc: 'Run diagnostic. See what we see.',
    tag: 'Diagnostic',
    path: '/bot-buster',
    Icon: ScanIcon,
  },
];

// ── Tag styling ────────────────────────────────────────────────────────

const TAG_CFG: Record<TagKey, { color: string; border: string; bg: string; label: string }> = {
  Arcade: { color: '#4ade80', border: '#1a6632', bg: '#0a2a14', label: 'ARCADE' },
  Strategy: { color: '#fbbf24', border: '#78350f', bg: '#1c1206', label: 'STRATEGY' },
  Puzzle: { color: '#22d3ee', border: '#164e63', bg: '#061a1c', label: 'PUZZLE' },
  Brain: { color: '#c4b5fd', border: '#4c3d99', bg: '#120f2a', label: 'BRAIN' },
  Diagnostic: { color: '#94a3b8', border: '#475569', bg: '#0f172a', label: 'SCAN' },
};

const TAG_META: Record<TagKey, [string, string]> = {
  Arcade: ['SOLO RUN', 'CHASE THE HISCORE'],
  Strategy: ['1–2 PLAYERS', '~5 MIN MATCH'],
  Puzzle: ['SOLO', 'PURE LOGIC'],
  Brain: ['SOLO DRILL', 'MUSCLE MEMORY'],
  Diagnostic: ['SCAN MODE', 'INSTANT REPORT'],
};

const BORDER = '1px solid #0f2a18';
const CTA_BORDER = '1px solid #4ade80';
// Muted/faint text — MUTED is the darkest green that still reads on the
// panel background; FAINT is decorative only (rules, glyphs, hints).
const MUTED = '#3f9e68';
const FAINT = '#26714a';

// Module-scope random helpers — kept out of the component body so the
// react-hooks/purity rule doesn't flag in-render Math.random calls. These
// are intentionally fresh per page-load.
function pickFeatured(): Game {
  const playable = games.filter((g) => g.tag !== 'Diagnostic');
  return playable[Math.floor(Math.random() * playable.length)];
}

function pickRandom(pool: Game[]): Game | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Subcomponents ──────────────────────────────────────────────────────

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 py-2" style={{ border: BORDER, background: '#040e07' }}>
      <div
        className="font-display text-base sm:text-lg"
        style={{ color: '#22c55e', textShadow: '0 0 6px #22c55e44' }}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] tracking-widest" style={{ color: MUTED }}>
        {label}
      </div>
    </div>
  );
}

function CabinetCell({ game, onPlay }: { game: Game; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      title={game.name}
      aria-label={`Play ${game.name}`}
      className="group relative flex aspect-square flex-col items-center justify-center gap-2 px-1 transition-all duration-150 hover:border-[#22c55e] hover:[box-shadow:0_0_12px_#22c55e33,inset_0_0_12px_#00000040]"
      style={{ border: BORDER, background: '#040e07' }}
    >
      {game.special ? (
        <span
          className="font-mono text-base font-bold transition-transform group-hover:scale-105 sm:text-xl"
          style={{ color: '#22c55e', filter: 'drop-shadow(0 0 6px #22c55e88)' }}
        >
          2×2=?
        </span>
      ) : (
        <div
          className="scale-[0.95] transition-transform group-hover:scale-[1.02] sm:scale-[1.25] sm:group-hover:scale-[1.35]"
          style={{ color: '#22c55e', filter: 'drop-shadow(0 0 6px #22c55e88)' }}
        >
          <game.Icon />
        </div>
      )}
      <span
        className="max-w-full truncate font-mono text-[9px] tracking-wider sm:mt-1.5"
        style={{ color: MUTED }}
      >
        {game.name.toUpperCase()}
      </span>
    </button>
  );
}

function BrowseRow({ game, onPlay }: { game: Game; onPlay: () => void }) {
  const tag = TAG_CFG[game.tag];
  return (
    <button
      onClick={onPlay}
      aria-label={`Play ${game.name}`}
      className="group flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-150 hover:border-[#22c55e] hover:[box-shadow:0_0_12px_#22c55e22,inset_0_0_12px_#00000040]"
      style={{ border: BORDER, background: '#040e07' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center transition-transform group-hover:scale-110"
        style={{ color: '#22c55e', filter: 'drop-shadow(0 0 4px #22c55e66)' }}
      >
        {game.special ? (
          <span className="font-mono text-[10px] font-bold">2×2=?</span>
        ) : (
          <game.Icon />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-bold tracking-wider" style={{ color: '#86efac' }}>
            {game.name.toUpperCase()}
          </span>
          <span
            className="shrink-0 font-mono text-[10px] font-bold tracking-widest px-1 py-px"
            style={{
              color: tag.color,
              border: `1px solid ${tag.border}`,
              background: tag.bg,
            }}
          >
            [{tag.label}]
          </span>
        </div>
      </div>
      <span className="font-mono text-[10px] tracking-widest" style={{ color: MUTED }}>
        PLAY ▸
      </span>
    </button>
  );
}

// ── Boot prompt ────────────────────────────────────────────────────────

const PROMPT_LINES = [
  'BOOT OK.',
  '',
  'ALL CARTRIDGES LOADED.',
  'NO COINS NEEDED.',
  '',
  'SHALL WE PLAY A GAME?',
] as const;
const TYPE_SPEED_MS = 32;
const LINE_PAUSE_MS = 280;
const INITIAL_DELAY_MS = 200;

function useJoshuaTypewriter(onYes: () => void, onNo: () => void) {
  const [typed, setTyped] = useState<string[]>(() => PROMPT_LINES.map(() => ''));
  const [done, setDone] = useState(false);

  const skipToEnd = useCallback(() => {
    setTyped(PROMPT_LINES.map((l) => l));
    setDone(true);
  }, []);

  // Typewriter — schedules char reveals + completion via setTimeout chain.
  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let elapsedMs = INITIAL_DELAY_MS;

    for (const [i, line] of PROMPT_LINES.entries()) {
      if (line === '') {
        elapsedMs += LINE_PAUSE_MS;
        continue;
      }
      for (let j = 1; j <= line.length; j++) {
        const delay = elapsedMs + j * TYPE_SPEED_MS;
        timeouts.push(
          setTimeout(() => {
            if (cancelled) return;
            setTyped((prev) => {
              if (prev[i] === PROMPT_LINES[i]) return prev;
              const next = [...prev];
              next[i] = line.slice(0, j);
              return next;
            });
          }, delay)
        );
      }
      elapsedMs += line.length * TYPE_SPEED_MS + LINE_PAUSE_MS;
    }

    timeouts.push(
      setTimeout(() => {
        if (!cancelled) setDone(true);
      }, elapsedMs)
    );

    return () => {
      cancelled = true;
      for (const t of timeouts) clearTimeout(t);
    };
  }, []);

  // Keyboard: Y/N route immediately (finishing the typewriter on the way);
  // any other key just skips the typewriter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 'y' || k === 'enter') {
        e.preventDefault();
        skipToEnd();
        onYes();
      } else if (k === 'n' || k === 'escape') {
        e.preventDefault();
        skipToEnd();
        onNo();
      } else if (!done) {
        e.preventDefault();
        skipToEnd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, onYes, onNo, skipToEnd]);

  return { typed, done, skipToEnd };
}

function JoshuaText({
  typed,
  done,
  onSkip,
}: {
  typed: string[];
  done: boolean;
  onSkip: () => void;
}) {
  return (
    <div
      onClick={!done ? onSkip : undefined}
      className="font-mono text-base leading-relaxed sm:text-lg lg:text-xl"
      style={{
        color: '#4ade80',
        textShadow: '0 0 8px #22c55e88',
        cursor: done ? 'default' : 'pointer',
      }}
    >
      {typed.map((line, i) => {
        const isLast = i === typed.length - 1;
        return (
          <div key={i} className="min-h-[1.5em]">
            {line || ' '}
            {isLast && (
              <span
                aria-hidden="true"
                className="terminal-cursor ml-0.5 inline-block align-middle"
                style={{ color: '#4ade80', textShadow: '0 0 8px #22c55e' }}
              >
                █
              </span>
            )}
          </div>
        );
      })}

      {!done && (
        <p className="mt-4 font-mono text-[10px] tracking-widest" style={{ color: FAINT }}>
          [ ANY KEY TO SKIP ]
        </p>
      )}
    </div>
  );
}

function JoshuaActions({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <button
        onClick={onYes}
        className="w-full whitespace-nowrap font-display text-xs tracking-widest transition-all duration-150 hover:[box-shadow:0_0_18px_#22c55e88]"
        style={{
          color: '#0a1f0a',
          background: '#22c55e',
          border: CTA_BORDER,
          padding: '12px 18px',
        }}
      >
        ▶ [Y] PLAY A GAME
      </button>
      <button
        onClick={onNo}
        className="w-full whitespace-nowrap font-display text-xs tracking-widest transition-all duration-150 hover:border-[#22c55e]"
        style={{
          color: '#4ade80',
          background: 'transparent',
          border: '1px solid #1a6632',
          padding: '12px 18px',
        }}
      >
        [N] BROWSE THE LIST
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

const FILTER_KEYS = ['All', 'Arcade', 'Strategy', 'Puzzle', 'Brain', 'Diagnostic'] as const;
const FEATURED_ROTATE_MS = 8000;

export default function Hub() {
  const navigate = useNavigate();
  const [activeTag, setActiveTag] = useState<'All' | TagKey>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const browseRef = useRef<HTMLElement>(null);

  // Featured game — random pick per page-load (module-scope helper keeps
  // Math.random outside render), then rotates through the playable list on
  // a timer. Paused while the cursor is over the card so the PLAY button
  // doesn't move under a hovering mouse.
  const [featured, setFeatured] = useState<Game>(pickFeatured);
  const featuredPausedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (featuredPausedRef.current) return;
      setFeatured((prev) => {
        const playable = games.filter((g) => g.tag !== 'Diagnostic');
        const i = playable.findIndex((g) => g.id === prev.id);
        return playable[(i + 1) % playable.length];
      });
    }, FEATURED_ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const selectTag = (tag: 'All' | TagKey) => {
    setActiveTag(tag);
    setMenuOpen(false);
  };

  const visibleGames = useMemo(
    () =>
      games.filter((g) => {
        const matchTag = activeTag === 'All' || g.tag === activeTag;
        const q = searchQuery.trim().toLowerCase();
        const matchSearch =
          !q || g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q);
        return matchTag && matchSearch;
      }),
    [activeTag, searchQuery]
  );

  const cabinetWall = visibleGames.slice(0, 9);

  const playGame = useCallback(
    (g: Game) => {
      if (g.external) {
        window.location.href = g.path;
      } else {
        navigate(g.path);
      }
    },
    [navigate]
  );

  const playRandom = useCallback(() => {
    // Pool excludes Diagnostic entries, which are the only candidates for
    // `external`, so navigate() is always safe here.
    const choice = pickRandom(visibleGames.filter((g) => g.tag !== 'Diagnostic'));
    if (choice) navigate(choice.path);
  }, [visibleGames, navigate]);

  const browseCabinets = useCallback(() => {
    browseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const { typed, done, skipToEnd } = useJoshuaTypewriter(playRandom, browseCabinets);

  const featuredMeta = TAG_META[featured.tag];
  const featuredTag = TAG_CFG[featured.tag];

  return (
    <SiteShell
      center={
        <div className="hidden items-center gap-1 lg:flex">
          {FILTER_KEYS.map((tag) => {
            const isAll = tag === 'All';
            const cfg = isAll ? null : TAG_CFG[tag as TagKey];
            const isActive = activeTag === tag;
            return (
              <button
                key={tag}
                onClick={() => selectTag(tag)}
                className="rounded-[2px] px-3 py-1.5 font-mono text-xs tracking-widest transition-all duration-150"
                style={
                  isActive
                    ? {
                        color: isAll ? '#4ade80' : cfg!.color,
                        border: `1px solid ${isAll ? '#22c55e' : cfg!.border}`,
                        background: isAll ? '#071a0e' : cfg!.bg,
                      }
                    : {
                        color: MUTED,
                        border: '1px solid transparent',
                        background: 'transparent',
                      }
                }
              >
                {isAll ? 'ALL' : tag.toUpperCase()}
              </button>
            );
          })}
        </div>
      }
      right={
        <>
          <div className="hidden items-center gap-2 lg:flex">
            <button
              onClick={playRandom}
              className="whitespace-nowrap font-display text-[10px] tracking-widest transition-all duration-150 hover:[box-shadow:0_0_12px_#22c55e66]"
              style={{
                color: '#0a1f0a',
                background: '#22c55e',
                border: CTA_BORDER,
                padding: '6px 12px',
              }}
            >
              ▶ PLAY RANDOM
            </button>
            <div
              className="flex items-center gap-2 rounded-[2px] px-3 py-1.5"
              style={{ border: BORDER, background: '#040e07' }}
            >
              <svg
                aria-hidden="true"
                className="h-3 w-3 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: MUTED }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH..."
                className="w-32 bg-transparent font-mono text-xs tracking-wider outline-none"
                style={{ color: '#4ade80' }}
              />
            </div>
          </div>

          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex flex-col items-center justify-center gap-1.5 p-2 lg:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: '#4ade80' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <>
                <span className="block h-px w-5" style={{ background: '#4ade80' }} />
                <span className="block h-px w-5" style={{ background: '#4ade80' }} />
                <span className="block h-px w-5" style={{ background: '#4ade80' }} />
              </>
            )}
          </button>
        </>
      }
      below={
        menuOpen ? (
          <div className="lg:hidden" style={{ borderTop: BORDER, background: '#030c06' }}>
            <div className="px-4 py-3" style={{ borderBottom: BORDER }}>
              <div
                className="flex items-center gap-2 rounded-[2px] px-3 py-2"
                style={{ border: BORDER, background: '#040e07' }}
              >
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  style={{ color: '#1a6632' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="SEARCH GAMES..."
                  className="w-full bg-transparent font-mono text-sm tracking-wider outline-none"
                  style={{ color: '#4ade80' }}
                />
              </div>
            </div>

            {FILTER_KEYS.map((tag) => {
              const isActive = activeTag === tag;
              const label = tag === 'All' ? 'ALL GAMES' : tag.toUpperCase();
              const count =
                tag === 'All' ? games.length : games.filter((g) => g.tag === tag).length;
              return (
                <button
                  key={tag}
                  onClick={() => selectTag(tag)}
                  className="flex w-full items-center gap-3 px-5 py-4 transition-colors duration-150"
                  style={{
                    borderBottom: '1px solid #0a1e0f',
                    background: isActive ? '#071a0e' : 'transparent',
                    borderLeft: isActive ? '3px solid #22c55e' : '3px solid transparent',
                  }}
                >
                  <span
                    className="font-mono text-base tracking-widest"
                    style={{ color: isActive ? '#4ade80' : MUTED }}
                  >
                    {label}
                  </span>
                  <span
                    className="ml-auto font-mono text-xs"
                    style={{ color: isActive ? '#4ade80' : FAINT }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : undefined
      }
    >
      {/* Status line */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
        <p className="font-mono text-[10px] tracking-widest" style={{ color: MUTED }}>
          ▶ TERMINAL READY · {games.length} GAMES LOADED · HUMANS WELCOME
        </p>
      </div>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-10 lg:pt-10">
        {/* LEFT — console monitor + actions/stats pinned to bottom */}
        <div className="flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-xs tracking-widest" style={{ color: '#86efac' }}>
              ARCADES.CLICK
            </span>
            <span className="font-mono text-[10px] tracking-widest" style={{ color: MUTED }}>
              [CH·01 LIVE]
            </span>
          </div>
          <div
            className="relative flex-1 overflow-hidden p-4 sm:p-5"
            style={{ border: BORDER, background: '#040e07' }}
          >
            <div
              aria-hidden="true"
              className="crt-console-lines pointer-events-none absolute inset-0"
            />
            <div
              aria-hidden="true"
              className="crt-rollbar pointer-events-none absolute inset-x-0"
            />
            <JoshuaText typed={typed} done={done} onSkip={skipToEnd} />
          </div>

          <div className="mt-4 flex w-full flex-col gap-4">
            <JoshuaActions onYes={playRandom} onNo={browseCabinets} />
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
              <StatBlock value="FREE" label="EVERY GAME · NO ADS" />
              <StatBlock value="ZERO" label="SIGNUPS · INSTALLS" />
              <StatBlock value="ONE" label="QUICK HUMAN CHECK" />
              <StatBlock value={String(games.length)} label="GAMES READY" />
            </div>
          </div>
        </div>

        {/* RIGHT — game wall */}
        <div className="mt-10 lg:mt-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-xs tracking-widest" style={{ color: '#86efac' }}>
              GAME WALL
            </span>
            <span className="font-mono text-[10px] tracking-widest" style={{ color: MUTED }}>
              [{visibleGames.length} ONLINE]
            </span>
          </div>
          {cabinetWall.length === 0 ? (
            <div
              className="flex aspect-[3/1] items-center justify-center font-mono text-xs tracking-widest"
              style={{ border: BORDER, background: '#040e07', color: MUTED }}
            >
              NO GAMES MATCH FILTER
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {cabinetWall.map((g) => (
                <CabinetCell key={g.id} game={g} onPlay={() => playGame(g)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured game */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="font-display text-xs tracking-widest" style={{ color: '#86efac' }}>
            NOW SHOWING
          </span>
          <span className="h-px flex-1" style={{ background: '#0f2a18' }} />
          <span className="font-mono text-[10px] tracking-widest" style={{ color: FAINT }}>
            AUTO-CYCLES · HOVER TO HOLD
          </span>
        </div>
        <div
          key={featured.id}
          className="featured-swap grid gap-4 sm:gap-6 lg:grid-cols-[2fr_3fr]"
          style={{ border: BORDER, background: '#040e07', padding: 0 }}
          onMouseEnter={() => {
            featuredPausedRef.current = true;
          }}
          onMouseLeave={() => {
            featuredPausedRef.current = false;
          }}
        >
          {/* Featured art */}
          <div
            className="relative flex h-48 items-center justify-center sm:h-64"
            style={{ background: '#030c06', borderRight: '1px solid #0f2a18' }}
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, #22c55e1a, transparent 65%)',
                }}
              />
              <div
                className="absolute rounded-full"
                style={{ width: 180, height: 180, border: '1px solid #0f2a1866' }}
              />
              <div
                className="absolute rounded-full"
                style={{ width: 120, height: 120, border: '1px solid #0f2a1844' }}
              />
            </div>
            {featured.special ? (
              <span
                className="relative font-mono text-3xl font-bold sm:text-4xl"
                style={{ color: '#22c55e', filter: 'drop-shadow(0 0 10px #22c55e88)' }}
              >
                2 × 2 = ?
              </span>
            ) : (
              <div
                className="relative scale-[3.2]"
                style={{ color: '#22c55e', filter: 'drop-shadow(0 0 10px #22c55e88)' }}
              >
                <featured.Icon />
              </div>
            )}
          </div>
          {/* Featured copy */}
          <div className="flex flex-col justify-between p-5 sm:p-6">
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="font-display text-xl tracking-widest sm:text-2xl"
                  style={{ color: '#4ade80', textShadow: '0 0 8px #22c55e88' }}
                >
                  {featured.name.toUpperCase()}
                </h2>
                <span
                  className="font-mono text-xs font-bold tracking-widest px-1.5 py-0.5"
                  style={{
                    color: featuredTag.color,
                    border: `1px solid ${featuredTag.border}`,
                    background: featuredTag.bg,
                  }}
                >
                  [{featuredTag.label}]
                </span>
              </div>
              <p className="mt-3 font-mono text-sm leading-relaxed" style={{ color: '#86efac' }}>
                {featured.desc}
              </p>
              <ul
                className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px] tracking-widest"
                style={{ color: MUTED }}
              >
                <li>· {featuredMeta[0]}</li>
                <li>· {featuredMeta[1]}</li>
                <li>· WEB · NO INSTALL</li>
                <li>· INSTANT PLAY</li>
              </ul>
            </div>
            <button
              onClick={() => navigate(featured.path)}
              className="mt-5 font-display text-xs tracking-widest transition-all duration-150 hover:[box-shadow:0_0_18px_#22c55e88]"
              style={{
                color: '#0a1f0a',
                background: '#22c55e',
                border: CTA_BORDER,
                padding: '12px 16px',
              }}
            >
              ▶ PLAY {featured.name.toUpperCase()}
            </button>
          </div>
        </div>
      </section>

      {/* Browse all */}
      <section ref={browseRef} className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="font-display text-xs tracking-widest" style={{ color: '#86efac' }}>
            BROWSE ALL GAMES
          </span>
          <span className="h-px flex-1" style={{ background: '#0f2a18' }} />
          <span className="font-mono text-[10px] tracking-widest" style={{ color: MUTED }}>
            {visibleGames.length} / {games.length}
          </span>
        </div>
        {visibleGames.length === 0 ? (
          <div
            className="flex h-32 items-center justify-center font-mono text-xs tracking-widest"
            style={{ border: BORDER, background: '#040e07', color: MUTED }}
          >
            NO MATCHES · ADJUST FILTER OR SEARCH
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGames.map((g) => (
              <BrowseRow key={g.id} game={g} onPlay={() => playGame(g)} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer
        className="mt-auto px-4 py-4 text-center font-mono text-[10px] tracking-widest"
        style={{ borderTop: BORDER, color: FAINT }}
      >
        ▮ EOF · {games.length} GAMES · NO QUARTERS REQUIRED · COME BACK SOON
      </footer>
    </SiteShell>
  );
}
