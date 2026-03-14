import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type GameState,
  initGame,
  startPlaying,
  selectPeg,
  quitGame,
  tick,
  render,
  getHighScore,
  saveHighScore,
  pegIndexAtPoint,
  isQuitButtonHit,
} from '../games/peg-solitaire/engine';
import { launchConfetti } from '../games/confetti';

export default function PegSolitaire() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);

  const [phase, setPhase] = useState<string>('ready');
  const [pegsLeft, setPegsLeft] = useState(14);
  const [highScore, setHighScore] = useState(() => getHighScore());

  const getCanvasSize = useCallback(() => {
    const w = Math.min(window.innerWidth - 16, 400);
    const h = Math.min(window.innerHeight - 120, 450);
    return { w: Math.max(w, 280), h: Math.max(h, 340) };
  }, []);

  const resetGame = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;

    stateRef.current = initGame(w, h);
    setPegsLeft(14);
    setPhase('ready');
    setHighScore(getHighScore());
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
      if (s.pegsRemaining !== state.pegsRemaining) setPegsLeft(s.pegsRemaining);

      // Detect transition to done
      if (s.phase === 'done' && state.phase !== 'done' && s.pegsRemaining === 1) {
        const score = Math.round(s.elapsed / 100) / 10;
        saveHighScore(score);
        setHighScore(getHighScore());
        launchConfetti();
      }

      render(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click / tap handler
  const handleClick = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      const state = stateRef.current;
      if (!canvas || !state) return;

      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const py = ((e.clientY - rect.top) / rect.height) * canvas.height;

      if (state.phase === 'ready') {
        stateRef.current = startPlaying(state);
        return;
      }

      if (state.phase === 'done') {
        resetGame();
        return;
      }

      // Playing phase
      if (isQuitButtonHit(state, px, py)) {
        stateRef.current = quitGame(state);
        return;
      }

      const idx = pegIndexAtPoint(state, px, py);
      if (idx >= 0) {
        stateRef.current = selectPeg(state, idx);
      }
    },
    [resetGame]
  );

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (state.phase === 'ready') {
          stateRef.current = startPlaying(state);
        } else if (state.phase === 'done') {
          resetGame();
        }
      }

      if ((e.key === 'q' || e.key === 'Q') && state.phase === 'playing') {
        stateRef.current = quitGame(state);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resetGame]);

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
      {/* Nav + stats */}
      <div className="mb-2 flex w-full max-w-[400px] items-center justify-between px-1">
        <Link to="/" className="text-sm text-arcade-accent hover:underline">
          &larr; Arcade
        </Link>
        <div className="flex gap-3 text-xs text-gray-400">
          <span>
            Pegs: <span className="text-white">{pegsLeft}</span>
          </span>
          {highScore > 0 && <span>Best: {highScore.toFixed(1)}s</span>}
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="touch-none rounded border border-arcade-border"
        onClick={handleClick}
      />

      {/* Hint */}
      {phase === 'ready' && (
        <p className="mt-2 text-xs text-gray-500">Tap to start, jump pegs to remove them</p>
      )}
    </div>
  );
}
