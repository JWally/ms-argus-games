import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { BackLink, CrtOverlay } from '../components/GameShell';
import {
  type Direction,
  type GameState,
  createGame,
  resetGame,
  slide,
  solve,
  render,
  applyFade,
  getStars,
  getBestScore,
  saveBestScore,
} from '../games/amaze/engine';

// ── Size presets ──────────────────────────────────────────────────────────

const SIZE_OPTIONS = [
  { label: 'SMALL', size: 8 },
  { label: 'MEDIUM', size: 12 },
  { label: 'LARGE', size: 16 },
] as const;

function defaultSize(): number {
  return typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 12;
}

// ── Shared modal shell ────────────────────────────────────────────────────

function Modal({ children, onBackdrop }: { children: ReactNode; onBackdrop?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }}
      onClick={onBackdrop}
    >
      <div
        className="w-full max-w-sm"
        style={{
          background: '#040e07',
          border: '1px solid #1a6632',
          borderRadius: '2px',
          boxShadow: '0 0 40px #22c55e22, inset 0 0 40px #00000060',
          animation: 'modal-in 0.22s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalDivider() {
  return (
    <div
      className="my-3 h-px"
      style={{
        background:
          'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
        boxShadow: '0 0 4px #22c55e44',
      }}
    />
  );
}

// ── D-pad button ──────────────────────────────────────────────────────────

function DPadBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      className="flex h-11 w-11 select-none items-center justify-center text-base transition-all active:scale-90 disabled:opacity-30"
      style={{
        background: '#040e07',
        border: '1px solid #1a4a2a',
        color: '#22c55e',
        borderRadius: '4px',
        touchAction: 'manipulation',
        userSelect: 'none',
      }}
    >
      {label}
    </button>
  );
}

// ── Star display ──────────────────────────────────────────────────────────

