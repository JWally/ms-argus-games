import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCabinet } from '../components/GameCabinet';
import { Leaderboard } from '../components/GameShell';
import {
  type GameState,
  initGame,
  startSession,
  setHoverCell,
  placeMarker,
  aiMove,
  tick,
  render,
  cellAtPoint,
} from '../games/tic-tac-toe/engine';
import { getLeaderboard, type LeaderboardResult } from '../games/leaderboard';
import { launchConfetti } from '../games/confetti';

// Player's persisted best (written by the leaderboard module)
function getBestScore(): number | null {
  try {
    const raw = localStorage.getItem('leaderboard-tic-tac-toe');
    if (!raw) return null;
    const best: unknown = JSON.parse(raw).best;
    return typeof best === 'number' ? best : null;
  } catch {
    return null;
  }
}

const GREEN_BORDER = '1px solid #22c55e';

// Status-slot readout — replaces the status line the canvas used to draw
function getStatusReadout(
  sessionPhase: string,
  gamePhase: 'playing' | 'result',
  lastResult: 'win' | 'loss' | 'draw' | null,
  turn: 1 | 2
): { text: string; color: string } {
  if (sessionPhase === 'finished') return { text: "TIME'S UP!", color: '#86efac' };
  if (sessionPhase !== 'running') return { text: '30 SECONDS ON THE CLOCK', color: '#86efac' };
  if (gamePhase === 'result') {
    if (lastResult === 'win') return { text: 'BOARD CLEARED!', color: '#4ade80' };
    if (lastResult === 'draw') return { text: 'DRAW — SURVIVED', color: '#facc15' };
    return { text: 'ELIMINATED!', color: '#ef4444' };
  }
  return turn === 1
    ? { text: 'YOUR MOVE', color: '#4ade80' }
    : { text: 'CPU THINKING...', color: '#f59e0b' };
}

// ── Intro modal ───────────────────────────────────────────────────────────

