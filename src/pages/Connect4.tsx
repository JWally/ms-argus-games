import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCabinet } from '../components/GameCabinet';
import {
  type GameState,
  initGame,
  startPlaying,
  setHoverCol,
  dropDisc,
  aiMove,
  tick,
  render,
  colAtPoint,
} from '../games/connect-4/engine';
import { launchConfetti } from '../games/confetti';

export default function Connect4() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const aiTimerRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>('ready');
  const lastTurnRef = useRef<1 | 2>(1);

  const [phase, setPhase] = useState<string>('ready');
  const [turn, setTurn] = useState<1 | 2>(1);
  const [stats, setStats] = useState({ wins: 0, losses: 0 });

  const getCanvasSize = useCallback(() => {
    // Ataxx-style desktop-first sizing, adapted for the 7-wide × 6-tall
    // board: width is the driver — min(100vw - 64px, clamp(320px, 55vh,
    // 444px)) — where 444px is the width that reaches the engine's
    // 60px-cell cap. Height adds ~90px so the vertical constraint
    // ((h - 100) / 7 rows incl. hover) never shrinks the cells.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.max(280, Math.round(Math.min(vw - 64, Math.max(320, Math.min(vh * 0.55, 444)))));
    const h = Math.max(380, Math.round(Math.min(w + 90, vh - 160)));
    return { w, h };
  }, []);

  const resetGame = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;

    const s = initGame(w, h);
    stateRef.current = s;
    setPhase('ready');
    setTurn(1);
    setStats({ wins: s.wins, losses: s.losses });
  }, [getCanvasSize]);

  // Restart button — fresh board (stats persist in the engine)
  const restart = useCallback(() => {
    clearTimeout(aiTimerRef.current);
    if (stateRef.current) {
      stateRef.current = startPlaying(stateRef.current);
    }
  }, []);

  // Game loop
  useEffect(() => {
    resetGame();

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

      const prevPhase = lastPhaseRef.current;
      const prevTurn = lastTurnRef.current;
      if (s.phase !== prevPhase) {
        lastPhaseRef.current = s.phase;
        setPhase(s.phase);
        setStats({ wins: s.wins, losses: s.losses });
      }
      if (s.turn !== prevTurn) {
        lastTurnRef.current = s.turn;
        setTurn(s.turn);
      }

      // Detect player win
      if (s.phase === 'done' && prevPhase !== 'done' && s.winner === 1) {
        launchConfetti();
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

  // AI turn — slight delay so it feels natural
  useEffect(() => {
    if (phase === 'playing' && turn === 2) {
      aiTimerRef.current = window.setTimeout(() => {
        if (stateRef.current) {
          stateRef.current = aiMove(stateRef.current);
        }
      }, 400);
    }
    return () => clearTimeout(aiTimerRef.current);
  }, [phase, turn]);

  // Click handler
  const handleClick = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;

    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (state.phase === 'ready' || state.phase === 'done') {
      stateRef.current = startPlaying(state);
      return;
    }

    if (state.turn === 1) {
      const col = colAtPoint(state, px, py);
      if (col >= 0) {
        stateRef.current = dropDisc(state, col);
      }
    }
  }, []);

  // Hover for column indicator
  const handlePointerMove = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;

    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const col = colAtPoint(state, px, py);
    stateRef.current = setHoverCol(state, col);
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (stateRef.current) {
      stateRef.current = setHoverCol(stateRef.current, -1);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (state.phase === 'ready' || state.phase === 'done') {
          stateRef.current = startPlaying(state);
        }
      }

      // Number keys 1-7 to drop in columns
      if (state.phase === 'playing' && state.turn === 1) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 7) {
          stateRef.current = dropDisc(state, num - 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Resize
  useEffect(() => {
    const onResize = () => {
      if (stateRef.current?.phase === 'ready') {
        resetGame();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resetGame]);

  const status = (
    <p
      className="text-center font-mono text-xs tracking-widest lg:text-sm"
      style={{
        color: phase === 'playing' ? (turn === 1 ? '#4ade80' : '#f59e0b') : '#86efac',
      }}
    >
      {phase === 'ready'
        ? 'TAP THE BOARD TO START'
        : phase === 'done'
          ? 'GAME OVER — TAP THE BOARD FOR A REMATCH'
          : turn === 1
            ? 'YOUR TURN'
            : 'CPU THINKING...'}
    </p>
  );

  const rules = (
    <ul
      className="flex flex-col gap-1.5 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· CLICK A COLUMN TO DROP A DISC (KEYS 1–7 WORK TOO)</li>
      <li>· DISCS FALL TO THE LOWEST OPEN SLOT</li>
      <li>· LINE UP FOUR — ACROSS, DOWN, OR DIAGONAL — TO WIN</li>
      <li>· BLOCK THE CPU BEFORE IT CONNECTS FOUR</li>
    </ul>
  );

  return (
    <GameCabinet
      title="CONNECT 4"
      subtitle="DROP DISCS & LINE UP FOUR"
      tag="Strategy"
      record={stats.wins > 0 || stats.losses > 0 ? `${stats.wins}W – ${stats.losses}L` : undefined}
      onRestart={restart}
      status={status}
      rules={rules}
    >
      <canvas
        ref={canvasRef}
        className="touch-none"
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          maxWidth: '100%',
          height: 'auto',
          border: '1px solid #1a6632',
          borderRadius: '2px',
        }}
      />
    </GameCabinet>
  );
}