function Stars({ count }: { count: 1 | 2 | 3 }) {
  const filled = '★';
  const empty = '☆';
  const colors = { 3: '#fbbf24', 2: '#86efac', 1: '#4ade80' } as const;
  return (
    <span style={{ color: colors[count], fontSize: '1.5rem', letterSpacing: '0.1em' }}>
      {filled.repeat(count)}
      {empty.repeat(3 - count)}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function Amaze() {
  const [boardSize, setBoardSize] = useState(defaultSize);
  const [game, setGame] = useState<GameState>(() => createGame(defaultSize()));
  const [bestScore, setBestScore] = useState<number | null>(() => getBestScore(defaultSize()));
  const [now, setNow] = useState(Date.now);

  // Modals
  const [showBriefing, setShowBriefing] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [showLost, setShowLost] = useState(false);

  // Ghost runner
  const [ghostGame, setGhostGame] = useState<GameState | null>(null);
  const [ghostStep, setGhostStep] = useState(0);
  const [ghostMoveCount, setGhostMoveCount] = useState(0);
  const [isGhostRunning, setIsGhostRunning] = useState(false);
  const [ghostDone, setGhostDone] = useState(false);
  const ghostMovesRef = useRef<Direction[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const px = Math.min(window.innerWidth - 32, 400);

  // Refs for RAF loop (avoids stale closures).
  // Writing refs during render is intentional here — keeps the RAF loop
  // in sync with the latest state without re-subscribing on every render.
  const activeGameRef = useRef<GameState>(game);
  const isGhostRef = useRef(false);
  // eslint-disable-next-line react-hooks/refs
  activeGameRef.current = isGhostRunning && ghostGame ? ghostGame : game;
  // eslint-disable-next-line react-hooks/refs
  isGhostRef.current = isGhostRunning;

  // ── Continuous RAF loop ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId: number;
    const loop = (ts: number) => {
      render(canvas, activeGameRef.current, ts, isGhostRef.current, Date.now());
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ── Timer display tick (200 ms) ───────────────────────────────────────────
  useEffect(() => {
    if (game.won || game.lost) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [game.won, game.lost]);

  // ── Fade + timeout tick (500 ms) ──────────────────────────────────────────
  useEffect(() => {
    if (game.won || game.lost) return;
    const id = setInterval(() => {
      const t = Date.now();
      setGame((prev) => {
        if (prev.won || prev.lost) return prev;
        if (isFinite(prev.deadline) && t >= prev.deadline) {
          return { ...prev, lost: true, lostReason: 'time' };
        }
        return applyFade(prev, t) ?? prev;
      });
    }, 500);
    return () => clearInterval(id);
  }, [game.won, game.lost]);

  // ── Ghost timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isGhostRunning) return;
    if (ghostStep >= ghostMovesRef.current.length) {
      const t = setTimeout(() => {
        setIsGhostRunning(false);
        setGhostDone(true);
      }, 800);
      return () => clearTimeout(t);
    }
    const dir = ghostMovesRef.current[ghostStep];
    const t = setTimeout(() => {
      setGhostGame((prev) => (prev ? slide(prev, dir) : prev));
      setGhostStep((s) => s + 1);
    }, 420);
    return () => clearTimeout(t);
  }, [isGhostRunning, ghostStep]);

  // ── Win / loss detection ──────────────────────────────────────────────────
  useEffect(() => {
    if (game.won) setShowComplete(true);
  }, [game.won]);

  useEffect(() => {
    if (game.lost) setShowLost(true);
  }, [game.lost]);

  // ── Dismiss briefing and start timer ─────────────────────────────────────
  const startGame = useCallback(() => {
    setShowBriefing(false);
    const t = Date.now();
    setNow(t);
    setGame((prev) => ({ ...prev, deadline: t + prev.timeLimit * 1000 }));
  }, []);

  // ── Restart ───────────────────────────────────────────────────────────────
  const restart = useCallback(
    (size?: number) => {
      const s = size ?? boardSize;
      setBoardSize(s);
      const g = createGame(s);
      // Start the timer immediately — briefing is only shown on first load.
      setGame({ ...g, deadline: Date.now() + g.timeLimit * 1000 });
      setBestScore(getBestScore(s));
      setShowComplete(false);
      setShowLost(false);
      setNow(Date.now());
      setGhostGame(null);
      setGhostStep(0);
      setGhostMoveCount(0);
      setIsGhostRunning(false);
      setGhostDone(false);
      ghostMovesRef.current = [];
    },
    [boardSize]
  );

  // ── Retry same maze after loss ────────────────────────────────────────────
  const retryGame = useCallback(() => {
    setGame((prev) => resetGame(prev)); // resets patrol/deadline/painted, keeps mines
    setShowLost(false);
    setNow(Date.now());
    setGhostGame(null);
    setGhostStep(0);
    setGhostMoveCount(0);
    setIsGhostRunning(false);
    setGhostDone(false);
    ghostMovesRef.current = [];
  }, []);

  // ── Player move ───────────────────────────────────────────────────────────
  const move = useCallback((dir: Direction) => {
    if (isGhostRef.current) return;
    setGame((prev) => {
      const next = slide(prev, dir);
      if (next.won && !prev.won) {
        saveBestScore(next.size, next.moves);
        setBestScore(getBestScore(next.size));
      }
      return next;
    });
  }, []);

  // ── Keyboard controls ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: 'n',
        ArrowDown: 's',
        ArrowLeft: 'w',
        ArrowRight: 'e',
        w: 'n',
        s: 's',
        a: 'w',
        d: 'e',
        W: 'n',
        S: 's',
        A: 'w',
        D: 'e',
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        move(dir);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  // ── Touch swipe on canvas ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let sx = 0,
      sy = 0;
    const onStart = (e: TouchEvent) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n');
    };
    canvas.addEventListener('touchstart', onStart, { passive: true });
    canvas.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, [move]);

  // ── Start ghost replay ────────────────────────────────────────────────────
  const startGhost = useCallback(() => {
    const fresh = resetGame(game, true); // forGhost: clears mines/patrol/fade
    const moves = solve(fresh);
    ghostMovesRef.current = moves;
    setGhostMoveCount(moves.length);
    setGhostGame(fresh);
    setGhostStep(0);
    setIsGhostRunning(true);
    setGhostDone(false);
    setShowComplete(false);
  }, [game]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const activeGame = isGhostRunning && ghostGame ? ghostGame : game;
  const total = game.size * game.size;
  const cleared = activeGame.paintedCount;

  // Timer
  const timeLeft = isFinite(game.deadline)
    ? Math.max(0, Math.ceil((game.deadline - now) / 1000))
    : game.timeLimit;
  const timerPct = timeLeft / game.timeLimit;
  const timerColor = !isFinite(game.deadline)
    ? '#166534'
    : timerPct > 0.4
      ? '#4ade80'
      : timerPct > 0.2
        ? '#fbbf24'
        : '#ef4444';
  const timerStr = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`;

  // Moves remaining colour
  const movesLeft = game.moveLimit - game.moves;
  const movePct = movesLeft / game.moveLimit;
  const moveColor = movePct > 0.5 ? '#4ade80' : movePct > 0.2 ? '#fbbf24' : '#ef4444';
  const limitColor = movePct > 0.5 ? '#166534' : movePct > 0.2 ? '#78350f' : '#7f1d1d';

  return (
    <div
      className="flex min-h-screen flex-col items-center px-4 pb-12 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />

      {/* Back link */}
      <div className="mb-4 w-full max-w-[400px]">
        <BackLink />
      </div>

      {/* Title */}
      <div className="mb-1 text-center">
        <h1
          className="font-display text-lg tracking-[0.3em]"
          style={{
            color: '#4ade80',
            textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66, 0 0 60px #22c55e33',
          }}
        >
          AMAZE
        </h1>
        <div className="text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          IED CLEARANCE PROTOCOL
        </div>
      </div>

      {/* Divider */}
      <div
        className="my-2 h-px w-full max-w-[400px]"
        style={{
          background:
            'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
          boxShadow: '0 0 6px #22c55e44',
        }}
      />

      {/* Size selector */}
      <div className="mt-2 flex gap-2">
        {SIZE_OPTIONS.map((opt) => (
          <button
            key={opt.size}
            onClick={() => restart(opt.size)}
            className="px-4 py-1.5 text-xs font-bold tracking-widest transition-all hover:scale-105"
            style={
              boardSize === opt.size
                ? {
                    background: '#040e07',
                    border: '1px solid #22c55e',
                    color: '#4ade80',
                    boxShadow: '0 0 10px #22c55e44',
                    borderRadius: '2px',
                  }
                : {
                    background: '#040e07',
                    border: '1px solid #1a4a2a',
                    color: '#166534',
                    borderRadius: '2px',
                  }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-4 flex w-full max-w-[400px] items-center justify-between font-mono text-sm">
        {isGhostRunning ? (
          <>
            <span style={{ color: '#93c5fd' }}>
              GHOST: <span style={{ color: '#bfdbfe', fontWeight: 'bold' }}>{ghostStep}</span>
              <span style={{ color: '#1e40af' }}>/{ghostMoveCount}</span>
            </span>
            <span style={{ color: '#1e3a5f' }}>
              {cleared}/{total} CLEARED
            </span>
          </>
        ) : (
          <>
            <span>
              <span style={{ color: moveColor, fontWeight: 'bold' }}>{game.moves}</span>
              <span style={{ color: limitColor }}>/{game.moveLimit}</span>
            </span>
            <span style={{ color: timerColor, fontWeight: 'bold' }}>{timerStr}</span>
            <span style={{ color: '#166534' }}>
              {cleared}/{total} CLR
            </span>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="mt-2 h-2 w-full max-w-[400px] overflow-hidden"
        style={{ background: '#040e07', border: '1px solid #0f2a18', borderRadius: '2px' }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${(cleared / total) * 100}%`,
            background: isGhostRunning ? '#60a5fa' : '#22c55e',
          }}
        />
      </div>

      {/* Par + best score */}
      {!isGhostRunning && !game.won && !game.lost && (
        <div
          className="mt-1 flex w-full max-w-[400px] justify-between font-mono text-xs"
          style={{ color: '#0f3a1c' }}
        >
          <span>PAR: {game.par}</span>
          {bestScore !== null && <span>BEST: {bestScore}</span>}
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={px}
        height={px}
        className="mt-4"
        style={{ borderRadius: '2px', touchAction: 'none' }}
      />

      {/* Ghost done banner */}
      {ghostDone && (
        <div className="mt-4 w-full max-w-[400px] text-center">
          <p className="font-mono text-sm" style={{ color: '#93c5fd' }}>
            GHOST CLEARED IN{' '}
            <span style={{ color: '#bfdbfe', fontWeight: 'bold' }}>{ghostMoveCount}</span> MOVES
          </p>
          <button
            onClick={() => restart()}
            className="mt-3 w-full py-2.5 text-sm font-bold tracking-widest transition-all hover:scale-105"
            style={{
              background: '#040e07',
              border: '1px solid #22c55e',
              color: '#4ade80',
              boxShadow: '0 0 10px #22c55e44',
              borderRadius: '2px',
            }}
          >
            NEW MISSION
          </button>
        </div>
      )}

      {/* D-pad */}
      {!ghostDone && (
        <div className="mt-5 grid grid-cols-3 gap-1" style={{ width: '141px' }}>
          <div />
          <DPadBtn label="▲" onClick={() => move('n')} disabled={isGhostRunning} />
          <div />
          <DPadBtn label="◀" onClick={() => move('w')} disabled={isGhostRunning} />
          <div />
          <DPadBtn label="▶" onClick={() => move('e')} disabled={isGhostRunning} />
          <div />
          <DPadBtn label="▼" onClick={() => move('s')} disabled={isGhostRunning} />
          <div />
        </div>
      )}

      {/* ── Mission Briefing Modal ── */}
      {showBriefing && (
        <Modal>
          <div className="p-6">
            <h2
              className="text-center font-display text-xs tracking-[0.3em]"
              style={{ color: '#4ade80', textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66' }}
            >
              IED CLEARANCE PROTOCOL
            </h2>
            <div className="mt-1 text-center text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
              MISSION BRIEFING
            </div>
            <ModalDivider />
            <div
              className="mt-2 space-y-3 font-mono text-xs"
              style={{ color: '#86efac', lineHeight: '1.9' }}
            >
              <BriefingRow n={1}>
                Slide to sweep corridors. You stop at junctions and walls. Every cell must be
                cleared.
              </BriefingRow>
              <BriefingRow n={2} accent="#f97316">
                <span style={{ color: '#f97316' }}>MINES (×)</span> detonate on contact. Plan your
                route.
              </BriefingRow>
              <BriefingRow n={3} accent="#fb923c">
                <span style={{ color: '#fb923c' }}>PATROL</span> advances each move. Don&apos;t let
                it reach you.
              </BriefingRow>
              <BriefingRow n={4}>
                Cleared cells{' '}
                <span style={{ color: '#16190a', background: '#4ade80', padding: '0 3px' }}>
                  fade
                </span>{' '}
                over time. Revisit to refresh.
              </BriefingRow>
            </div>
            <p className="mt-5 text-center text-xs tracking-wider" style={{ color: '#0f4a22' }}>
              USE ARROW KEYS, WASD, OR THE D-PAD
            </p>
            <button
              onClick={startGame}
              className="mt-4 w-full py-2.5 text-sm font-bold tracking-[0.2em] transition-all hover:scale-105"
              style={{
                background: '#040e07',
                border: '1px solid #22c55e',
                color: '#4ade80',
                boxShadow: '0 0 10px #22c55e44',
                borderRadius: '2px',
              }}
            >
              BEGIN MISSION
            </button>
          </div>
        </Modal>
      )}

      {/* ── Mission Complete Modal ── */}
      {showComplete && (
        <Modal>
          <div
            style={{
              height: '3px',
              background:
                'linear-gradient(to right, transparent, #22c55e, #4ade80, #22c55e, transparent)',
              animation: 'header-pulse 1.5s ease-in-out infinite',
            }}
          />
          <div className="p-6 text-center">
            <div className="mb-2">
              <Stars count={getStars(game.moves, game.par)} />
            </div>
            <div
              className="font-display text-2xl tracking-[0.15em]"
              style={{
                color: '#4ade80',
                textShadow: '0 0 20px #22c55e, 0 0 60px #22c55e88, 0 0 100px #22c55e44',
                animation: 'title-glow 2s ease-in-out infinite',
              }}
            >
              AREA CLEAR
            </div>
            <div className="mt-1 text-xs tracking-[0.4em]" style={{ color: '#1a6632' }}>
              ALL IEDs NEUTRALIZED
            </div>

            <ModalDivider />

            <p className="mt-2 font-mono text-2xl font-bold" style={{ color: '#86efac' }}>
              {game.moves}{' '}
              <span className="text-sm font-normal" style={{ color: '#4ade80' }}>
                MOVE{game.moves !== 1 ? 'S' : ''}
              </span>
            </p>
            <p className="mt-1 font-mono text-xs" style={{ color: '#166534' }}>
              PAR: {game.par}
              {bestScore !== null && <span style={{ color: '#0f3a1c' }}> · BEST: {bestScore}</span>}
            </p>

            <div className="mt-5 flex gap-3">
              <button
                onClick={startGhost}
                className="flex-1 py-2.5 text-xs font-bold tracking-[0.15em] transition-all hover:scale-105"
                style={{
                  background: '#040e07',
                  border: '1px solid #1e3a5f',
                  color: '#93c5fd',
                  borderRadius: '2px',
                }}
              >
                WATCH GHOST
              </button>
              <button
                onClick={() => restart()}
                className="flex-1 py-2.5 text-xs font-bold tracking-[0.15em] transition-all hover:scale-105"
                style={{
                  background: '#040e07',
                  border: '1px solid #22c55e',
                  color: '#4ade80',
                  boxShadow: '0 0 10px #22c55e44',
                  borderRadius: '2px',
                }}
              >
                NEW MISSION
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Mission Failed Modal ── */}
      {showLost && (
        <Modal>
          <div
            style={{
              height: '3px',
              background:
                'linear-gradient(to right, transparent, #7f1d1d, #ef4444, #7f1d1d, transparent)',
              animation: 'header-pulse 1s ease-in-out infinite',
            }}
          />
          <div className="p-6 text-center">
            <div
              className="font-display text-2xl tracking-[0.15em]"
              style={{
                color: '#ef4444',
                textShadow: '0 0 20px #dc2626, 0 0 60px #ef444488',
              }}
            >
              MISSION FAILED
            </div>
            <div className="mt-1 text-xs tracking-[0.4em]" style={{ color: '#7f1d1d' }}>
              {game.lostReason === 'mine' && 'IED DETONATED'}
              {game.lostReason === 'patrol' && 'INTERCEPTED BY PATROL'}
              {game.lostReason === 'limit' && 'MOVE LIMIT EXCEEDED'}
              {game.lostReason === 'time' && 'TIME EXPIRED'}
            </div>

            <ModalDivider />

            <p className="mt-2 font-mono text-sm" style={{ color: '#86efac' }}>
              {game.paintedCount}/{total} CELLS CLEARED
            </p>
            <p className="mt-1 font-mono text-xs" style={{ color: '#166534' }}>
              {game.moves} MOVE{game.moves !== 1 ? 'S' : ''} · PAR: {game.par}
            </p>

            <div className="mt-5 flex gap-3">
              <button
                onClick={retryGame}
                className="flex-1 py-2.5 text-xs font-bold tracking-[0.15em] transition-all hover:scale-105"
                style={{
                  background: '#040e07',
                  border: '1px solid #7f1d1d',
                  color: '#fca5a5',
                  borderRadius: '2px',
                }}
              >
                RETRY
              </button>
              <button
                onClick={() => restart()}
                className="flex-1 py-2.5 text-xs font-bold tracking-[0.15em] transition-all hover:scale-105"
                style={{
                  background: '#040e07',
                  border: '1px solid #22c55e',
                  color: '#4ade80',
                  boxShadow: '0 0 10px #22c55e44',
                  borderRadius: '2px',
                }}
              >
                NEW MISSION
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes header-pulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1;   }
        }
        @keyframes title-glow {
          0%, 100% { text-shadow: 0 0 20px #22c55e, 0 0 60px #22c55e88; }
          50%       { text-shadow: 0 0 30px #4ade80, 0 0 90px #22c55eaa; }
        }
      `}</style>
    </div>
  );
}

function BriefingRow({ n, children, accent }: { n: number; children: ReactNode; accent?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-bold"
        style={{
          background: '#0a2a14',
          border: `1px solid ${accent ?? '#1a6632'}`,
          borderRadius: '2px',
          color: accent ?? '#4ade80',
          fontFamily: 'monospace',
        }}
      >
        {n}
      </span>
      <span style={{ color: '#86efac' }}>{children}</span>
    </div>
  );
}
