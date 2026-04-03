import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink, CrtOverlay, GameDivider } from '../components/GameShell';
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
    <div
      className="flex h-[100dvh] flex-col items-center px-2 pb-3 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />

      {/* Header row */}
      <div className="mb-2 flex w-full max-w-[400px] items-center justify-between px-1">
        <BackLink />
        <div className="flex gap-3 font-mono text-xs" style={{ color: '#86efac' }}>
          <span>
            SCORE <span style={{ color: '#4ade80' }}>{score}</span>
          </span>
          {highScore > 0 && <span style={{ color: '#166534' }}>BEST {highScore}</span>}
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
          FLAPPY BIRD
        </h1>
        <div className="text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          AERIAL EVASION PROTOCOL
        </div>
      </div>

      {/* Divider */}
      <GameDivider />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 touch-none"
        onClick={handleTap}
        style={{
          maxWidth: '100%',
          maxHeight: 'calc(100dvh - 140px)',
          border: '1px solid #1a6632',
          borderRadius: '2px',
        }}
      />

      {/* Hint */}
      {phase === 'ready' && (
        <p className="mt-2 font-mono text-xs tracking-widest" style={{ color: '#166534' }}>
          TAP OR SPACE TO FLAP
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
