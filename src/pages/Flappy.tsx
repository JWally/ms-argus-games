import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type GameState,
  initGame,
  flap,
  tick,
  render,
  getHighScore,
  saveHighScore,
} from '../games/flappy/engine';
import { launchConfetti } from '../games/confetti';
import { getLeaderboard } from '../games/leaderboard';

export default function Flappy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);

  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<string>('ready');
  const [highScore, setHighScore] = useState(() => getHighScore());

  const getCanvasSize = useCallback(() => {
    const w = Math.min(window.innerWidth - 16, 400);
    const h = Math.min(window.innerHeight - 120, 600);
    return { w: Math.max(w, 280), h: Math.max(h, 400) };
  }, []);

  const startGame = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;

    stateRef.current = initGame(w, h);
    setScore(0);
    setPhase('ready');
    setHighScore(getHighScore());
  }, [getCanvasSize]);

  // Game loop
  useEffect(() => {
    startGame();

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
      if (s.score !== state.score) setScore(s.score);

      if (s.phase === 'dead' && state.phase !== 'dead') {
        saveHighScore(s.score);
        setHighScore(getHighScore());
        // Celebrate if good score
        if (s.score > 0) {
          const lb = getLeaderboard(
            { gameId: 'flappy', baseScore: 12, lowerIsBetter: false },
            s.score
          );
          if (lb.isNewBest || (lb.playerRank !== null && lb.playerRank <= 5)) {
            launchConfetti();
          }
        }
      }

      render(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = useCallback(() => {
    if (!stateRef.current) return;
    if (stateRef.current.phase === 'dead') {
      startGame();
      // Immediately start playing
      setTimeout(() => {
        if (stateRef.current) {
          stateRef.current = flap(stateRef.current);
        }
      }, 50);
      return;
    }
    stateRef.current = flap(stateRef.current);
  }, [startGame]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTap]);

  useEffect(() => {
    const onResize = () => {
      if (stateRef.current?.phase === 'ready') {
        startGame();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [startGame]);

  return (
    <div className="flex h-[100dvh] flex-col items-center bg-arcade-bg px-2 pb-3 pt-4">
      {/* Nav + stats */}
      <div className="mb-2 flex w-full max-w-[400px] items-center justify-between px-1">
        <Link to="/" className="text-sm text-arcade-accent hover:underline">
          &larr; Arcade
        </Link>
        <div className="flex gap-3 text-xs text-gray-400">
          <span>
            Score: <span className="text-white">{score}</span>
          </span>
          {highScore > 0 && <span>Best: {highScore}</span>}
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 touch-none rounded border border-arcade-border"
        onClick={handleTap}
        style={{ maxWidth: '100%', maxHeight: 'calc(100dvh - 80px)' }}
      />

      {/* Hint */}
      {phase === 'ready' && (
        <p className="mt-2 text-xs text-gray-500">Tap or press space to flap</p>
      )}
    </div>
  );
}
