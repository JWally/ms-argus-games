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
  const [flashAnswer, setFlashAnswer] = useState(0);
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
      <div
        className="flex h-[100dvh] flex-col items-center px-4 pb-6 pt-4"
        style={{ background: '#030c06', color: '#4ade80' }}
      >
        {/* CRT scanlines */}
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.15) 3px, rgba(0,10,0,0.15) 4px)',
            opacity: 0.5,
          }}
        />

        <div className="mb-3 w-full max-w-[400px]">
          <Link to="/" className="text-sm font-mono tracking-widest hover:underline transition-colors" style={{ color: '#22c55e' }}>
            &larr; Back to Arcade
          </Link>
        </div>

        <h1
          className="font-display text-lg tracking-[0.3em]"
          style={{
            color: '#4ade80',
            textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66, 0 0 60px #22c55e33',
          }}
        >
          MULTIPLY
        </h1>
        <p className="mt-1 text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          COMPUTATION SPEED DRILL
        </p>

        <div
          className="my-2 h-px w-full max-w-md"
          style={{
            background:
              'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
            boxShadow: '0 0 6px #22c55e44',
          }}
        />

        <p className="mb-3 text-xs tracking-[0.2em]" style={{ color: '#166534' }}>
          SELECT A FACTOR TO BEGIN
        </p>

        <div className="mt-1 grid w-full max-w-[320px] flex-1 grid-cols-3 grid-rows-5 gap-3 sm:max-w-[360px]">
          {FACTORS_GRID.map((n) => {
            const best = getBestTime(n);
            return (
              <button
                key={n}
                onClick={() => handleStart(n)}
                className="flex flex-col items-center justify-center transition-all active:scale-95"
                style={{
                  background: '#040e07',
                  border: '1px solid #1a6632',
                  borderRadius: '2px',
                  color: '#86efac',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#22c55e';
                  (e.currentTarget as HTMLButtonElement).style.color = '#4ade80';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a6632';
                  (e.currentTarget as HTMLButtonElement).style.color = '#86efac';
                }}
              >
                <span className="text-3xl font-bold">{n}</span>
                {best !== null && (
                  <span className="mt-1 text-xs" style={{ color: '#166534' }}>
                    {formatTime(best)}
                  </span>
                )}
              </button>
            );
          })}
          <div />
          <button
            onClick={() => handleStart(null)}
            className="flex flex-col items-center justify-center transition-all active:scale-95"
            style={{
              border: '1px solid #7f1d1d',
              background: '#1c0607',
              color: '#f87171',
              borderRadius: '2px',
            }}
          >
            <span className="text-3xl font-bold">?</span>
            {getBestTime(null) !== null && (
              <span className="mt-1 text-xs" style={{ color: '#7f1d1d' }}>
                {formatTime(getBestTime(null)!)}
              </span>
            )}
          </button>
          <div />
        </div>

        <style>{`
          @keyframes bs-victory {
            0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
            15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
            100% { transform: scale(1); filter: brightness(1); }
          }
          @keyframes bs-defeat {
            0%,100% { transform: translate(0,0); }
            20%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8); }
            50%  { transform: translate(6px,-1px) rotate(1deg); }
          }
          @keyframes multiply-correct {
            0%   { box-shadow: inset 0 0 0 2px #22c55e; }
            100% { box-shadow: inset 0 0 0 0px #22c55e00; }
          }
          @keyframes multiply-wrong {
            0%,20%,60% { transform: translateX(-4px); }
            40%,80%    { transform: translateX(4px); }
            100%       { transform: translateX(0); }
          }
          @keyframes multiply-streak {
            0%,100% { transform: scale(1); }
            50%     { transform: scale(1.15); }
          }
          @keyframes freeze-pulse {
            0%,100% { opacity: 0.6; }
            50%     { opacity: 1; }
          }
        `}</style>
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

  const flashBorderAnim =
    flash === 'correct'
      ? 'animate-[multiply-correct_0.4s_ease-out]'
      : flash === 'wrong'
        ? 'animate-[multiply-wrong_0.3s_ease-out]'
        : '';

  return (
    <div
      className={`h-[100dvh] overflow-hidden px-4 pt-2 ${flashBorderAnim} ${
        game.freezeActive ? 'border-2 border-cyan-400/40' : ''
      }`}
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      {/* CRT scanlines */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.15) 3px, rgba(0,10,0,0.15) 4px)',
          opacity: 0.5,
        }}
      />

      {/* Freeze overlay */}
      {game.freezeActive && (
        <div className="pointer-events-none fixed inset-0 z-10 animate-[freeze-pulse_1s_ease-in-out_infinite] bg-cyan-500/10" />
      )}

      {/* Header: pips + timer */}
      <div className="mx-auto flex max-w-[400px] items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#166534' }}>
            {progress}/{game.problems.length}
          </span>
          <div className="flex gap-0.5">
            {game.problems.map((_, i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    i < game.current
                      ? game.answered[i]?.correct
                        ? '#22c55e'
                        : '#dc2626'
                      : i === game.current
                        ? '#86efac'
                        : '#0f2a18',
                }}
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
            className="font-mono text-sm"
            style={{ color: game.freezeActive ? '#67e8f9' : '#86efac' }}
          >
            {formatTime(elapsed)}
          </span>
        </div>
      </div>

      {/* Problem + input */}
      <div className="mx-auto mt-10 max-w-[320px] text-center">
        <div
          style={{
            color:
              flash === 'correct'
                ? '#4ade80'
                : flash === 'wrong'
                  ? '#f87171'
                  : '#86efac',
            transition: 'color 150ms',
          }}
        >
          <p className="text-6xl font-bold sm:text-7xl">
            {problem.a}{' '}
            <span style={{ color: '#4ade80' }}>&times;</span>{' '}
            {problem.b}
          </p>
          <p className="mt-1 h-5 text-sm font-bold">
            {showStreakPop ? (
              <span className="text-orange-400">🔥 FREEZE unlocked!</span>
            ) : flash === 'correct' ? (
              <span style={{ color: '#22c55e' }}>Nice!</span>
            ) : flash === 'wrong' ? (
              <span style={{ color: '#dc2626' }}>{flashAnswer}</span>
            ) : null}
          </p>
        </div>

        {/* Input + button */}
        <div className="mt-5 flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="?"
            autoFocus
            className="w-full px-4 py-2 text-center text-2xl font-bold outline-none transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{
              background: '#040e07',
              border: `2px solid ${
                flash === 'correct' ? '#22c55e' : flash === 'wrong' ? '#dc2626' : '#1a6632'
              }`,
              color: '#86efac',
              borderRadius: '2px',
              MozAppearance: 'textfield',
            } as React.CSSProperties}
          />
          <button
            onClick={handleSubmit}
            disabled={input.trim() === ''}
            className="w-full py-2 text-lg font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30"
            style={{
              background: '#040e07',
              border: '1px solid #22c55e',
              color: '#4ade80',
              boxShadow: '0 0 10px #22c55e44',
              borderRadius: '2px',
            }}
          >
            ENTER
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bs-victory {
          0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
          15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes bs-defeat {
          0%,100% { transform: translate(0,0); }
          20%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8); }
          50%  { transform: translate(6px,-1px) rotate(1deg); }
        }
        @keyframes multiply-correct {
          0%   { box-shadow: inset 0 0 0 2px #22c55e; }
          100% { box-shadow: inset 0 0 0 0px #22c55e00; }
        }
        @keyframes multiply-wrong {
          0%,20%,60% { transform: translateX(-4px); }
          40%,80%    { transform: translateX(4px); }
          100%       { transform: translateX(0); }
        }
        @keyframes multiply-streak {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.15); }
        }
        @keyframes freeze-pulse {
          0%,100% { opacity: 0.6; }
          50%     { opacity: 1; }
        }
      `}</style>
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
    <div
      className="flex h-[100dvh] flex-col items-center overflow-auto px-4 pb-6 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      {/* CRT scanlines */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.15) 3px, rgba(0,10,0,0.15) 4px)',
          opacity: 0.5,
        }}
      />

      <div className="mb-4 w-full max-w-[400px]">
        <Link to="/" className="text-sm font-mono tracking-widest hover:underline transition-colors" style={{ color: '#22c55e' }}>
          &larr; Back to Arcade
        </Link>
      </div>

      {/* Score summary */}
      <div className="text-center">
        <p
          className="text-4xl font-bold"
          style={{
            color: '#4ade80',
            textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66',
          }}
        >
          {formatTime(t)}
        </p>
        <p className="mt-1 text-sm" style={{ color: '#166534' }}>
          {correct}/{game.problems.length} correct
          {lb.isNewBest && perfect && (
            <span className="ml-2 font-semibold" style={{ color: '#4ade80' }}>
              New best!
            </span>
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
      <div
        className="mt-5 w-full max-w-[400px] p-4"
        style={{
          background: '#040e07',
          border: '1px solid #1a6632',
          borderRadius: '2px',
        }}
      >
        <h2
          className="mb-3 text-center text-xs font-semibold uppercase tracking-wider"
          style={{ color: '#166534' }}
        >
          LEADERBOARD — {game.factor !== null ? `${game.factor}s` : 'Random'}
        </h2>
        <div className="space-y-1">
          {lb.entries.map((entry, i) => (
            <div
              key={`${entry.name}-${i}`}
              className="flex items-center justify-between px-3 py-1.5 text-sm"
              style={
                entry.isPlayer
                  ? {
                      background: '#0a2a14',
                      border: '1px solid #22c55e',
                      borderRadius: '2px',
                      color: '#86efac',
                      fontWeight: 600,
                    }
                  : { color: '#166534' }
              }
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-5 text-right text-xs"
                  style={{ color: i < 3 ? '#f59e0b' : '#166534' }}
                >
                  {i + 1}.
                </span>
                {entry.name}
              </span>
              <span className="text-xs" style={{ color: '#166534' }}>
                {formatTime(entry.score)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Problem breakdown */}
      <details className="mt-4 w-full max-w-[400px]">
        <summary
          className="cursor-pointer text-center text-xs hover:underline"
          style={{ color: '#166534' }}
        >
          Show problem breakdown
        </summary>
        <div className="mt-2 space-y-1">
          {game.answered.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-1.5 text-sm"
              style={
                a.correct
                  ? { background: '#0a2a14', color: '#4ade80', borderRadius: '2px' }
                  : { background: '#1c0607', color: '#f87171', borderRadius: '2px' }
              }
            >
              <span>
                {a.a} x {a.b} ={' '}
                {a.correct ? (
                  a.answer
                ) : (
                  <>
                    {a.userAnswer}{' '}
                    <span style={{ color: '#166534' }}>({a.answer})</span>
                  </>
                )}
              </span>
              <span className="text-xs" style={{ color: '#166534' }}>
                {formatTime(a.timeMs)}
              </span>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onAgain}
          className="px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95"
          style={{
            background: '#040e07',
            border: '1px solid #22c55e',
            color: '#4ade80',
            boxShadow: '0 0 10px #22c55e44',
            borderRadius: '2px',
          }}
        >
          AGAIN
        </button>
        <button
          onClick={onMenu}
          className="px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95"
          style={{
            background: '#040e07',
            border: '1px solid #1a4a2a',
            color: '#166534',
            borderRadius: '2px',
          }}
        >
          MENU
        </button>
      </div>

      <style>{`
        @keyframes bs-victory {
          0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
          15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes bs-defeat {
          0%,100% { transform: translate(0,0); }
          20%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8); }
          50%  { transform: translate(6px,-1px) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}
