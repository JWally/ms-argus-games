import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink, CrtOverlay, GameDivider } from '../components/GameShell';
import {
  type GameState,
  initGame,
  startPlaying,
  selectCell,
  aiMove,
  tick,
  render,
  cellAtPoint,
} from '../games/checkers/engine';
import { launchConfetti } from '../games/confetti';

export default function Checkers() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const aiTimerRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>('ready');
  const lastTurnRef = useRef<'player' | 'ai'>('player');

  const [phase, setPhase] = useState<string>('ready');
  const [turn, setTurn] = useState<'player' | 'ai'>('player');

  const getCanvasSize = useCallback(() => {
    const w = Math.min(window.innerWidth - 16, 420);
    const h = Math.min(window.innerHeight - 100, 520);
    return { w: Math.max(w, 280), h: Math.max(h, 380) };
  }, []);

  const resetGame = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;

    stateRef.current = initGame(w, h);
    setPhase('ready');
    setTurn('player');
  }, [getCanvasSize]);

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
      }
      if (s.turn !== prevTurn) {
        lastTurnRef.current = s.turn;
        setTurn(s.turn);
      }

      if (s.phase === 'done' && prevPhase !== 'done' && s.winner === 'player') {
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

  // AI turn
  useEffect(() => {
    if (phase === 'playing' && turn === 'ai') {
      aiTimerRef.current = window.setTimeout(() => {
        if (stateRef.current) {
          stateRef.current = aiMove(stateRef.current);
        }
      }, 450);
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

    if (state.turn === 'player') {
      const cell = cellAtPoint(state, px, py);
      if (cell) {
        stateRef.current = selectCell(state, cell[0], cell[1]);
      }
    }
  }, []);

  // Keyboard
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

  return (
    <div
      className="flex h-[100dvh] flex-col items-center px-2 pb-3 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />

      {/* Header row */}
      <div className="mb-2 flex w-full max-w-[420px] items-center justify-between px-1">
        <BackLink />
        <div className="font-mono text-xs">
          {phase === 'playing' && turn === 'player' && (
            <span style={{ color: '#4ade80' }}>YOUR TURN</span>
          )}
          {phase === 'playing' && turn === 'ai' && (
            <span style={{ color: '#f59e0b' }}>OPPONENT CALCULATING...</span>
          )}
        </div>
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
          CHECKERS
        </h1>
        <div className="text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          TACTICAL BOARD ENGAGEMENT
        </div>
      </div>

      {/* Divider */}
      <GameDivider className="my-2 max-w-[420px]" />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="touch-none"
        onClick={handleClick}
        style={{
          border: '1px solid #1a6632',
          borderRadius: '2px',
        }}
      />

      {/* Ready hint */}
      {phase === 'ready' && (
        <p className="mt-2 font-mono text-xs tracking-widest" style={{ color: '#166534' }}>
          TAP TO BEGIN — YOU ARE RED, JUMP TO CAPTURE
        </p>
      )}

      <style>{`
        @keyframes bs-victory {
          0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
          15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
          30%  { transform: scale(0.97) rotate(-1deg); filter: brightness(1.4); }
          100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
        }
        @keyframes bs-defeat {
          0%   { transform: translate(0,0) rotate(0deg); }
          10%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8) saturate(2); }
          30%  { transform: translate(-6px,1px) rotate(-1.5deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
