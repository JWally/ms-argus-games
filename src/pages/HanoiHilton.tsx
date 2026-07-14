import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCabinet } from '../components/GameCabinet';
import { Leaderboard } from '../components/GameShell';
import { getLeaderboard, type LeaderboardResult } from '../games/leaderboard';
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
  const [lb, setLb] = useState<LeaderboardResult | null>(null);

  // Internal resolution stays at the engine's designed ~440x420 (its disk
  // sizes cap in internal px); desktop bigification happens via CSS width
  // on the <canvas>. Clicks stay correct at any CSS size because the
  // handler maps through getBoundingClientRect.
  const getCanvasSize = useCallback(() => {
    const w = Math.min(window.innerWidth - 60, 440);
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

      if (s.phase !== lastPhaseRef.current) {
        lastPhaseRef.current = s.phase;
        setPhase(s.phase);

        if (s.phase === 'done') {
          if (s.moves <= s.par) launchConfetti();
          setLb(
            getLeaderboard(
              {
                gameId: `hanoi-${s.numDisks}`,
                baseScore: Math.round(s.par * 1.5),
                lowerIsBetter: true,
              },
              s.moves
            )
          );
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

  const status = (
    <p
      className="text-center font-mono text-xs tracking-widest lg:text-sm"
      style={{ color: '#86efac' }}
    >
      {phase === 'playing'
        ? 'CLICK A PEG — OR KEYS A / B / C, 1 / 2 / 3'
        : phase === 'done'
          ? 'SOLVED! CLICK THE BOARD FOR THE MENU'
          : 'PICK A DISK COUNT TO START'}
    </p>
  );

  const rules = (
    <ul
      className="flex flex-col gap-1.5 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· MOVE THE WHOLE STACK TO THE RIGHT PEG</li>
      <li>· CLICK A PEG TO PICK UP ITS TOP DISK</li>
      <li>· CLICK ANOTHER PEG TO DROP IT THERE</li>
      <li>· NO DISK MAY SIT ON A SMALLER DISK</li>
      <li>· MATCH PAR FOR A PERFECT SOLVE</li>
    </ul>
  );

  return (
    <GameCabinet
      title="TOWER OF HANOI"
      subtitle="MOVE THE STACK, ONE DISK AT A TIME"
      tag="Puzzle"
      onRestart={resetGame}
      status={status}
      rules={rules}
      sidebar={phase === 'done' && lb ? <Leaderboard result={lb} /> : undefined}
    >
      <canvas
        ref={canvasRef}
        className="max-w-full touch-none"
        onClick={handleClick}
        style={{
          border: '1px solid #1a6632',
          borderRadius: '2px',
          // Phone → natural size; desktop → CSS-upscale toward the cabinet
          // column, height-capped so the page never scrolls.
          width: 'min(100%, clamp(400px, 62vh, 600px))',
          height: 'auto',
        }}
      />
    </GameCabinet>
  );
}
