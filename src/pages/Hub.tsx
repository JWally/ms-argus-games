import { useNavigate } from 'react-router-dom';
import { useState, type ReactElement, type ReactNode } from 'react';
import { useCaptchaGate } from '../hooks/useCaptchaGate';

const taglines = [
  'Insert coin to continue.',
  'No quarters required.',
  'Player one, ready?',
  'The cake is a lie.',
  'All your base are belong to us.',
  'It\u2019s dangerous to go alone!',
  'Do a barrel roll!',
  'Would you like to play a game?',
  'Up up down down left right left right B A start.',
  'The princess is in another castle.',
  'Game over, man. Game over!',
  'Stay awhile and listen.',
  'War. War never changes.',
  'Hey! Listen!',
  'Finish him!',
  'Hadouken!',
  'Thank you, but our princess is in another castle!',
];

// ── Bootstrap Icons (MIT) ──────────────────────────────────────────────
// https://icons.getbootstrap.com

function Ico({ children, className = 'h-10 w-10' }: { children: ReactNode; className?: string }) {
  return (
    <svg
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
const IcoAmaze = () => (
  <Ico>
    <rect x="1" y="1" width="14" height="14" fill="none" stroke="currentColor" strokeWidth=".9" />
    <line x1="1" y1="5.5" x2="9" y2="5.5" stroke="currentColor" strokeWidth=".9" />
    <line x1="6" y1="1" x2="6" y2="5.5" stroke="currentColor" strokeWidth=".9" />
    <line x1="9" y1="5.5" x2="9" y2="10.5" stroke="currentColor" strokeWidth=".9" />
    <line x1="4" y1="10.5" x2="9" y2="10.5" stroke="currentColor" strokeWidth=".9" />
    <line x1="4" y1="10.5" x2="4" y2="15" stroke="currentColor" strokeWidth=".9" />
    <line x1="9" y1="10.5" x2="15" y2="10.5" stroke="currentColor" strokeWidth=".9" />
    <circle cx="2.8" cy="2.8" r="1.3" fill="currentColor" />
  </Ico>
);
const IcoWayfinder = () => (
  <Ico>
    <circle cx="3" cy="4" r="1.6" fill="currentColor" />
    <circle cx="13" cy="3" r="1.6" fill="currentColor" />
    <circle cx="14" cy="11" r="1.6" fill="currentColor" />
    <circle cx="7" cy="14" r="1.6" fill="currentColor" />
    <circle cx="2" cy="11" r="1.6" fill="currentColor" />
    <circle cx="9" cy="7" r="1.3" fill="currentColor" opacity=".6" />
    <line x1="3" y1="4" x2="13" y2="3" stroke="currentColor" strokeWidth=".7" fill="none" />
    <line x1="13" y1="3" x2="14" y2="11" stroke="currentColor" strokeWidth=".7" fill="none" />
    <line x1="14" y1="11" x2="7" y2="14" stroke="currentColor" strokeWidth=".7" fill="none" />
    <line x1="7" y1="14" x2="2" y2="11" stroke="currentColor" strokeWidth=".7" fill="none" />
    <line x1="2" y1="11" x2="3" y2="4" stroke="currentColor" strokeWidth=".7" fill="none" />
  </Ico>
);
const IcoTicketBlaster = () => (
  <Ico>
    <path
      fillRule="evenodd"
      d="M.5 3A.5.5 0 0 0 0 3.5V7a1.5 1.5 0 0 0 0 3v2.5A.5.5 0 0 0 .5 13h15a.5.5 0 0 0 .5-.5V10a1.5 1.5 0 0 0 0-3V3.5A.5.5 0 0 0 15.5 3zM8.5 5 6 9h2L6.5 12l4-5H8.5z"
    />
  </Ico>
);

// ── Game definitions ───────────────────────────────────────────────────

type TagKey = 'Arcade' | 'Strategy' | 'Puzzle' | 'Brain';

interface Game {
  id: string;
  name: string;
  desc: string;
  tag: TagKey;
  path: string;
  Icon: () => ReactElement;
  special?: boolean; // render custom art instead of icon
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
    desc: 'Jump & king on a 6\u00D76 board',
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
    name: 'Hanoi Hilton',
    desc: 'Move the tower in par moves',
    tag: 'Puzzle',
    path: '/hanoi-hilton',
    Icon: IcoHanoi,
  },
  {
    id: 'amaze',
    name: 'AMAZE',
    desc: 'Slide to paint every cell',
    tag: 'Puzzle',
    path: '/amaze',
    Icon: IcoAmaze,
  },
  {
    id: 'wayfinder',
    name: 'Wayfinder',
    desc: 'Hit all outposts · minimum fuel',
    tag: 'Puzzle',
    path: '/wayfinder',
    Icon: IcoWayfinder,
  },
  {
    id: 'ticket-blaster',
    name: 'Ticket Blaster',
    desc: 'Race the clock — blast through checkout',
    tag: 'Arcade',
    path: '/ticket-blaster',
    Icon: IcoTicketBlaster,
  },
];

// ── Tag styling ────────────────────────────────────────────────────────

const TAG_CFG: Record<TagKey, { color: string; border: string; bg: string; label: string }> = {
  Arcade: { color: '#4ade80', border: '#1a6632', bg: '#0a2a14', label: 'ACT' },
  Strategy: { color: '#f59e0b', border: '#78350f', bg: '#1c1206', label: 'STR' },
  Puzzle: { color: '#22d3ee', border: '#164e63', bg: '#061a1c', label: 'PZL' },
  Brain: { color: '#f87171', border: '#7f1d1d', bg: '#1c0607', label: 'INT' },
};

// ── Main component ─────────────────────────────────────────────────────

export default function Hub() {
  const navigate = useNavigate();
  const { loading, error, requestAccess } = useCaptchaGate();
  const [tagline] = useState(() => taglines[Math.floor(Math.random() * taglines.length)]);

  const handlePlay = async (path: string) => {
    const verified = await requestAccess();
    if (verified) navigate(path);
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      {/* CRT scanlines */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.18) 3px, rgba(0,10,0,0.18) 4px)',
          opacity: 0.55,
        }}
      />

      {/* Header */}
      <header className="px-4 pb-5 pt-8 text-center sm:pb-7 sm:pt-12">
        <h1
          className="font-display text-xl tracking-[0.25em] sm:text-3xl"
          style={{
            color: '#4ade80',
            textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66, 0 0 60px #22c55e33',
          }}
        >
          ARCADES.CLICK
        </h1>
        <div className="mt-1.5 text-xs tracking-[0.4em]" style={{ color: '#166534' }}>
          TACTICAL ENTERTAINMENT DIVISION
        </div>
        <p className="mt-3 font-mono text-sm" style={{ color: '#1a6632' }}>
          <span style={{ color: '#22c55e' }}>&gt;</span> &ldquo;{tagline}&rdquo;
        </p>

        {/* Divider */}
        <div
          className="mx-auto mt-4 h-px w-48 sm:w-64"
          style={{
            background:
              'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
            boxShadow: '0 0 6px #22c55e44',
          }}
        />
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-auto w-full max-w-5xl px-4">
          <div
            className="px-4 py-2 text-xs font-mono"
            style={{ background: '#1c0607', border: '1px solid #7f1d1d', color: '#f87171' }}
          >
            ⚠ {error}
          </div>
        </div>
      )}

      {/* Status bar */}
      <div
        className="mx-auto mb-2 mt-1 w-full max-w-5xl px-4 sm:px-6"
        style={{ paddingBottom: '2px' }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: '#040e07',
            border: '1px solid #0f3018',
            borderRadius: '2px',
          }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: '#22c55e', boxShadow: '0 0 4px #22c55e' }}
          />
          <span className="font-mono text-xs tracking-[0.25em]" style={{ color: '#86efac' }}>
            MISSION SELECT
          </span>
          <span className="ml-auto font-mono text-xs" style={{ color: '#166534' }}>
            {games.length} OBJECTIVES AVAILABLE
          </span>
        </div>
      </div>

      {/* Game grid */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 pb-6 pt-2 sm:px-6">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          {games.map((game) => {
            const tag = TAG_CFG[game.tag];
            return (
              <button
                key={game.id}
                onClick={() => handlePlay(game.path)}
                disabled={loading}
                className="group overflow-hidden text-left transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: '#040e07',
                  border: '1px solid #0f2a18',
                  borderRadius: '3px',
                  boxShadow: 'inset 0 0 20px #00000040',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#22c55e';
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    '0 0 20px #22c55e22, inset 0 0 20px #00000040';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#0f2a18';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 0 20px #00000040';
                }}
              >
                {/* Icon art area */}
                <div
                  className="relative flex h-20 items-center justify-center sm:h-24"
                  style={{ background: '#030c06' }}
                >
                  {/* Radar rings */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className="absolute rounded-full"
                      style={{
                        width: 80,
                        height: 80,
                        border: '1px solid #0f2a1866',
                        borderRadius: '50%',
                      }}
                    />
                    <div
                      className="absolute rounded-full"
                      style={{
                        width: 52,
                        height: 52,
                        border: '1px solid #0f2a1844',
                        borderRadius: '50%',
                      }}
                    />
                    <div
                      className="absolute"
                      style={{
                        width: '100%',
                        height: '1px',
                        background:
                          'linear-gradient(to right, transparent, #0f2a1844, transparent)',
                      }}
                    />
                    <div
                      className="absolute"
                      style={{
                        width: '1px',
                        height: '100%',
                        background:
                          'linear-gradient(to bottom, transparent, #0f2a1844, transparent)',
                      }}
                    />
                  </div>

                  {/* Icon */}
                  {game.special ? (
                    /* Multiply gets its custom text art */
                    <span
                      className="relative font-mono font-bold transition-transform duration-200 group-hover:scale-110"
                      style={{
                        color: '#22c55e',
                        filter: 'drop-shadow(0 0 6px #22c55e88)',
                        fontSize: '15px',
                      }}
                    >
                      2 <span style={{ color: '#4ade80' }}>×</span> 2{' '}
                      <span style={{ color: '#166534' }}>=</span>{' '}
                      <span style={{ color: '#86efac' }}>?</span>
                    </span>
                  ) : (
                    <div
                      className="relative transition-transform duration-200 group-hover:scale-110"
                      style={{
                        color: '#22c55e',
                        filter: 'drop-shadow(0 0 6px #22c55e88)',
                      }}
                    >
                      <game.Icon />
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <h2
                      className="text-xs font-bold tracking-wider sm:text-sm"
                      style={{ color: '#86efac' }}
                    >
                      {game.name.toUpperCase()}
                    </h2>
                    <span
                      className="font-mono text-sm font-bold tracking-widest px-1.5 py-0.5"
                      style={{
                        color: tag.color,
                        border: `1px solid ${tag.border}`,
                        background: tag.bg,
                        borderRadius: '2px',
                      }}
                    >
                      [{tag.label}]
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-snug" style={{ color: '#1a6632' }}>
                    {game.desc}
                  </p>

                  {/* Deploy CTA */}
                  <div
                    className="mt-2.5 flex items-center gap-1 text-xs font-bold tracking-[0.2em] transition-colors"
                    style={{ color: '#166534' }}
                  >
                    <span className="group-hover:text-[#22c55e] transition-colors duration-200">
                      DEPLOY
                    </span>
                    <svg
                      className="h-2.5 w-2.5 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#22c55e]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {loading && (
          <p
            className="mt-4 text-center font-mono text-xs tracking-widest"
            style={{ color: '#166534' }}
          >
            VERIFYING CREDENTIALS...
          </p>
        )}
      </main>

      {/* Footer */}
      <footer
        className="px-4 py-4 text-center font-mono text-xs tracking-wider"
        style={{ borderTop: '1px solid #0f2a18', color: '#0f3018' }}
      >
        POWERED BY{' '}
        <a
          href="https://bio-dev-jw.argus.pw"
          className="hover:underline"
          style={{ color: '#166534' }}
          target="_blank"
          rel="noopener noreferrer"
        >
          ARGUS BIO
        </a>{' '}
        · AUTHORIZED ACCESS ONLY
      </footer>
    </div>
  );
}
