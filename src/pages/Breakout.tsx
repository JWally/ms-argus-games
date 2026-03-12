import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type GameState,
  initGame,
  launchBall,
  movePaddle,
  tick,
  render,
  continueAfterDeath,
  getHighScore,
  saveHighScore,
} from '../games/breakout/engine';

export default function Breakout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);

  const [phase, setPhase] = useState<string>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(() => getHighScore());

  // ── Canvas sizing (portrait-optimized) ────────────────────────────

  const getCanvasSize = useCallback(() => {
    const w = Math.min(window.innerWidth - 16, 400);
    const h = Math.min(window.innerHeight - 180, 560);
    return { w: Math.max(w, 280), h: Math.max(h, 380) };
  }, []);

  // ── Init ──────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;

    const state = initGame(w, h);
    stateRef.current = state;
    setPhase('ready');
    setScore(0);
    setLives(3);
    setLevel(1);
    setHighScore(getHighScore());
  }, [getCanvasSize]);

  // ── Game loop ─────────────────────────────────────────────────────

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

      // Sync React state
      setPhase(s.phase);
      setScore(s.score);
      setLives(s.lives);
      setLevel(s.level);

      // Save high score on game over
      if (s.phase === 'game-over') {
        saveHighScore(s.score);
        setHighScore(getHighScore());
      }

      render(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Touch / mouse controls ────────────────────────────────────────

  const handlePointerMove = useCallback((e: { clientX: number }) => {
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    stateRef.current = movePaddle(stateRef.current, x);
  }, []);

  const handleTap = useCallback(() => {
    if (!stateRef.current) return;
    const s = stateRef.current;
    if (s.phase === 'ready') {
      stateRef.current = launchBall(s);
    } else if (s.phase === 'dead') {
      stateRef.current = continueAfterDeath(s);
    } else if (s.phase === 'game-over') {
      startGame();
    }
  }, [startGame]);

  // ── Resize ────────────────────────────────────────────────────────

  useEffect(() => {
    const onResize = () => {
      if (stateRef.current?.phase === 'ready') {
        startGame();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [startGame]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center bg-arcade-bg px-2 pb-8 pt-4">
      {/* Nav */}
      <div className="mb-3 w-full max-w-[400px] px-2">
        <Link to="/" className="text-sm text-arcade-accent hover:underline">
          &larr; Back to Arcade
        </Link>
      </div>

      {/* Title + stats */}
      <div className="mb-3 flex w-full max-w-[400px] items-center justify-between px-2">
        <h1 className="font-display text-base text-arcade-accent sm:text-lg">BREAKOUT</h1>
        <div className="flex gap-3 text-xs text-gray-400">
          <span>Level {level}</span>
          <span>
            Score: <span className="text-white">{score}</span>
          </span>
          {highScore > 0 && <span>Best: {highScore}</span>}
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="touch-none rounded border border-arcade-border"
        onPointerMove={handlePointerMove}
        onClick={handleTap}
        style={{ maxWidth: '100%' }}
      />

      {/* Status messages */}
      <div className="mt-3 text-center text-sm text-gray-400">
        {phase === 'ready' && 'Tap to launch'}
        {phase === 'dead' && 'Tap to continue'}
        {phase === 'game-over' && 'Game over — tap to restart'}
        {phase === 'playing' && lives > 0 && (
          <span className="flex items-center justify-center gap-1">
            {Array.from({ length: lives }, (_, i) => (
              <span key={i} className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
