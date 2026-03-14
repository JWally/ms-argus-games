import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

      if (s.phase !== state.phase) setPhase(s.phase);
      if (s.turn !== state.turn) setTurn(s.turn);

      if (s.phase === 'done' && state.phase !== 'done' && s.winner === 'player') {
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
    <div className="flex h-[100dvh] flex-col items-center bg-arcade-bg px-2 pb-3 pt-4">
      <div className="mb-2 flex w-full max-w-[420px] items-center justify-between px-1">
        <Link to="/" className="text-sm text-arcade-accent hover:underline">
          &larr; Arcade
        </Link>
        <div className="text-xs text-gray-400">
          {phase === 'playing' && turn === 'player' && (
            <span className="text-red-400">Your turn</span>
          )}
          {phase === 'playing' && turn === 'ai' && (
            <span className="text-gray-500">AI thinking...</span>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="touch-none rounded border border-arcade-border"
        onClick={handleClick}
      />

      {phase === 'ready' && (
        <p className="mt-2 text-xs text-gray-500">
          Tap to start — you&apos;re red, jump to capture
        </p>
      )}
    </div>
  );
}
