import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCabinet } from '../components/GameCabinet';
import { Leaderboard } from '../components/GameShell';
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

// Fixed canvas backing resolution — the engine lays out the board in px
// against these. Display size is scaled with CSS only; the click handler
// maps through getBoundingClientRect so input stays correct at any scale.
const CANVAS_W = 400;
const CANVAS_H = 450;

export default function PegSolitaire() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);

  const [phase, setPhase] = useState<string>('ready');
  const [pegsLeft, setPegsLeft] = useState(14);
  const [highScore, setHighScore] = useState(() => getHighScore());
  const [lb, setLb] = useState<LeaderboardResult | null>(null);

  const resetGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    stateRef.current = initGame(CANVAS_W, CANVAS_H);
    setPegsLeft(14);
    setPhase('ready');
    setHighScore(getHighScore());
    setLb(null);
  }, []);

  // Game loop. Mount setup skips resetGame() — the React state initializers
  // already match, so only the canvas + engine state need initializing.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      stateRef.current = initGame(CANVAS_W, CANVAS_H);
    }

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

  const status = (
    <div
      className="flex items-center justify-center gap-4 font-mono text-xs lg:text-sm"
      style={{ color: '#86efac' }}
    >
      <span>
        PEGS <span style={{ color: '#4ade80' }}>{pegsLeft}</span>
      </span>
      {highScore > 0 && <span style={{ color: '#3f9e68' }}>BEST {highScore.toFixed(1)}s</span>}
    </div>
  );

  const rules = (
    <ul
      className="flex flex-col gap-3 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· TAP A PEG, THEN TAP WHERE IT LANDS</li>
      <li>· EVERY JUMP GOES OVER A NEIGHBOR INTO AN EMPTY HOLE</li>
      <li>· THE PEG YOU JUMPED OVER IS REMOVED</li>
      <li>· LEAVE JUST ONE PEG TO WIN</li>
      <li>· FASTEST CLEAR SETS YOUR BEST TIME</li>
    </ul>
  );

  return (
    <GameCabinet
      title="PEG SOLITAIRE"
      subtitle="JUMP PEGS — LEAVE JUST ONE"
      tag="Puzzle"
      record={highScore > 0 ? `BEST ${highScore.toFixed(1)}S` : undefined}
      onRestart={resetGame}
      status={status}
      rules={rules}
      sidebar={
        phase === 'done' && lb ? (
          <Leaderboard result={lb} format={(s) => `${s.toFixed(1)}s`} />
        ) : undefined
      }
    >
      {/* Canvas — backing stays 400×450, CSS scales it to fill the bezel */}
      <canvas
        ref={canvasRef}
        className="touch-none"
        onClick={handleClick}
        style={{
          border: '1px solid #1a6632',
          borderRadius: '2px',
          width: '100%',
          height: 'auto',
        }}
      />

      {/* Hint */}
      {phase === 'ready' && (
        <p
          className="mt-2 font-mono text-xs tracking-widest lg:text-sm"
          style={{ color: '#3f9e68' }}
        >
          TAP TO START — JUMP PEGS TO CLEAR THEM
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
    </GameCabinet>
  );
}
