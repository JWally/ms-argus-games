import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink, CrtOverlay } from '../components/GameShell';
import {
  type GameState,
  initGame,
  startGame,
  goToMenu,
  selectPeg,
  tick,
  render,
  pegAtPoint,
  menuDiskAtPoint,
} from '../games/hanoi-hilton/engine';
import { launchConfetti } from '../games/confetti';

export default function HanoiHilton() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>('menu');

  const [phase, setPhase] = useState<string>('menu');

  const getCanvasSize = useCallback(() => {
    const w = Math.min(window.innerWidth - 16, 440);
    const h = Math.min(window.innerHeight - 100, 420);
    return { w: Math.max(w, 300), h: Math.max(h, 320) };
  }, []);

  const resetGame = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    stateRef.current = initGame(w, h);
    setPhase('menu');
    lastPhaseRef.current = 'menu';
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

        if (s.phase === 'done' && s.moves <= s.par) launchConfetti();
      }

      render(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;

    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (state.phase === 'menu') {
      const n = menuDiskAtPoint(state, px, py);
      if (n > 0) stateRef.current = startGame(state, n);
      return;
    }

    if (state.phase === 'done') {
      stateRef.current = goToMenu(state);
      return;
    }

    if (state.phase === 'playing') {
      const peg = pegAtPoint(state, px, py);
      if (peg >= 0) stateRef.current = selectPeg(state, peg);
    }
  }, []);

  // Keyboard: 1/2/3 or A/B/C to select pegs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state || state.phase !== 'playing') return;
      const keyMap: Record<string, number> = {
        '1': 0,
        a: 0,
        A: 0,
        '2': 1,
        b: 1,
        B: 1,
        '3': 2,
        c: 2,
        C: 2,
      };
      const peg = keyMap[e.key];
      if (peg !== undefined) stateRef.current = selectPeg(state, peg);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (stateRef.current?.phase === 'menu') resetGame();
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
      <div className="mb-2 flex w-full max-w-[440px] items-center justify-between px-1">
        <BackLink />
        {phase === 'playing' && (
          <div className="font-mono text-xs" style={{ color: '#8b5cf6' }}>
            CLICK PEG TO MOVE
          </div>
        )}
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
          HANOI HILTON
        </h1>
        <div className="text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          RECURSIVE DISK RELOCATION EXERCISE
        </div>
      </div>

      {/* Divider */}
      <div
        className="my-2 h-px w-full max-w-[440px]"
        style={{
          background:
            'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
          boxShadow: '0 0 6px #22c55e44',
        }}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="touch-none"
        onClick={handleClick}
        style={{ border: '1px solid #1a6632', borderRadius: '2px' }}
      />

      {phase === 'playing' && (
        <p className="mt-2 font-mono text-xs tracking-widest" style={{ color: '#166534' }}>
          KEYS A / B / C OR 1 / 2 / 3 TO SELECT PEG
        </p>
      )}
    </div>
  );
}