function IntroModal({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Game rules"
    >
      <div
        className="w-full max-w-sm"
        style={{
          background: '#040e07',
          border: GREEN_BORDER,
          boxShadow: '0 0 60px #22c55e22, 0 0 120px #22c55e0a',
          padding: '1.5rem',
          animation: 'modal-in 0.22s ease',
        }}
      >
        {/* eyebrow */}
        <div className="mb-2 font-mono text-xs tracking-[0.4em]" style={{ color: '#3f9e68' }}>
          READ FAST — THE CLOCK IS WAITING
        </div>

        {/* Title */}
        <h2 className="mb-0.5 text-center font-mono text-2xl font-black leading-tight tracking-tight">
          <span style={{ color: '#f97316', textShadow: '0 0 12px #f9731688' }}>e</span>
          <span style={{ color: '#fbbf24' }}>X</span>
          <span style={{ color: '#f97316', textShadow: '0 0 12px #f9731688' }}>treme!</span>
        </h2>
        <h2
          className="mb-5 text-center font-display text-xl font-black tracking-[0.1em]"
          style={{ color: '#4ade80', textShadow: '0 0 10px #22c55e88' }}
        >
          TIC-TAC-TOE
        </h2>

        {/* Rules */}
        <div className="mb-5 space-y-2">
          {[
            { text: '30 seconds.', accent: true },
            { text: 'Complete as many boards as possible.', accent: false },
            { text: "Lose once and you're done.", accent: false },
            { text: 'No bonus for winning.', accent: false },
            { text: 'Just. Survive.', accent: true },
          ].map((line, i) => (
            <p
              key={i}
              className={`font-mono text-base leading-snug lg:text-lg${line.accent ? ' font-bold' : ''}`}
              style={{
                color: line.accent ? '#4ade80' : '#86efac',
                textShadow: line.accent ? '0 0 8px #22c55e66' : 'none',
              }}
            >
              {line.text}
            </p>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onStart}
          className="w-full py-3 font-mono text-base font-black tracking-[0.15em] transition-all"
          style={{
            background: 'linear-gradient(135deg, #1a0a00, #0a2a14)',
            border: '1px solid #f97316',
            color: '#f97316',
            textShadow: '0 0 8px #f9731688',
            boxShadow: '0 0 16px #f9731622',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              'linear-gradient(135deg, #2a1200, #0f3a1e)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px #f9731644';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              'linear-gradient(135deg, #1a0a00, #0a2a14)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px #f9731622';
          }}
        >
          [LET&apos;S GO!]
        </button>
      </div>
    </div>
  );
}

// ── Leaderboard modal ─────────────────────────────────────────────────────

function LeaderboardModal({
  lb,
  totalScore,
  onPlayAgain,
}: {
  lb: LeaderboardResult;
  totalScore: number;
  onPlayAgain: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Session results"
      onClick={onPlayAgain}
    >
      <div
        className="w-full max-w-sm"
        style={{
          background: '#040e07',
          border: GREEN_BORDER,
          boxShadow: '0 0 60px #22c55e22',
          padding: '1.5rem',
          animation: 'modal-in 0.3s ease',
          maxHeight: '90dvh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mb-3 text-center font-mono text-sm tracking-[0.4em]"
          style={{ color: '#3f9e68' }}
        >
          TIME&apos;S UP!
        </div>

        <div
          className="mb-1 text-center font-mono text-5xl font-black"
          style={{ color: '#4ade80', textShadow: '0 0 24px #22c55e88' }}
        >
          {totalScore}
        </div>
        <div
          className="mb-5 text-center font-mono text-base font-bold tracking-[0.3em]"
          style={{ color: '#86efac' }}
        >
          BOARDS CLEARED
        </div>

        <Leaderboard result={lb} title="BLITZ LEADERBOARD" className="mb-5" />

        <button
          onClick={onPlayAgain}
          className="w-full py-2.5 font-mono text-xs font-bold tracking-[0.2em] transition-all"
          style={{
            background: '#0a2a14',
            border: GREEN_BORDER,
            color: '#4ade80',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#0f3a1e';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px #22c55e44';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#0a2a14';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          [ PLAY AGAIN ]
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function TicTacToe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const aiTimerRef = useRef<number>(0);
  const lastSessionPhaseRef = useRef<string>('idle');
  const lastGamePhaseRef = useRef<string>('playing');
  const lastTurnRef = useRef<number>(0); // 0 = sentinel, forces sync on first frame
  const lastGameCountRef = useRef<number>(0);

  const lastSecondsRef = useRef<number>(-1);
  const lastClearedRef = useRef<number>(-1);

  const [sessionPhase, setSessionPhase] = useState<string>('idle');
  const [turn, setTurn] = useState<1 | 2>(1);
  const [gameCount, setGameCount] = useState(0);
  const [gamePhase, setGamePhase] = useState<'playing' | 'result'>('playing');
  const [lastResult, setLastResult] = useState<'win' | 'loss' | 'draw' | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [cleared, setCleared] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [showLb, setShowLb] = useState(false);
  const [lb, setLb] = useState<LeaderboardResult | null>(null);
  const [finalScore, setFinalScore] = useState(0);

  // Read record fresh — it's cheap (localStorage) and avoids stale state
  const best = getBestScore();

  const getCanvasSize = useCallback(() => {
    // Backing resolution = the canvas's actual on-screen size × device
    // pixel ratio, so the grid renders pixel-crisp at any display size.
    // The canvas is square (the grid IS the canvas now — clock/score/
    // status chrome lives in the cabinet shell).
    const cssW = canvasRef.current?.clientWidth || 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(320, Math.round(cssW * dpr));
    return { w: px, h: px };
  }, []);

  const resetCanvas = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    stateRef.current = initGame(w, h);
    lastTurnRef.current = 0;
    lastGameCountRef.current = 0;
    lastSessionPhaseRef.current = 'idle';
    lastGamePhaseRef.current = 'playing';
    lastSecondsRef.current = -1;
    lastClearedRef.current = -1;
    setSessionPhase('idle');
    setTurn(1);
    setGamePhase('playing');
    setLastResult(null);
    setSeconds(30);
    setCleared(0);
  }, [getCanvasSize]);

  // Game loop
  useEffect(() => {
    resetCanvas();

    const loop = () => {
      const state = stateRef.current;
      const canvas = canvasRef.current;
      if (!state || !canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const s = tick(state, 1);
      stateRef.current = s;

      // ── AI fix: reset turn ref when game count advances ───────────────
      // This forces setTurn to fire even if turn value didn't change
      // (e.g. AI ended last game AND goes first in new game: turn stays 2)
      if (s.gameCount !== lastGameCountRef.current) {
        lastGameCountRef.current = s.gameCount;
        lastTurnRef.current = 0; // sentinel: force next turn sync
        setGameCount(s.gameCount);
      }

      // Sync session phase
      if (s.sessionPhase !== lastSessionPhaseRef.current) {
        lastSessionPhaseRef.current = s.sessionPhase;
        setSessionPhase(s.sessionPhase);

        if (s.sessionPhase === 'finished') {
          const result = getLeaderboard(
            { gameId: 'tic-tac-toe', baseScore: 4, lowerIsBetter: false },
            s.boardsCleared
          );
          setLb(result);
          setFinalScore(s.boardsCleared);
          if (result.isNewBest || (result.playerRank !== null && result.playerRank <= 3)) {
            launchConfetti();
          }
          setTimeout(() => setShowLb(true), 800);
        }
      }

      // Sync game phase (drives the status-slot result readout) +
      // confetti on board win
      if (s.phase !== lastGamePhaseRef.current) {
        if (s.phase === 'result' && s.winner === 1) launchConfetti();
        lastGamePhaseRef.current = s.phase;
        setGamePhase(s.phase);
        setLastResult(s.lastResult);
      }

      // Sync turn (drives AI effect)
      if (s.turn !== lastTurnRef.current) {
        lastTurnRef.current = s.turn;
        setTurn(s.turn as 1 | 2);
      }

      // Sync HUD readouts (evicted from the canvas) only when they change
      const secs = Math.ceil(s.timeLeft);
      if (secs !== lastSecondsRef.current) {
        lastSecondsRef.current = secs;
        setSeconds(secs);
      }
      if (s.boardsCleared !== lastClearedRef.current) {
        lastClearedRef.current = s.boardsCleared;
        setCleared(s.boardsCleared);
      }

      render(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(aiTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI move — fires when turn syncs to 2 (including on new-game re-trigger via lastTurnRef reset)
  useEffect(() => {
    if (sessionPhase === 'running' && turn === 2) {
      aiTimerRef.current = window.setTimeout(() => {
        const s = stateRef.current;
        if (s && s.sessionPhase === 'running' && s.phase === 'playing' && s.turn === 2) {
          stateRef.current = aiMove(s);
        }
      }, 320);
    }
    return () => clearTimeout(aiTimerRef.current);
  }, [sessionPhase, turn, gameCount]);

  const doStartSession = useCallback(() => {
    if (stateRef.current) {
      stateRef.current = startSession(stateRef.current);
      lastTurnRef.current = 0;
      lastGameCountRef.current = 0;
    }
    setShowLb(false);
    setLb(null);
  }, []);

  const handleStart = useCallback(() => {
    setShowIntro(false);
    doStartSession();
  }, [doStartSession]);

  const handlePlayAgain = useCallback(() => {
    setShowLb(false);
    doStartSession();
  }, [doStartSession]);

  const handleClick = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;

    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (state.sessionPhase === 'running' && state.phase === 'playing' && state.turn === 1) {
      const cell = cellAtPoint(state, px, py);
      if (cell >= 0) stateRef.current = placeMarker(state, cell);
    }
  }, []);

  const handlePointerMove = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    stateRef.current = setHoverCell(state, cellAtPoint(state, px, py));
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (stateRef.current) stateRef.current = setHoverCell(stateRef.current, -1);
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;
      if (state.sessionPhase === 'running' && state.phase === 'playing' && state.turn === 1) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) stateRef.current = placeMarker(state, num - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (stateRef.current?.sessionPhase === 'idle') resetCanvas();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resetCanvas]);

  // HUD readouts evicted from the canvas — clock + boards cleared
  const clockRed = sessionPhase === 'running' && seconds <= 10;
  const clockFlash = sessionPhase === 'running' && seconds <= 5;
  const timeStr = `0:${String(Math.max(0, Math.min(59, seconds))).padStart(2, '0')}`;

  const readout = getStatusReadout(sessionPhase, gamePhase, lastResult, turn);

  const status = (
    <div className="flex items-center justify-center gap-4">
      <p className="font-mono text-xs tracking-widest lg:text-sm">
        <span
          style={{
            color: clockRed ? '#ef4444' : '#4ade80',
            animation: clockFlash ? 'hud-blink 0.4s steps(1) infinite' : undefined,
          }}
        >
          {timeStr}
        </span>
        <span style={{ color: '#3f9e68' }}>{' · '}</span>
        <span style={{ color: '#86efac' }}>CLEARED {cleared}</span>
      </p>
      <p className="font-mono text-xs tracking-widest lg:text-sm" style={{ color: readout.color }}>
        {readout.text}
      </p>
      {!showIntro && (
        <button
          className="font-mono text-xs tracking-widest transition-colors hover:underline lg:text-sm"
          style={{ color: '#3f9e68' }}
          onClick={() => setShowIntro(true)}
        >
          RULES
        </button>
      )}
    </div>
  );

  const rules = (
    <ul
      className="flex flex-col gap-3 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· YOU HAVE 30 SECONDS ON THE CLOCK</li>
      <li>· CLEAR AS MANY BOARDS AS YOU CAN — WINS AND DRAWS BOTH COUNT</li>
      <li>· CLICK A CELL OR PRESS KEYS 1–9 TO PLACE YOUR X</li>
      <li>· LOSE ONE BOARD AND YOUR RUN IS OVER</li>
    </ul>
  );

  return (
    <GameCabinet
      title="EXTREME! TIC-TAC-TOE"
      subtitle="30-SECOND BOARD-CLEARING BLITZ"
      tag="Strategy"
      record={best !== null ? `BEST ${best}` : undefined}
      onRestart={doStartSession}
      status={status}
      rules={rules}
    >
      {showIntro && <IntroModal onStart={handleStart} />}
      {showLb && lb && (
        <LeaderboardModal lb={lb} totalScore={finalScore} onPlayAgain={handlePlayAgain} />
      )}

      <canvas
        ref={canvasRef}
        className="touch-none"
        style={{
          // Square grid fills the bezel width, capped so it never grows
          // past ~72vh on desktop.
          width: 'min(100%, 72vh)',
          aspectRatio: '1',
          height: 'auto',
          border: '1px solid #1a6632',
          borderRadius: '2px',
        }}
        aria-label="eXtreme Tic-Tac-Toe game board"
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      />

      <style>{`
        @keyframes modal-in {
          0%   { opacity: 0; transform: scale(0.94) translateY(10px); }
          100% { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes hud-blink {
          0%  { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </GameCabinet>
  );
}
