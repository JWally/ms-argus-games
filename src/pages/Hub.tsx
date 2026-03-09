import { useNavigate } from 'react-router-dom';
import { useCaptchaGate } from '../hooks/useCaptchaGate';

const games = [
  {
    id: 'scorched-earth',
    name: 'Scorched Earth',
    description: 'Artillery duel — aim, choose your weapon, and obliterate your opponent.',
    path: '/scorched-earth',
    gradient: 'from-orange-600 to-red-800',
    emoji: '\u{1F4A5}',
  },
  {
    id: 'color-flood',
    name: 'Color Flood',
    description: 'Capture the board by flooding from the corner. Fewest moves wins.',
    path: '/color-flood',
    gradient: 'from-emerald-500 to-cyan-600',
    emoji: '\u{1F3A8}',
  },
];

export default function Hub() {
  const navigate = useNavigate();
  const { loading, error, requestAccess } = useCaptchaGate();

  const handlePlay = async (path: string) => {
    const existing = sessionStorage.getItem('argus_arcade_token');
    if (existing) {
      navigate(path);
      return;
    }

    const verified = await requestAccess();
    if (verified) {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-arcade-bg">
      {/* Header */}
      <header className="border-b border-arcade-border px-4 py-6">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-display text-2xl text-arcade-accent sm:text-3xl">ARGUS ARCADE</h1>
          <p className="mt-2 text-sm text-gray-400">Prove you&apos;re human. Then have some fun.</p>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-auto mt-4 max-w-4xl px-4">
          <div className="rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{error}</div>
        </div>
      )}

      {/* Game grid */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-2">
          {games.map((game) => (
            <div
              key={game.id}
              className="group overflow-hidden rounded-xl border border-arcade-border bg-arcade-card transition-all hover:border-arcade-accent/50 hover:shadow-lg hover:shadow-arcade-accent/10"
            >
              {/* Thumbnail area */}
              <div
                className={`flex h-40 items-center justify-center bg-gradient-to-br ${game.gradient}`}
              >
                <span className="text-6xl">{game.emoji}</span>
              </div>

              {/* Info */}
              <div className="p-5">
                <h2 className="text-lg font-semibold text-white">{game.name}</h2>
                <p className="mt-1 text-sm text-gray-400">{game.description}</p>

                <button
                  onClick={() => handlePlay(game.path)}
                  disabled={loading}
                  className="mt-4 w-full rounded-lg bg-arcade-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-arcade-accent-hover disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Play Now'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-arcade-border pt-6 text-center text-xs text-gray-500">
          <p>Each game requires a quick handwriting verification to play.</p>
          <p className="mt-1">
            Powered by{' '}
            <a
              href="https://bio-dev-jw.argus.pw"
              className="text-arcade-accent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Argus Bio
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
