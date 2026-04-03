import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink, CrtOverlay, GameDivider, Leaderboard } from '../components/GameShell';
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
import { getLeaderboard, type LeaderboardResult } from '../games/leaderboard';
import { launchConfetti } from '../games/confetti';

export default function Breakout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);

  const [phase, setPhase] = useState<string>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(() => getHighScore());
  const [lb, setLb] = useState<LeaderboardResult | null>(null);

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
    setLb(null);
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

      // Sync React state only when values change
      if (s.phase !== state.phase) setPhase(s.phase);
      if (s.score !== state.score) setScore(s.score);
      if (s.lives !== state.lives) setLives(s.lives);
      if (s.level !== state.level) setLevel(s.level);

      // Save high score on game over
      if (s.phase === 'game-over' && state.phase !== 'game-over') {
        saveHighScore(s.score);
        setHighScore(getHighScore());
        const result = getLeaderboard(
          { gameId: 'breakout', baseScore: 15, lowerIsBetter: false },
          s.score
        );
        setLb(result);
        if (result.isNewBest || (result.playerRank !== null && result.playerRank <= 5)) {
          launchConfetti();
        }
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
    <div
      className="flex h-[100dvh] flex-col items-center px-2 pb-8 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />

      {/* Header row */}
      <div className="mb-3 flex w-full max-w-[400px] items-center justify-between px-1">
        <BackLink />
        <div className="flex gap-3 font-mono text-xs" style={{ color: '#86efac' }}>
          <span>
            LVL <span style={{ color: '#4ade80' }}>{level}</span>
          </span>
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
          BREAKOUT
        </h1>
        <div className="text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          BRICK DEMOLITION SYSTEM
        </div>
      </div>

      {/* Divider */}
      <GameDivider />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="touch-none"
        onPointerMove={handlePointerMove}
        onClick={handleTap}
        style={{
          maxWidth: '100%',
          border: '1px solid #1a6632',
          borderRadius: '2px',
        }}
      />

      {/* Status messages */}
      <div className="mt-3 text-center font-mono text-sm" style={{ color: '#4ade80' }}>
        {phase === 'ready' && 'TAP TO LAUNCH'}
        {phase === 'dead' && 'TAP TO CONTINUE'}
        {phase === 'game-over' && (
          <span style={{ color: '#dc2626' }}>MISSION FAILED — TAP TO RETRY</span>
        )}
        {phase === 'playing' && lives > 0 && (
          <span className="flex items-center justify-center gap-1" style={{ color: '#dc2626' }}>
            {Array.from({ length: lives }, (_, i) => (
              <span key={i}>■</span>
            ))}
          </span>
        )}
      </div>
      {phase === 'game-over' && lb && (
        <Leaderboard result={lb} className="mt-3 w-full max-w-[400px]" />
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
