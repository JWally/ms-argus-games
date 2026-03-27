import { useNavigate } from 'react-router-dom';
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
    tag: 'Strategy',
    path: '/ataxx',
    gradient: 'from-blue-600 to-red-600',
    emoji: '\u{1F7E6}',
  },
  {
    id: 'breakout',
    name: 'Breakout',
    desc: 'Smash bricks, chain combos',
    tag: 'Arcade',
    path: '/breakout',
    gradient: 'from-violet-600 to-fuchsia-600',
    emoji: '\u{1F9F1}',
  },
  {
    id: 'flappy',
    name: 'Flappy Bird',
    desc: 'Tap to flap, dodge pipes',
    tag: 'Arcade',
    path: '/flappy',
    gradient: 'from-yellow-400 to-green-500',
    emoji: '\u{1F426}',
  },
  {
    id: 'multiply',
    name: 'Multiply',
    desc: 'Speed-run your times tables',
    tag: 'Brain',
    path: '/multiply',
    gradient: 'from-amber-500 to-orange-600',
    emoji: '\u{2716}',
  },
  {
    id: 'river-rat',
    name: 'River Rat',
    desc: 'Steer a mouse down the river',
    tag: 'Arcade',
    path: '/river-rat',
    gradient: 'from-cyan-500 to-blue-700',
    emoji: '\u{1F42D}',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    desc: 'Jump & king on a 6\u00D76 board',
    tag: 'Strategy',
    path: '/checkers',
    gradient: 'from-red-700 to-amber-900',
    emoji: '\u{26C0}',
  },
  {
    id: 'peg-solitaire',
    name: 'Peg Solitaire',
    desc: 'Jump pegs, leave just one',
    tag: 'Puzzle',
    path: '/peg-solitaire',
    gradient: 'from-purple-600 to-indigo-700',
    emoji: '\u{1F534}',
  },
  {
    id: 'connect-4',
    name: 'Connect 4',
    desc: 'Outsmart the AI, drop four',
    tag: 'Strategy',
    path: '/connect-4',
    gradient: 'from-blue-700 to-yellow-500',
    emoji: '\u{1F7E1}',
  },
  {
    id: 'color-flood',
    name: 'Color Flood',
    desc: 'Flood-fill in fewest moves',
    tag: 'Puzzle',
    path: '/color-flood',
    gradient: 'from-emerald-500 to-cyan-600',
    emoji: '\u{1F3A8}',
  },
  {
    id: 'spelling-bee',
    name: 'Spelling Bee',
    desc: 'Listen, spell, repeat',
    tag: 'Brain',
    path: '/spelling-bee',
    gradient: 'from-pink-500 to-yellow-500',
    emoji: '\u{1F41D}',
  },
  {
    id: 'card-counter',
    name: 'Card Counter',
    desc: 'Card counting tutor',
    tag: 'Brain',
    path: '/card-counter',
    gradient: 'from-green-700 to-emerald-900',
    emoji: '\u{1F0CF}',
  },
];

const TAG_COLORS: Record<string, string> = {
  Arcade: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  Strategy: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  Puzzle: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  Brain: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
};

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
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)',
        }}
      />

      {/* Header */}
      <header className="px-4 pb-6 pt-8 text-center sm:pb-8 sm:pt-14">
        <h1
          className="font-display text-xl tracking-wider sm:text-3xl lg:text-4xl"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #22d3ee, #8b5cf6)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'gradient-shift 6s ease infinite',
          }}
        >
          ARCADES.CLICK
        </h1>
        <p className="mt-2 text-xs italic text-gray-500 sm:mt-3 sm:text-sm">
          &ldquo;{tagline}&rdquo;
        </p>
        <div className="mx-auto mt-4 h-px w-32 bg-gradient-to-r from-transparent via-arcade-accent/50 to-transparent sm:w-48" />
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{error}</div>
        </div>
      )}

      {/* Section label */}
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <p className="font-display text-[10px] tracking-[0.3em] text-gray-600 sm:text-xs">
          SELECT YOUR GAME
        </p>
      </div>

      {/* Game grid */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 pb-6 pt-3 sm:px-6 sm:pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => handlePlay(game.path)}
              disabled={loading}
              className="group overflow-hidden rounded-xl border border-arcade-border bg-arcade-card text-left transition-all duration-300 hover:-translate-y-1 hover:border-arcade-accent/50 hover:shadow-[0_8px_30px_-8px_rgba(139,92,246,0.3)] active:scale-[0.98] disabled:opacity-50"
            >
              {/* Card art */}
              <div
                className={`relative flex h-24 items-center justify-center bg-gradient-to-br sm:h-28 ${game.gradient}`}
              >
                {/* Grid overlay */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />
                {game.id === 'multiply' ? (
                  <span className="relative font-mono font-bold text-white drop-shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <span className="text-xl sm:text-2xl">2 </span>
                    <span className="text-2xl text-amber-200 sm:text-3xl">×</span>
                    <span className="text-xl sm:text-2xl"> 2 </span>
                    <span className="text-xl text-amber-100/70 sm:text-2xl">=</span>
                    <span className="text-2xl text-amber-300 sm:text-3xl"> ?</span>
                  </span>
                ) : (
                  <span className="relative text-5xl drop-shadow-lg transition-transform duration-300 group-hover:scale-110 sm:text-6xl">
                    {game.emoji}
                  </span>
                )}
              </div>

              {/* Card body */}
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white sm:text-base">{game.name}</h2>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${TAG_COLORS[game.tag] ?? ''}`}
                  >
                    {game.tag}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{game.desc}</p>

                {/* Play prompt */}
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-arcade-accent/60 transition-colors group-hover:text-arcade-accent">
                  <span>Play</span>
                  <svg
                    className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1"
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
          ))}
        </div>

        {/* Loading state */}
        {loading && <p className="mt-4 text-center text-xs text-gray-500">Verifying...</p>}
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

      {/* Keyframe animations */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}
