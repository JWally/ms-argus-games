import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCabinet } from '../components/GameCabinet';
import { Leaderboard } from '../components/GameShell';
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
  // Canvas aspect ratio (w/h) — drives the CSS upscale on desktop
  const [aspect, setAspect] = useState(400 / 560);

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
    setAspect(w / h);

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
  // Coordinates map through getBoundingClientRect, so the CSS upscale
  // below never skews paddle position.

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

  const status = (
    <div>
      <div
        className="flex items-center justify-between font-mono text-xs lg:text-sm"
        style={{ color: '#86efac' }}
      >
        <span>
          LVL <span style={{ color: '#4ade80' }}>{level}</span>
        </span>
        <span>
          SCORE <span style={{ color: '#4ade80' }}>{score}</span>
        </span>
        {highScore > 0 && <span style={{ color: '#3f9e68' }}>BEST {highScore}</span>}
      </div>
      <div
        className="mt-2 flex items-center justify-center text-center font-mono text-sm tracking-widest lg:text-base"
        style={{ color: '#4ade80' }}
      >
        {phase === 'ready' && 'TAP TO LAUNCH'}
        {phase === 'dead' && 'TAP TO CONTINUE'}
        {phase === 'game-over' && (
          <span style={{ color: '#dc2626' }}>GAME OVER — TAP TO RETRY</span>
        )}
        {phase === 'playing' && lives > 0 && (
          <span className="flex items-center justify-center gap-1" style={{ color: '#dc2626' }}>
            {Array.from({ length: lives }, (_, i) => (
              <span key={i}>■</span>
            ))}
          </span>
        )}
      </div>
    </div>
  );

  const rules = (
    <ul
      className="flex flex-col gap-3 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· SLIDE YOUR POINTER TO MOVE THE PADDLE</li>
      <li>· TAP TO LAUNCH THE BALL</li>
      <li>· CHAIN BRICK HITS FOR COMBO BONUSES</li>
      <li>· CLEAR THE WALL TO LEVEL UP</li>
      <li>· THREE BALLS — KEEP THEM OFF THE FLOOR</li>
    </ul>
  );

  return (
    <GameCabinet
      title="BREAKOUT"
      subtitle="SMASH EVERY BRICK"
      tag="Arcade"
      record={highScore > 0 ? `BEST ${highScore}` : undefined}
      onRestart={startGame}
      status={status}
      rules={rules}
      sidebar={
        phase === 'game-over' && lb ? <Leaderboard result={lb} className="w-full" /> : undefined
      }
    >
      <canvas
        ref={canvasRef}
        className="touch-none"
        onPointerMove={handlePointerMove}
        onClick={handleTap}
        style={{
          // Fill the bezel width, but never grow taller than ~65vh — a
          // portrait canvas at full column width would tower past the
          // fold on desktop. Upscale is CSS-only; internal resolution
          // (and physics) unchanged. Pointer input maps through
          // getBoundingClientRect so it stays exact at any display size.
          width: `min(100%, calc(65vh * ${aspect}))`,
          height: 'auto',
          aspectRatio: `${aspect}`,
          border: '1px solid #1a6632',
          borderRadius: '2px',
        }}
      />
    </GameCabinet>
  );
}
