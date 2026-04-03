import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink, CrtOverlay, GameDivider, Leaderboard } from '../components/GameShell';
import { getLeaderboard, type LeaderboardResult } from '../games/leaderboard';
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
  const [lb, setLb] = useState<LeaderboardResult | null>(null);

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
    setLb(null);
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
        setLb(
          getLeaderboard({ gameId: 'peg-solitaire', baseScore: 90, lowerIsBetter: true }, score)
        );
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
            PEGS <span style={{ color: '#4ade80' }}>{pegsLeft}</span>
          </span>
          {highScore > 0 && <span style={{ color: '#166534' }}>BEST {highScore.toFixed(1)}s</span>}
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
          PEG SOLITAIRE
        </h1>
        <div className="text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          SINGLE UNIT ELIMINATION DRILL
        </div>
      </div>

      {/* Divider */}
      <GameDivider />

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

      {/* Hint / leaderboard */}
      {phase === 'ready' && (
        <p className="mt-2 font-mono text-xs tracking-widest" style={{ color: '#166534' }}>
          TAP TO BEGIN — JUMP PEGS TO ELIMINATE THEM
        </p>
      )}
      {phase === 'done' && lb && (
        <Leaderboard
          result={lb}
          className="mt-3 w-full max-w-[400px]"
          format={(s) => `${s.toFixed(1)}s`}
        />
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
