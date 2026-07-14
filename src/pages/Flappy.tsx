import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCabinet } from '../components/GameCabinet';
import { Leaderboard } from '../components/GameShell';
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
import { getLeaderboard, type LeaderboardResult } from '../games/leaderboard';

export default function Flappy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);

  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<string>('ready');
  const [highScore, setHighScore] = useState(() => getHighScore());
  const [lb, setLb] = useState<LeaderboardResult | null>(null);
  // Canvas aspect ratio (w/h) — drives the CSS upscale on desktop
  const [aspect, setAspect] = useState(400 / 600);

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
    setAspect(w / h);

    stateRef.current = initGame(w, h);
    setScore(0);
    setPhase('ready');
    setHighScore(getHighScore());
    setLb(null);
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
        const result = getLeaderboard(
          { gameId: 'flappy', baseScore: 12, lowerIsBetter: false },
          s.score > 0 ? s.score : undefined
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

  const status = (
    <div>
      <div
        className="flex items-center justify-center gap-4 font-mono text-xs lg:text-sm"
        style={{ color: '#86efac' }}
      >
        <span>
          SCORE <span style={{ color: '#4ade80' }}>{score}</span>
        </span>
        {highScore > 0 && <span style={{ color: '#3f9e68' }}>BEST {highScore}</span>}
      </div>
      <p
        className="mt-2 text-center font-mono text-xs tracking-widest lg:text-sm"
        style={{ color: '#3f9e68' }}
      >
        {phase === 'ready' ? 'TAP OR SPACE TO FLAP' : phase === 'dead' ? 'TAP TO TRY AGAIN' : ' '}
      </p>
    </div>
  );

  const rules = (
    <ul
      className="flex flex-col gap-1.5 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· TAP OR PRESS SPACE TO FLAP</li>
      <li>· SQUEEZE THROUGH THE PIPE GAPS</li>
      <li>· EVERY PIPE YOU PASS SCORES 1 POINT</li>
      <li>· THE LONGER YOU FLY, THE FASTER IT GETS</li>
    </ul>
  );

  return (
    <GameCabinet
      title="FLAPPY BIRD"
      subtitle="FLAP THROUGH THE PIPES"
      tag="Arcade"
      record={highScore > 0 ? `BEST ${highScore}` : undefined}
      onRestart={startGame}
      status={status}
      rules={rules}
      sidebar={phase === 'dead' && lb ? <Leaderboard result={lb} className="w-full" /> : undefined}
    >
      <canvas
        ref={canvasRef}
        className="touch-none"
        onClick={handleTap}
        style={{
          // Upscale via CSS only — internal resolution (and physics) unchanged;
          // tap/space input is coordinate-free, so scaling can't break it.
          width: `min(100vw - 64px, calc(clamp(400px, 68vh, 620px) * ${aspect}))`,
          height: 'auto',
          maxWidth: '100%',
          border: '1px solid #1a6632',
          borderRadius: '2px',
        }}
      />
    </GameCabinet>
  );
}
