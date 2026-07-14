import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCabinet } from '../components/GameCabinet';
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
  const lastPhaseRef = useRef<string>('ready');
  const lastTurnRef = useRef<'player' | 'ai'>('player');

  const [phase, setPhase] = useState<string>('ready');
  const [turn, setTurn] = useState<'player' | 'ai'>('player');
  const [stats, setStats] = useState({ wins: 0, losses: 0 });

  const getCanvasSize = useCallback(() => {
    // Backing (internal) resolution only — the canvas element itself is
    // CSS-scaled to fill the bezel (width: 100%, height: auto). The 8×8
    // board's backing size caps at the engine's 65px-cell limit (520px
    // board); the canvas adds 24px side margin and ~130px vertical HUD
    // chrome around the board.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const board = Math.min(vw - 64, Math.max(320, Math.min(vh * 0.62, 520)));
    return {
      w: Math.max(280, Math.round(board + 24)),
      h: Math.max(380, Math.round(board + 130)),
    };
  }, []);

  const resetGame = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;

    const s = initGame(w, h);
    stateRef.current = s;
    setPhase('ready');
    setTurn('player');
    setStats({ wins: s.wins, losses: s.losses });
  }, [getCanvasSize]);

  // Restart button — deal a fresh board (stats persist in the engine)
  const restart = useCallback(() => {
    clearTimeout(aiTimerRef.current);
    if (stateRef.current) {
      stateRef.current = startPlaying(stateRef.current);
    }
  }, []);

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

      const prevPhase = lastPhaseRef.current;
      const prevTurn = lastTurnRef.current;
      if (s.phase !== prevPhase) {
        lastPhaseRef.current = s.phase;
        setPhase(s.phase);
        setStats({ wins: s.wins, losses: s.losses });
      }
      if (s.turn !== prevTurn) {
        lastTurnRef.current = s.turn;
        setTurn(s.turn);
      }

      if (s.phase === 'done' && prevPhase !== 'done' && s.winner === 'player') {
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

  const status = (
    <p
      className="text-center font-mono text-xs tracking-widest lg:text-sm"
      style={{
        color: phase === 'playing' ? (turn === 'player' ? '#4ade80' : '#f59e0b') : '#86efac',
      }}
    >
      {phase === 'ready'
        ? 'TAP THE BOARD TO START — YOU ARE RED'
        : phase === 'done'
          ? 'GAME OVER — TAP THE BOARD FOR A REMATCH'
          : turn === 'player'
            ? 'YOUR TURN'
            : 'CPU THINKING...'}
    </p>
  );

  const rules = (
    <ul
      className="flex flex-col gap-1.5 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· MOVE YOUR RED PIECES DIAGONALLY ON DARK SQUARES</li>
      <li>· JUMP OVER A CPU PIECE TO CAPTURE IT</li>
      <li>· IF A CAPTURE IS AVAILABLE, YOU MUST TAKE IT</li>
      <li>· REACH THE FAR ROW TO CROWN A KING — KINGS MOVE BOTH WAYS</li>
      <li>· CAPTURE EVERY CPU PIECE TO WIN</li>
    </ul>
  );

  return (
    <GameCabinet
      title="CHECKERS"
      subtitle="JUMP, CAPTURE, CROWN YOUR KINGS"
      tag="Strategy"
      record={stats.wins > 0 || stats.losses > 0 ? `${stats.wins}W – ${stats.losses}L` : undefined}
      onRestart={restart}
      status={status}
      rules={rules}
    >
      <canvas
        ref={canvasRef}
        className="touch-none"
        onClick={handleClick}
        style={{
          width: '100%',
          height: 'auto',
          border: '1px solid #1a6632',
          borderRadius: '2px',
        }}
      />
    </GameCabinet>
  );
}
