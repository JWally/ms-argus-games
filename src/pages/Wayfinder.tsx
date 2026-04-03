import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink, CrtOverlay, GameDivider } from '../components/GameShell';
import {
  type GameState,
  initGame,
  newGame,
  startRouting,
  resetRoute,
  undoMove,
  visitCity,
  setHoverCity,
  tick,
  render,
  cityAtPoint,
  doneButtonAtPoint,
  MIN_CITIES,
  MAX_CITIES,
} from '../games/wayfinder/engine';
import { launchConfetti } from '../games/confetti';

const BORDER_GREEN_DIM = '1px solid #1a6632';

export default function Wayfinder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>('ready');
  const briefingSeenRef = useRef<boolean>(false); // only type once per session

  const [phase, setPhase] = useState<string>('ready');
  const [numCities, setNumCities] = useState(8);

  const getCanvasSize = useCallback(() => {
    const w = Math.min(window.innerWidth - 16, 420);
    const h = Math.min(window.innerHeight - 130, 460);
    return { w: Math.max(w, 300), h: Math.max(h, 340) };
  }, []);

  const resetGame = useCallback(
    (n?: number, keepPhase?: 'routing') => {
      const { w, h } = getCanvasSize();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = w;
      canvas.height = h;
      const cities = n ?? numCities;
      const instant = briefingSeenRef.current;
      if (keepPhase === 'routing') {
        stateRef.current = newGame(
          stateRef.current ?? initGame(w, h, cities, instant),
          cities,
          instant
        );
      } else {
        stateRef.current = initGame(w, h, cities, instant);
      }
      const newPhase = keepPhase ?? 'ready';
      setPhase(newPhase);
      lastPhaseRef.current = newPhase;
    },
    [getCanvasSize, numCities]
  );

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
        const prev = lastPhaseRef.current;
        lastPhaseRef.current = s.phase;
        setPhase(s.phase);

        if (s.phase === 'routing') briefingSeenRef.current = true;

        if (s.phase === 'done' && prev !== 'done' && s.routeLength <= s.optLength * 1.02) {
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

  const handleClick = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;

    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (state.phase === 'ready') {
      stateRef.current = startRouting(state);
      return;
    }

    if (state.phase === 'done' || state.phase === 'failed') {
      const btn = doneButtonAtPoint(state, px, py);
      if (btn === 'retry') stateRef.current = startRouting({ ...state, route: [], routeLength: 0 });
      else if (btn === 'new') stateRef.current = newGame(state);
      return;
    }

    if (state.phase === 'routing') {
      const cityId = cityAtPoint(state, px, py);
      if (cityId >= 0) stateRef.current = visitCity(state, cityId);
    }
  }, []);

  const handlePointerMove = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state || state.phase !== 'routing') return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    stateRef.current = setHoverCity(state, px, py);
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (stateRef.current?.phase === 'routing')
      stateRef.current = setHoverCity(stateRef.current, -Infinity, -Infinity);
  }, []);

  const handleUndo = useCallback(() => {
    if (stateRef.current?.phase === 'routing') stateRef.current = undoMove(stateRef.current);
  }, []);

  const handleCityCount = useCallback(
    (delta: number) => {
      const next = Math.max(MIN_CITIES, Math.min(MAX_CITIES, numCities + delta));
      if (next === numCities) return;
      setNumCities(next);
      // Stay in routing if already playing, otherwise reset to ready
      const curPhase = stateRef.current?.phase;
      resetGame(next, curPhase === 'routing' ? 'routing' : undefined);
    },
    [numCities, resetGame]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;
      if ((e.key === 'u' || e.key === 'U') && state.phase === 'routing')
        stateRef.current = undoMove(state);
      if ((e.key === 'r' || e.key === 'R') && state.phase === 'routing')
        stateRef.current = resetRoute(state);
      if ((e.key === 'n' || e.key === 'N') && (state.phase === 'done' || state.phase === 'failed'))
        stateRef.current = newGame(state);
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

  const isExact = numCities <= 14;

  return (
    <div
      className="flex h-[100dvh] flex-col items-center px-2 pb-3 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />

      {/* Header row */}
      <div className="mb-2 flex w-full max-w-[420px] items-center justify-between px-1">
        <BackLink />
        {phase === 'routing' && (
          <button
            onClick={handleUndo}
            className="font-mono text-xs font-bold tracking-wider transition-colors hover:underline"
            style={{ color: '#166534' }}
          >
            UNDO (U)
          </button>
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
          WAYFINDER
        </h1>
        <div className="text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          MINIMUM FUEL SUPPLY RUN PROTOCOL
        </div>
      </div>

      {/* Difficulty controls */}
      <div className="mt-2 mb-1 flex items-center gap-3">
        <button
          onClick={() => handleCityCount(-1)}
          disabled={numCities <= MIN_CITIES}
          className="flex h-7 w-7 items-center justify-center font-mono text-sm font-bold transition-colors disabled:opacity-25"
          style={{
            border: BORDER_GREEN_DIM,
            color: '#22c55e',
            background: '#040e07',
            borderRadius: '2px',
          }}
        >
          −
        </button>
        <div className="flex flex-col items-center">
          <span className="font-mono text-sm font-bold" style={{ color: '#4ade80' }}>
            {numCities} outposts
          </span>
          <span className="font-mono text-xs" style={{ color: '#166534' }}>
            {isExact ? 'exact solver' : 'heuristic solver'}
          </span>
        </div>
        <button
          onClick={() => handleCityCount(+1)}
          disabled={numCities >= MAX_CITIES}
          className="flex h-7 w-7 items-center justify-center font-mono text-sm font-bold transition-colors disabled:opacity-25"
          style={{
            border: BORDER_GREEN_DIM,
            color: '#22c55e',
            background: '#040e07',
            borderRadius: '2px',
          }}
        >
          +
        </button>
      </div>

      {/* Divider */}
      <GameDivider className="my-1 max-w-[420px]" />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="touch-none"
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ border: BORDER_GREEN_DIM, borderRadius: '2px' }}
      />

      {phase === 'ready' && (
        <p className="mt-1 font-mono text-xs tracking-widest" style={{ color: '#166534' }}>
          CLICK OUTPOSTS IN ORDER · RETURN TO BASE
        </p>
      )}
    </div>
  );
}
