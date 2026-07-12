import { useCallback, useMemo, useRef, useState, type ElementRef } from 'react';
import { BackLink, CrtOverlay, GameDivider, Leaderboard } from '../components/GameShell';
import { launchConfetti } from '../games/confetti';
import { getLeaderboard } from '../games/leaderboard';
import {
  formatScore,
  getPuzzle,
  getStarterWords,
  RANK_SPACE_SIZE,
  listWords,
  normalizeGuess,
  scoreGuess,
  type GuessResult,
} from '../games/semantic-lockpick/engine';

const BORDER_DIM = '1px solid #14532d';
const BORDER_BRIGHT = '1px solid #4ade80';

function heatColor(rank: number): string {
  if (rank === 1) return '#fef08a';
  if (rank <= 5) return '#fb7185';
  if (rank <= 12) return '#f97316';
  if (rank <= 28) return '#facc15';
  if (rank <= 55) return '#22d3ee';
  return '#166534';
}

function GuessRow({ guess, total }: { guess: GuessResult; total: number }) {
  const color = heatColor(guess.rank);
  return (
    <div
      className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 font-mono text-xs"
      style={{ border: '1px solid #0f2a18', background: '#040e07' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold tracking-wider" style={{ color }}>
            {guess.word.toUpperCase()}
          </span>
          <span style={{ color: '#166534' }}>{formatScore(guess.score)}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-sm" style={{ background: '#020617' }}>
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.max(4, guess.heat * 100)}%`,
              background: color,
              boxShadow: `0 0 10px ${color}`,
            }}
          />
        </div>
      </div>
      <div className="text-right" style={{ color }}>
        #{guess.rank}
        <span style={{ color: '#14532d' }}>/{total}</span>
      </div>
    </div>
  );
}

export default function SemanticLockpick() {
  const [puzzleNonce, setPuzzleNonce] = useState(0);
  const puzzle = useMemo(() => getPuzzle(`semantic-lockpick-${puzzleNonce}`), [puzzleNonce]);
  const validWords = useMemo(() => listWords(), []);
  const starterWords = useMemo(() => getStarterWords(), []);
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [message, setMessage] = useState('VECTOR READY');
  const inputRef = useRef<ElementRef<'input'>>(null);
  const solved = guesses.some((guess) => guess.exact);
  const bestGuess = guesses[0] ?? null;

  const leaderboard = useMemo(
    () =>
      solved
        ? getLeaderboard(
            {
              gameId: 'semantic-lockpick',
              baseScore: 16,
              lowerIsBetter: true,
              spread: 0.9,
            },
            guesses.length
          )
        : null,
    [guesses.length, solved]
  );

  const reset = useCallback(() => {
    setPuzzleNonce((value) => value + 1);
    setGuesses([]);
    setInput('');
    setMessage('VECTOR READY');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const submit = useCallback(
    (raw: string) => {
      if (solved) return;
      const word = normalizeGuess(raw);
      if (!word) return;
      const alreadyGuessed = guesses.some((guess) => guess.word === word);
      if (alreadyGuessed) {
        setMessage('DUPLICATE TRACE');
        setInput('');
        return;
      }
      const result = scoreGuess(puzzle.target.word, word);
      if (!result) {
        setMessage('WORD NOT IN VECTOR SPACE');
        return;
      }
      setGuesses((prev) => [result, ...prev].sort((a, b) => a.rank - b.rank));
      setInput('');
      setMessage(result.exact ? 'SEMANTIC LOCK OPEN' : `${result.label} · #${result.rank}`);
      if (result.exact) launchConfetti();
    },
    [guesses, puzzle.target.word, solved]
  );

  return (
    <div
      className="min-h-[100dvh] px-3 pb-24 pt-4 sm:px-4 sm:pb-10"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />
      <div className="mx-auto w-full max-w-5xl">
        <BackLink />

        <div className="mt-4">
          <main className="mx-auto max-w-3xl">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1
                  className="font-display text-base tracking-[0.16em] sm:text-xl sm:tracking-[0.24em]"
                  style={{
                    color: '#ccfbf1',
                    textShadow: '0 0 10px #22d3ee, 0 0 34px #22d3ee66',
                  }}
                >
                  SEMANTIC LOCKPICK
                </h1>
                <div
                  className="mt-1 font-mono text-xs tracking-[0.3em]"
                  style={{ color: '#0e7490' }}
                >
                  LOWER RANK IS CLOSER · #1 WINS
                </div>
              </div>
              <button
                onClick={reset}
                className="w-full px-4 py-2 font-display text-[10px] tracking-widest transition-all hover:[box-shadow:0_0_14px_#22d3ee66] sm:w-auto"
                style={{ border: '1px solid #155e75', background: '#041316', color: '#67e8f9' }}
              >
                NEW LOCK
              </button>
            </div>

            <GameDivider className="my-4 max-w-full" />

            <section
              className="mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              style={{ border: '1px solid #164e63', background: '#041013' }}
            >
              <div>
                <div
                  className="font-mono text-[11px] tracking-[0.24em]"
                  style={{ color: '#0e7490' }}
                >
                  HIDDEN TARGET
                </div>
                <div
                  className="mt-2 font-display text-2xl tracking-[0.18em]"
                  style={{ color: '#14532d' }}
                >
                  {solved ? puzzle.target.word.toUpperCase() : '███████'}
                </div>
              </div>
              <div
                className="font-mono text-xs leading-relaxed sm:max-w-xs"
                style={{ color: '#67e8f9' }}
              >
                No clue. Guess any word. The rank tells you how close you are to the hidden word.
              </div>
            </section>

            <section
              className="p-3 sm:p-4"
              style={{ border: '1px solid #164e63', background: '#041013' }}
            >
              <div className="min-w-0">
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  <div className="p-3" style={{ border: BORDER_DIM, background: '#020a06' }}>
                    <div style={{ color: '#14532d' }}>GUESSES</div>
                    <div className="mt-1 text-lg font-bold" style={{ color: '#86efac' }}>
                      {guesses.length}
                    </div>
                  </div>
                  <div className="p-3" style={{ border: BORDER_DIM, background: '#020a06' }}>
                    <div style={{ color: '#14532d' }}>BEST</div>
                    <div
                      className="mt-1 text-lg font-bold"
                      style={{ color: bestGuess ? heatColor(bestGuess.rank) : '#166534' }}
                    >
                      {bestGuess ? `#${bestGuess.rank}` : '---'}
                    </div>
                  </div>
                  <div className="p-3" style={{ border: BORDER_DIM, background: '#020a06' }}>
                    <div style={{ color: '#14532d' }}>SPACE</div>
                    <div className="mt-1 text-lg font-bold" style={{ color: '#86efac' }}>
                      {RANK_SPACE_SIZE}
                    </div>
                  </div>
                </div>

                <form
                  className="sticky bottom-0 z-30 -mx-3 mt-4 flex gap-2 border-t px-3 py-3 shadow-[0_-12px_28px_#000c] sm:static sm:mx-0 sm:border-t-0 sm:px-0 sm:py-0 sm:shadow-none"
                  style={{ borderColor: '#0f2a18', background: '#030c06' }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit(input);
                  }}
                >
                  <input
                    ref={inputRef}
                    autoFocus
                    list="semantic-lockpick-words"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={solved}
                    placeholder={solved ? puzzle.target.word.toUpperCase() : 'guess any word'}
                    className="min-w-0 flex-1 px-3 py-3.5 font-mono text-base outline-none disabled:opacity-60 sm:py-3 sm:text-sm"
                    style={{
                      border: solved ? BORDER_BRIGHT : '1px solid #155e75',
                      background: '#020617',
                      color: '#ccfbf1',
                    }}
                  />
                  <datalist id="semantic-lockpick-words">
                    {validWords.map((word) => (
                      <option key={word} value={word} />
                    ))}
                  </datalist>
                  <button
                    disabled={solved}
                    className="min-h-12 px-4 py-3 font-display text-[10px] tracking-widest disabled:opacity-40"
                    style={{ border: BORDER_BRIGHT, background: '#22c55e', color: '#021207' }}
                  >
                    PROBE
                  </button>
                </form>

                <div
                  className="mt-3 min-h-5 font-mono text-xs leading-relaxed tracking-widest"
                  style={{ color: solved ? '#fef08a' : '#22d3ee' }}
                >
                  {message}
                </div>
                {guesses.length === 0 && (
                  <div
                    className="mt-2 font-mono text-[11px] leading-relaxed"
                    style={{ color: '#0e7490' }}
                  >
                    Optional first taps. They are not clues.
                  </div>
                )}

                {!solved && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {starterWords.map((word) => (
                      <button
                        key={word}
                        onClick={() => submit(word)}
                        className="min-h-10 px-3 py-2 font-mono text-[11px] tracking-wider transition-colors hover:border-[#22d3ee]"
                        style={{
                          border: '1px solid #164e63',
                          background: '#020617',
                          color: '#67e8f9',
                        }}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="mt-5 space-y-2">
              {guesses.length === 0 ? (
                <div
                  className="px-4 py-8 text-center font-mono text-xs tracking-[0.24em]"
                  style={{ border: '1px solid #0f2a18', background: '#040e07', color: '#166534' }}
                >
                  AWAITING FIRST TRACE
                </div>
              ) : (
                guesses.map((guess) => (
                  <GuessRow key={guess.word} guess={guess} total={RANK_SPACE_SIZE} />
                ))
              )}
            </section>
          </main>
        </div>
        {solved && leaderboard && (
          <div className="mx-auto mt-5 max-w-3xl">
            <Leaderboard
              result={leaderboard}
              title="LOCK PICKS"
              format={(score) => `${score} guesses`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
