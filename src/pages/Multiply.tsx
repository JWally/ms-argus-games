import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type GameState,
  startRound,
  submitAnswer,
  totalTime,
  correctCount,
  formatTime,
  getBestTime,
  activateFreeze,
  tickFreeze,
} from '../games/multiply/engine';
import { launchConfetti } from '../games/confetti';
import { getLeaderboard } from '../games/leaderboard';

const FACTORS_GRID = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function Multiply() {
  const [game, setGame] = useState<GameState>({
    factor: null,
    problems: [],
    current: 0,
    answered: [],
    phase: 'menu',
    startTime: 0,
    totalStartTime: 0,
    streak: 0,
    freezeAvailable: false,
    freezeActive: false,
    freezeEnd: 0,
    frozenMs: 0,
  });
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null);
  const [flashAnswer, setFlashAnswer] = useState(0); // correct answer for wrong-answer flash
  const [elapsed, setElapsed] = useState(0);
  const [freezeCountdown, setFreezeCountdown] = useState(0);
  const [showStreakPop, setShowStreakPop] = useState(false);
  const inputRef = useRef<globalThis.HTMLInputElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  // Timer tick + freeze management
  useEffect(() => {
    if (game.phase === 'playing') {
      timerRef.current = setInterval(() => {
        setGame((prev) => {
          const updated = tickFreeze(prev);
          const now = Date.now();
          const wall = now - updated.totalStartTime;
          // Subtract completed freezes + current active freeze time
          const activeFreezeMs = updated.freezeActive ? now - (updated.freezeEnd - 5000) : 0;
          setElapsed(Math.max(0, wall - updated.frozenMs - activeFreezeMs));
          setFreezeCountdown(
            updated.freezeActive ? Math.ceil(Math.max(0, updated.freezeEnd - now) / 1000) : 0
          );
          return updated;
        });
      }, 100);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [game.phase]);

  // Focus input when playing
  useEffect(() => {
    if (game.phase === 'playing') {
      inputRef.current?.focus();
    }
  }, [game.phase, game.answered.length]);

  // Confetti on good results
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (game.phase === 'done' && !celebratedRef.current) {
      celebratedRef.current = true;
      const perfect = correctCount(game) === game.problems.length;
      if (perfect) {
        const t = totalTime(game);
        const lb = getLeaderboard(
          { gameId: `multiply-${game.factor ?? 'random'}`, baseScore: 25000, lowerIsBetter: true },
          t
        );
        if (lb.isNewBest || (lb.playerRank !== null && lb.playerRank <= 5)) {
          launchConfetti();
        }
      }
    }
    if (game.phase !== 'done') {
      celebratedRef.current = false;
    }
  }, [game]);

  const handleStart = useCallback((factor: number | null) => {
    setGame(startRound(factor));
    setInput('');
    setFlash(null);
    setElapsed(0);
    setShowStreakPop(false);
  }, []);

  const handleSubmit = useCallback(() => {
    setGame((prev) => {
      if (prev.phase !== 'playing' || input.trim() === '') return prev;
      const num = parseInt(input, 10);
      if (isNaN(num)) return prev;

      const problem = prev.problems[prev.current];
      const correct = num === problem.answer;
      setFlash(correct ? 'correct' : 'wrong');
      if (!correct) setFlashAnswer(problem.answer);
      setTimeout(() => setFlash(null), 400);
      setInput('');

      const next = submitAnswer(prev, num);

      // Show streak popup when freeze is newly earned
      if (next.freezeAvailable && !prev.freezeAvailable) {
        setShowStreakPop(true);
        setTimeout(() => setShowStreakPop(false), 1500);
      }

      return next;
    });
  }, [input]);

  const handleFreeze = useCallback(() => {
    setGame((prev) => activateFreeze(prev));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && game.phase === 'playing') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, game.phase]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Menu ──────────────────────────────────────────────────────────

  if (game.phase === 'menu') {
    return (
      <div className="flex h-[100dvh] flex-col items-center bg-arcade-bg px-4 pb-6 pt-4">
        <div className="mb-3 w-full max-w-[400px]">
          <Link to="/" className="text-sm text-arcade-accent hover:underline">
            &larr; Back to Arcade
          </Link>
        </div>

        <h1 className="font-display text-lg text-arcade-accent sm:text-2xl">MULTIPLY</h1>
        <p className="mt-1 text-xs text-gray-400">Pick a number or go random</p>

        <div className="mt-4 grid w-full max-w-[320px] flex-1 grid-cols-3 grid-rows-5 gap-3 sm:max-w-[360px]">
          {FACTORS_GRID.map((n) => {
            const best = getBestTime(n);
            return (
              <button
                key={n}
                onClick={() => handleStart(n)}
                className="flex flex-col items-center justify-center rounded-2xl border border-arcade-border bg-arcade-card text-white transition-all hover:border-arcade-accent/50 hover:bg-arcade-accent/10 active:scale-95"
              >
                <span className="text-3xl font-bold">{n}</span>
                {best !== null && (
                  <span className="mt-1 text-[10px] text-gray-500">{formatTime(best)}</span>
                )}
              </button>
            );
          })}
          <div />
          <button
            onClick={() => handleStart(null)}
            className="flex flex-col items-center justify-center rounded-2xl border border-red-500/50 bg-red-950/30 text-red-400 transition-all hover:border-red-400 hover:bg-red-950/50 active:scale-95"
          >
            <span className="text-3xl font-bold">?</span>
            {getBestTime(null) !== null && (
              <span className="mt-1 text-[10px] text-gray-500">
                {formatTime(getBestTime(null)!)}
              </span>
            )}
          </button>
          <div />
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────

  if (game.phase === 'done') {
    return (
      <MultiplyResults
        game={game}
        onAgain={() => handleStart(game.factor)}
        onMenu={() => setGame((prev) => ({ ...prev, phase: 'menu' }))}
      />
    );
  }

  // ── Playing ───────────────────────────────────────────────────────

  const problem = game.problems[game.current];
  const progress = game.current + 1;
  // Flash border class
  const flashBorder =
    flash === 'correct'
      ? 'animate-[multiply-correct_0.4s_ease-out]'
      : flash === 'wrong'
        ? 'animate-[multiply-wrong_0.3s_ease-out]'
        : '';

  return (
    <div
      className={`h-[100dvh] overflow-hidden bg-arcade-bg px-4 pt-2 ${flashBorder} ${
        game.freezeActive ? 'border-2 border-cyan-400/40' : ''
      }`}
    >
      {/* Freeze overlay */}
      {game.freezeActive && (
        <div className="pointer-events-none fixed inset-0 z-10 animate-[freeze-pulse_1s_ease-in-out_infinite] bg-cyan-500/10" />
      )}

      {/* Header: pips + timer */}
      <div className="mx-auto flex max-w-[400px] items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {progress}/{game.problems.length}
          </span>
          <div className="flex gap-0.5">
            {game.problems.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i < game.current
                    ? game.answered[i]?.correct
                      ? 'bg-green-500'
                      : 'bg-red-500'
                    : i === game.current
                      ? 'bg-white'
                      : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Streak */}
          {game.streak >= 2 && (
            <span
              className={`text-sm ${game.streak >= 3 ? 'animate-[multiply-streak_0.5s_ease-in-out_infinite]' : ''}`}
            >
              {game.streak >= 5 ? '🔥🔥' : game.streak >= 3 ? '🔥' : '✨'}{' '}
              <span className="text-xs font-bold text-orange-400">{game.streak}x</span>
            </span>
          )}

          {/* Freeze button */}
          {game.freezeAvailable && !game.freezeActive && (
            <button
              onClick={handleFreeze}
              className="animate-[multiply-streak_0.8s_ease-in-out_infinite] rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-400 active:scale-95"
            >
              ❄️ FREEZE
            </button>
          )}
          {game.freezeActive && (
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-300">
              ❄️ {freezeCountdown}s
            </span>
          )}

          <span
            className={`font-mono text-sm ${game.freezeActive ? 'text-cyan-400' : 'text-gray-400'}`}
          >
            {formatTime(elapsed)}
          </span>
        </div>
      </div>

      {/* Problem + input — grouped together, anchored near top */}
      <div className="mx-auto mt-10 max-w-[320px] text-center">
        <div
          className={`transition-colors duration-150 ${
            flash === 'correct'
              ? 'text-green-400'
              : flash === 'wrong'
                ? 'text-red-400'
                : 'text-white'
          }`}
        >
          <p className="text-6xl font-bold sm:text-7xl">
            {problem.a} <span className="text-arcade-accent">&times;</span> {problem.b}
          </p>
          <p className="mt-1 h-5 text-sm font-bold">
            {showStreakPop ? (
              <span className="text-orange-400">🔥 FREEZE unlocked!</span>
            ) : flash === 'correct' ? (
              <span className="text-green-400">Nice!</span>
            ) : flash === 'wrong' ? (
              <span className="text-red-400">{flashAnswer}</span>
            ) : null}
          </p>
        </div>

        {/* Input + button right below the problem */}
        <div className="mt-5 flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="?"
            autoFocus
            className={`w-full rounded-xl border-2 bg-arcade-card px-4 py-2 text-center text-2xl font-bold text-white outline-none transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
              flash === 'correct'
                ? 'border-green-500'
                : flash === 'wrong'
                  ? 'border-red-500'
                  : 'border-arcade-border focus:border-arcade-accent'
            }`}
            style={{ MozAppearance: 'textfield' }}
          />
          <button
            onClick={handleSubmit}
            disabled={input.trim() === ''}
            className="w-full rounded-xl bg-arcade-accent py-2 text-lg font-bold text-white transition-all hover:bg-arcade-accent-hover active:scale-95 disabled:opacity-30"
          >
            ENTER
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Results subcomponent ────────────────────────────────────────────

function MultiplyResults({
  game,
  onAgain,
  onMenu,
}: {
  game: GameState;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const t = totalTime(game);
  const correct = correctCount(game);
  const perfect = correct === game.problems.length;

  const lb = useMemo(
    () =>
      getLeaderboard(
        {
          gameId: `multiply-${game.factor ?? 'random'}`,
          baseScore: 25000,
          lowerIsBetter: true,
          count: 6,
        },
        perfect ? t : undefined
      ),
    [game.factor, t, perfect]
  );

  return (
    <div className="flex h-[100dvh] flex-col items-center overflow-auto bg-arcade-bg px-4 pb-6 pt-4">
      <div className="mb-4 w-full max-w-[400px]">
        <Link to="/" className="text-sm text-arcade-accent hover:underline">
          &larr; Back to Arcade
        </Link>
      </div>

      {/* Score summary */}
      <div className="text-center">
        <p className="text-4xl font-bold text-white">{formatTime(t)}</p>
        <p className="mt-1 text-sm text-gray-400">
          {correct}/{game.problems.length} correct
          {lb.isNewBest && perfect && (
            <span className="ml-2 font-semibold text-arcade-accent">New best!</span>
          )}
        </p>
        {game.frozenMs > 0 && (
          <p className="mt-0.5 text-xs text-cyan-400">❄️ -{formatTime(game.frozenMs)} frozen</p>
        )}
        {lb.playerRank !== null && perfect && (
          <p className="mt-1 text-sm font-semibold text-yellow-400">
            #{lb.playerRank} on leaderboard!
          </p>
        )}
      </div>

      {/* Leaderboard */}
      <div className="mt-5 w-full max-w-[400px] rounded-xl border border-arcade-border bg-arcade-card p-4">
        <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
          Leaderboard — {game.factor !== null ? `${game.factor}s` : 'Random'}
        </h2>
        <div className="space-y-1">
          {lb.entries.map((entry, i) => (
            <div
              key={`${entry.name}-${i}`}
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                entry.isPlayer
                  ? 'border border-arcade-accent/50 bg-arcade-accent/10 font-semibold text-white'
                  : 'text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`w-5 text-right text-xs ${i < 3 ? 'text-yellow-400' : 'text-gray-500'}`}
                >
                  {i + 1}.
                </span>
                {entry.name}
              </span>
              <span className="text-xs text-gray-400">{formatTime(entry.score)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Problem breakdown */}
      <details className="mt-4 w-full max-w-[400px]">
        <summary className="cursor-pointer text-center text-xs text-gray-500 hover:text-gray-300">
          Show problem breakdown
        </summary>
        <div className="mt-2 space-y-1">
          {game.answered.map((a, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                a.correct ? 'bg-green-950/30 text-green-300' : 'bg-red-950/30 text-red-300'
              }`}
            >
              <span>
                {a.a} x {a.b} ={' '}
                {a.correct ? (
                  a.answer
                ) : (
                  <>
                    {a.userAnswer} <span className="text-gray-500">({a.answer})</span>
                  </>
                )}
              </span>
              <span className="text-xs text-gray-500">{formatTime(a.timeMs)}</span>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onAgain}
          className="rounded-lg bg-arcade-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-arcade-accent-hover"
        >
          Again
        </button>
        <button
          onClick={onMenu}
          className="rounded-lg bg-arcade-card px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:text-white"
        >
          Menu
        </button>
      </div>
    </div>
  );
}
