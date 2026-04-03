import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type GameState,
  initGame,
  startPlaying,
  setHoverCell,
  placeMarker,
  aiMove,
  tick,
  render,
  cellAtPoint,
} from '../games/tic-tac-toe/engine';
import { launchConfetti } from '../games/confetti';

export default function TicTacToe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const aiTimerRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>('ready');
  const lastTurnRef = useRef<1 | 2>(1);

  const [phase, setPhase] = useState<string>('ready');
  const [turn, setTurn] = useState<1 | 2>(1);

  const getCanvasSize = useCallback(() => {
    const w = Math.min(window.innerWidth - 16, 380);
    const h = Math.min(window.innerHeight - 100, 460);
    return { w: Math.max(w, 260), h: Math.max(h, 340) };
  }, []);

  const resetGame = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    stateRef.current = initGame(w, h);
    setPhase('ready');
    setTurn(1);
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

      if (s.phase !== lastPhaseRef.current) {
        lastPhaseRef.current = s.phase;
        setPhase(s.phase);
      }
      if (s.turn !== lastTurnRef.current) {
        lastTurnRef.current = s.turn;
        setTurn(s.turn);
      }

      if (s.phase === 'done' && lastPhaseRef.current !== 'done' && s.winner === 1) {
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

  // AI move after player's turn
  useEffect(() => {
    if (phase === 'playing' && turn === 2) {
      aiTimerRef.current = window.setTimeout(() => {
        if (stateRef.current) stateRef.current = aiMove(stateRef.current);
      }, 350);
    }
    return () => clearTimeout(aiTimerRef.current);
  }, [phase, turn]);

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

    if (state.phase === 'playing' && state.turn === 1) {
      const cell = cellAtPoint(state, px, py);
      if (cell >= 0) stateRef.current = placeMarker(state, cell);
    }
  }, []);

  const handlePointerMove = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    stateRef.current = setHoverCell(state, cellAtPoint(state, px, py));
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (stateRef.current) stateRef.current = setHoverCell(stateRef.current, -1);
  }, []);

  // Keyboard: 1-9 to place markers
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
      if (state.phase === 'playing' && state.turn === 1) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) stateRef.current = placeMarker(state, num - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (stateRef.current?.phase === 'ready') resetGame();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resetGame]);

  return (
    <div
      className="flex h-[100dvh] flex-col items-center px-2 pb-3 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      {/* CRT scanlines */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.15) 3px, rgba(0,10,0,0.15) 4px)',
          opacity: 0.5,
        }}
      />

      {/* Header row */}
      <div className="mb-2 flex w-full max-w-[380px] items-center justify-between px-1">
        <Link to="/" className="text-sm font-mono tracking-widest hover:underline transition-colors" style={{ color: '#22c55e' }}>
          &larr; Back to Arcade
        </Link>
        <div className="font-mono text-xs">
          {phase === 'playing' && turn === 1 && <span style={{ color: '#ef4444' }}>YOUR TURN (X)</span>}
          {phase === 'playing' && turn === 2 && <span style={{ color: '#facc15' }}>AI CALCULATING...</span>}
        </div>
      </div>

      {/* Title */}
      <div className="mb-1 text-center">
        <h1
          className="font-display text-lg tracking-[0.3em]"
          style={{ color: '#4ade80', textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66, 0 0 60px #22c55e33' }}
        >
          TIC-TAC-TOE
        </h1>
        <div className="text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          ZERO-SUM GRID DOMINANCE PROTOCOL
        </div>
      </div>

      {/* Divider */}
      <div
        className="my-2 h-px w-full max-w-[380px]"
        style={{
          background: 'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
          boxShadow: '0 0 6px #22c55e44',
        }}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="touch-none"
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ border: '1px solid #1a6632', borderRadius: '2px' }}
      />

      {phase === 'ready' && (
        <p className="mt-2 font-mono text-xs tracking-widest" style={{ color: '#166534' }}>
          TAP TO BEGIN — KEYS 1–9 TO PLACE MARKERS
        </p>
      )}
    </div>
  );
}
