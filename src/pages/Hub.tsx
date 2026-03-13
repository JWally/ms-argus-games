import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
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

const games = [
  {
    id: 'ataxx',
    name: 'Ataxx',
    desc: 'Clone & conquer the board',
    path: '/ataxx',
    gradient: 'from-blue-600 to-red-600',
    emoji: '\u{1F7E6}',
  },
  {
    id: 'breakout',
    name: 'Breakout',
    desc: 'Smash bricks, chain combos',
    path: '/breakout',
    gradient: 'from-violet-600 to-fuchsia-600',
    emoji: '\u{1F9F1}',
  },
  {
    id: 'flappy',
    name: 'Flappy Bird',
    desc: 'Tap to flap, dodge pipes',
    path: '/flappy',
    gradient: 'from-yellow-400 to-green-500',
    emoji: '\u{1F426}',
  },
  {
    id: 'multiply',
    name: 'Multiply',
    desc: 'Speed-run your times tables',
    path: '/multiply',
    gradient: 'from-amber-500 to-orange-600',
    emoji: '\u{2716}',
  },
  {
    id: 'river-rat',
    name: 'River Rat',
    desc: 'Steer a mouse down the river',
    path: '/river-rat',
    gradient: 'from-cyan-500 to-blue-700',
    emoji: '\u{1F42D}',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    desc: 'Jump & king on a 6×6 board',
    path: '/checkers',
    gradient: 'from-red-700 to-amber-900',
    emoji: '\u{26C0}',
  },
  {
    id: 'peg-solitaire',
    name: 'Peg Solitaire',
    desc: 'Jump pegs, leave just one',
    path: '/peg-solitaire',
    gradient: 'from-purple-600 to-indigo-700',
    emoji: '\u{1F534}',
  },
  {
    id: 'connect-4',
    name: 'Connect 4',
    desc: 'Outsmart the AI, drop four',
    path: '/connect-4',
    gradient: 'from-blue-700 to-yellow-500',
    emoji: '\u{1F7E1}',
  },
  {
    id: 'color-flood',
    name: 'Color Flood',
    desc: 'Flood-fill in fewest moves',
    path: '/color-flood',
    gradient: 'from-emerald-500 to-cyan-600',
    emoji: '\u{1F3A8}',
  },
  {
    id: 'spelling-bee',
    name: 'Spelling Bee',
    desc: 'Listen, spell, repeat',
    path: '/spelling-bee',
    gradient: 'from-pink-500 to-yellow-500',
    emoji: '\u{1F41D}',
  },
  {
    id: 'card-counter',
    name: 'Card Counter',
    desc: 'Card counting tutor',
    path: '/card-counter',
    gradient: 'from-green-700 to-emerald-900',
    emoji: '\u{1F0CF}',
  },
];

export default function Hub() {
  const navigate = useNavigate();
  const { loading, error, requestAccess } = useCaptchaGate();
  const [tagline] = useState(() => taglines[Math.floor(Math.random() * taglines.length)]);

  const handlePlay = async (path: string) => {
    const verified = await requestAccess();
    if (verified) {
      navigate(path);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-arcade-bg">
      {/* Header */}
      <header className="px-4 pb-4 pt-6 text-center sm:pb-6 sm:pt-10">
        <h1 className="font-display text-xl text-arcade-accent sm:text-3xl">OLD SCHOOL ARCADE</h1>
        <p className="mt-1.5 text-xs italic text-gray-500 sm:mt-2 sm:text-sm">
          &ldquo;{tagline}&rdquo;
        </p>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-auto w-full max-w-2xl px-4">
          <div className="rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{error}</div>
        </div>
      )}

      {/* Game list */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-3 pb-6 sm:px-6">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => handlePlay(game.path)}
              disabled={loading}
              className="group flex items-center gap-3 rounded-xl border border-arcade-border bg-arcade-card p-3 text-left transition-all hover:border-arcade-accent/50 hover:bg-arcade-card/80 active:scale-[0.98] disabled:opacity-50 sm:gap-4 sm:p-4"
            >
              {/* Icon */}
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br sm:h-14 sm:w-14 ${game.gradient}`}
              >
                <span className="text-2xl sm:text-3xl">{game.emoji}</span>
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white sm:text-base">{game.name}</h2>
                <p className="mt-0.5 text-xs text-gray-500">{game.desc}</p>
              </div>

              {/* Arrow */}
              <svg
                className="h-4 w-4 shrink-0 text-gray-600 transition-colors group-hover:text-arcade-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading && <p className="mt-4 text-center text-xs text-gray-500">Verifying...</p>}

        {/* Ticket Blaster promo */}
        <div className="mt-4">
          <Link
            to="/ticket-blaster"
            className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-arcade-gold/40 bg-arcade-card p-3 text-left transition-all hover:border-arcade-gold/70 hover:bg-arcade-card/80 active:scale-[0.98] sm:gap-4 sm:p-4"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 via-pink-500 to-purple-700 sm:h-14 sm:w-14">
              <span className="text-2xl sm:text-3xl">{'\u{1F3AB}'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white sm:text-base">Ticket Blaster</h2>
                <span className="rounded bg-arcade-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-arcade-gold">
                  CTF
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                Build a bot to buy Taylor Swift tickets. Most tickets wins.
              </p>
            </div>
            <svg
              className="h-4 w-4 shrink-0 text-gray-600 transition-colors group-hover:text-arcade-gold"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-arcade-border px-4 py-4 text-center text-[10px] text-gray-600">
        <span>
          Powered by{' '}
          <a
            href="https://bio-dev-jw.argus.pw"
            className="text-arcade-accent/70 hover:text-arcade-accent hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Argus Bio
          </a>
        </span>
      </footer>
    </div>
  );
}
