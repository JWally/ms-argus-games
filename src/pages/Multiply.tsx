import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { GameCabinet } from '../components/GameCabinet';
import { Leaderboard } from '../components/GameShell';
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
import { getLeaderboard, type LeaderboardResult } from '../games/leaderboard';

const BORDER_GREEN_BRIGHT = '1px solid #22c55e';
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

  // Results leaderboard (done phase)
  const doneLb = useMemo(() => {
    if (game.phase !== 'done') return null;
    const t = totalTime(game);
    const perfect = correctCount(game) === game.problems.length;
    return getLeaderboard(
      {
        gameId: `multiply-${game.factor ?? 'random'}`,
        baseScore: 25000,
        lowerIsBetter: true,
        count: 6,
      },
      perfect ? t : undefined
    );
  }, [game]);

  const best = game.phase !== 'menu' ? getBestTime(game.factor) : null;

  const status =
    game.phase === 'menu' ? (
      <p
        className="text-center font-mono text-xs tracking-widest lg:text-sm"
        style={{ color: '#86efac' }}
      >
        PICK A NUMBER TO START — ? IS A MYSTERY MIX
      </p>
    ) : game.phase === 'playing' ? (
      <PlayingStatus
        game={game}
        elapsed={elapsed}
        freezeCountdown={freezeCountdown}
        onFreeze={handleFreeze}
      />
    ) : doneLb ? (
      <DoneStatus game={game} lb={doneLb} />
    ) : null;

  const rules = (
    <ul
      className="flex flex-col gap-1.5 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· PICK A NUMBER TO PRACTICE ITS TIMES TABLE — ? MIXES THEM ALL</li>
      <li>· TYPE YOUR ANSWER AND HIT ENTER</li>
      <li>· BUILD A STREAK TO UNLOCK ❄️ FREEZE — IT STOPS THE CLOCK</li>
      <li>· ANSWER EVERY ONE RIGHT TO SET YOUR BEST TIME</li>
    </ul>
  );

  return (
    <GameCabinet
      title="MULTIPLY"
      subtitle="TIMES TABLES AT TOP SPEED"
      tag="Brain"
      record={best !== null ? `BEST ${formatTime(best)}` : undefined}
      onRestart={game.phase !== 'menu' ? () => handleStart(game.factor) : undefined}
      status={status}
      rules={rules}
      sidebar={
        game.phase === 'done' && doneLb ? (
          <Leaderboard
            result={doneLb}
            title={`LEADERBOARD — ${game.factor !== null ? `${game.factor}s` : 'Random'}`}
            format={formatTime}
            className="w-full"
          />
        ) : undefined
      }
    >
      {game.phase === 'menu' && <MenuGrid onStart={handleStart} />}

      {game.phase === 'playing' && (
        <PlayingView
          game={game}
          flash={flash}
          flashAnswer={flashAnswer}
          showStreakPop={showStreakPop}
          input={input}
          onInput={setInput}
          onSubmit={handleSubmit}
          inputRef={inputRef}
        />
      )}

      {game.phase === 'done' && (
        <DoneView
          game={game}
          onAgain={() => handleStart(game.factor)}
          onMenu={() => setGame((prev) => ({ ...prev, phase: 'menu' }))}
        />
      )}

      <style>{`
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
    </GameCabinet>
  );
}

// ── Menu grid ───────────────────────────────────────────────────────

function MenuGrid({ onStart }: { onStart: (factor: number | null) => void }) {
  return (
    <div className="grid w-full grid-cols-3 gap-3">
      {FACTORS_GRID.map((n) => {
        const factorBest = getBestTime(n);
        return (
          <button
            key={n}
            onClick={() => onStart(n)}
            className="flex h-16 flex-col items-center justify-center rounded-[2px] border border-[#1a6632] bg-[#040e07] text-[#86efac] transition-all hover:border-[#22c55e] hover:text-[#4ade80] active:scale-95 lg:h-20"
          >
            <span className="text-3xl font-bold lg:text-4xl">{n}</span>
            {factorBest !== null && (
              <span className="mt-1 text-xs lg:text-sm" style={{ color: '#3f9e68' }}>
                {formatTime(factorBest)}
              </span>
            )}
          </button>
        );
      })}
      <div />
      <button
        onClick={() => onStart(null)}
        className="flex h-16 flex-col items-center justify-center transition-all active:scale-95 lg:h-20"
        style={{
          border: '1px solid #7f1d1d',
          background: '#1c0607',
          color: '#f87171',
          borderRadius: '2px',
        }}
      >
        <span className="text-3xl font-bold lg:text-4xl">?</span>
        {getBestTime(null) !== null && (
          <span className="mt-1 text-xs lg:text-sm" style={{ color: '#7f1d1d' }}>
            {formatTime(getBestTime(null)!)}
          </span>
        )}
      </button>
      <div />
    </div>
  );
}

// ── Playing status (pips + streak + freeze + timer) ─────────────────

function PlayingStatus({
  game,
  elapsed,
  freezeCountdown,
  onFreeze,
}: {
  game: GameState;
  elapsed: number;
  freezeCountdown: number;
  onFreeze: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs lg:text-sm" style={{ color: '#3f9e68' }}>
          {game.current + 1}/{game.problems.length}
        </span>
        <div className="flex gap-0.5">
          {game.problems.map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full lg:h-2 lg:w-2"
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
            className={`text-sm lg:text-base ${game.streak >= 3 ? 'animate-[multiply-streak_0.5s_ease-in-out_infinite]' : ''}`}
          >
            {game.streak >= 5 ? '🔥🔥' : game.streak >= 3 ? '🔥' : '✨'}{' '}
            <span className="text-xs font-bold text-orange-400 lg:text-sm">{game.streak}x</span>
          </span>
        )}

        {/* Freeze button */}
        {game.freezeAvailable && !game.freezeActive && (
          <button
            onClick={onFreeze}
            className="animate-[multiply-streak_0.8s_ease-in-out_infinite] rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-400 active:scale-95 lg:text-sm"
          >
            ❄️ FREEZE
          </button>
        )}
        {game.freezeActive && (
          <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-300 lg:text-sm">
            ❄️ {freezeCountdown}s
          </span>
        )}

        <span
          className="font-mono text-sm lg:text-base"
          style={{ color: game.freezeActive ? '#67e8f9' : '#86efac' }}
        >
          {formatTime(elapsed)}
        </span>
      </div>
    </div>
  );
}

// ── Done status (time + correct summary) ────────────────────────────

function DoneStatus({ game, lb }: { game: GameState; lb: LeaderboardResult }) {
  const t = totalTime(game);
  const correct = correctCount(game);
  const perfect = correct === game.problems.length;

  return (
    <div className="text-center">
      <p
        className="text-4xl font-bold lg:text-5xl"
        style={{
          color: '#4ade80',
          textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66',
        }}
      >
        {formatTime(t)}
      </p>
      <p className="mt-1 text-sm lg:text-base" style={{ color: '#3f9e68' }}>
        {correct}/{game.problems.length} correct
        {lb.isNewBest && perfect && (
          <span className="ml-2 font-semibold" style={{ color: '#4ade80' }}>
            New best!
          </span>
        )}
      </p>
      {game.frozenMs > 0 && (
        <p className="mt-0.5 text-xs text-cyan-400 lg:text-sm">
          ❄️ -{formatTime(game.frozenMs)} frozen
        </p>
      )}
      {lb.playerRank !== null && perfect && (
        <p className="mt-1 text-sm font-semibold text-yellow-400 lg:text-base">
          #{lb.playerRank} on leaderboard!
        </p>
      )}
    </div>
  );
}

// ── Playing view (problem + input) ──────────────────────────────────

function PlayingView({
  game,
  flash,
  flashAnswer,
  showStreakPop,
  input,
  onInput,
  onSubmit,
  inputRef,
}: {
  game: GameState;
  flash: 'correct' | 'wrong' | null;
  flashAnswer: number;
  showStreakPop: boolean;
  input: string;
  onInput: (v: string) => void;
  onSubmit: () => void;
  inputRef: RefObject<globalThis.HTMLInputElement | null>;
}) {
  const problem = game.problems[game.current];
  if (!problem) return null;

  const flashBorderAnim =
    flash === 'correct'
      ? 'animate-[multiply-correct_0.4s_ease-out]'
      : flash === 'wrong'
        ? 'animate-[multiply-wrong_0.3s_ease-out]'
        : '';

  return (
    <>
      {/* Freeze overlay */}
      {game.freezeActive && (
        <div className="pointer-events-none fixed inset-0 z-10 animate-[freeze-pulse_1s_ease-in-out_infinite] bg-cyan-500/10" />
      )}

      <div
        className={`w-full py-6 text-center ${flashBorderAnim} ${
          game.freezeActive ? 'border-2 border-cyan-400/40' : ''
        }`}
      >
        <div
          style={{
            color: flash === 'correct' ? '#4ade80' : flash === 'wrong' ? '#f87171' : '#86efac',
            transition: 'color 150ms',
          }}
        >
          <p className="text-6xl font-bold sm:text-7xl lg:text-8xl">
            {problem.a} <span style={{ color: '#4ade80' }}>&times;</span> {problem.b}
          </p>
          <p className="mt-1 h-5 text-sm font-bold lg:text-base">
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
            onChange={(e) => onInput(e.target.value)}
            placeholder="?"
            autoFocus
            className="w-full px-4 py-2 text-center text-2xl font-bold outline-none transition-colors lg:text-3xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={
              {
                background: '#040e07',
                border: `2px solid ${
                  flash === 'correct' ? '#22c55e' : flash === 'wrong' ? '#dc2626' : '#1a6632'
                }`,
                color: '#86efac',
                borderRadius: '2px',
                MozAppearance: 'textfield',
              } as CSSProperties
            }
          />
          <button
            onClick={onSubmit}
            disabled={input.trim() === ''}
            className="w-full py-2 text-lg font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 lg:text-xl"
            style={{
              background: '#040e07',
              border: BORDER_GREEN_BRIGHT,
              color: '#4ade80',
              boxShadow: '0 0 10px #22c55e44',
              borderRadius: '2px',
            }}
          >
            ENTER
          </button>
        </div>
      </div>
    </>
  );
}

// ── Done view (breakdown + buttons) ─────────────────────────────────

function DoneView({
  game,
  onAgain,
  onMenu,
}: {
  game: GameState;
  onAgain: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="w-full">
      {/* Problem breakdown */}
      <details className="w-full">
        <summary
          className="cursor-pointer text-center text-xs hover:underline lg:text-sm"
          style={{ color: '#3f9e68' }}
        >
          Show problem breakdown
        </summary>
        <div className="mt-2 space-y-1">
          {game.answered.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-1.5 text-sm lg:text-base"
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
                    {a.userAnswer} <span style={{ color: '#3f9e68' }}>({a.answer})</span>
                  </>
                )}
              </span>
              <span className="text-xs lg:text-sm" style={{ color: '#3f9e68' }}>
                {formatTime(a.timeMs)}
              </span>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-5 flex justify-center gap-3">
        <button
          onClick={onAgain}
          className="px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95 lg:text-base"
          style={{
            background: '#040e07',
            border: BORDER_GREEN_BRIGHT,
            color: '#4ade80',
            boxShadow: '0 0 10px #22c55e44',
            borderRadius: '2px',
          }}
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onMenu}
          className="px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95 lg:text-base"
          style={{
            background: '#040e07',
            border: '1px solid #1a4a2a',
            color: '#3f9e68',
            borderRadius: '2px',
          }}
        >
          MENU
        </button>
      </div>
    </div>
  );
}
