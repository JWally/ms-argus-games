import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type GameState,
  type WeaponId,
  WEAPONS,
  checkPostExplosion,
  fireProjectile,
  initGame,
  render,
  tick,
} from '../games/scorched-earth/engine';

const ALL_WEAPON_IDS: WeaponId[] = ['basic', 'napalm'];

export default function ScorchedEarth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(60);

  const [angle, setAngle] = useState(60);
  const [power, setPower] = useState(60);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>('basic');
  const [unlockedWeapons] = useState<WeaponId[]>(['basic', 'napalm']);
  const [phase, setPhase] = useState<string>('player-aim');
  const [playerHP, setPlayerHP] = useState(100);
  const [aiHP, setAIHP] = useState(100);
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);

  // ── Canvas sizing ──────────────────────────────────────────────────────────

  const getCanvasSize = useCallback(() => {
    const w = Math.min(window.innerWidth, 900);
    // Leave room for controls — roughly 180px on mobile
    const h = Math.min(window.innerHeight - 200, 500);
    return { w: Math.max(w, 300), h: Math.max(h, 200) };
  }, []);

  // ── Init game ──────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    const { w, h } = getCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;

    const state = initGame(w, h);
    stateRef.current = state;
    setAngle(60);
    setPower(60);
    setSelectedWeapon('basic');
    setPhase('player-aim');
    setPlayerHP(100);
    setAIHP(100);
    setWinner(null);
  }, [getCanvasSize]);

  // ── Game loop ──────────────────────────────────────────────────────────────

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

      // Tick physics
      let s = tick(state, 1);
      s = checkPostExplosion(s);
      stateRef.current = s;

      // Sync React state — React de-dupes when value unchanged
      setPhase(s.phase);
      setPlayerHP(s.player.hp);
      setAIHP(s.ai.hp);
      setWinner(s.winner);

      // Keep player barrel angle in sync for visual feedback
      if (s.phase === 'player-aim') {
        s.player.angle = angleRef.current;
      }

      // Render
      render(ctx, s);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep engine player angle in sync with slider
  useEffect(() => {
    angleRef.current = angle;
    if (stateRef.current && stateRef.current.phase === 'player-aim') {
      stateRef.current.player.angle = angle;
    }
  }, [angle]);

  // ── Handle resize ──────────────────────────────────────────────────────────

  useEffect(() => {
    const onResize = () => {
      // Only resize if game is in aiming phase to avoid disrupting animations
      if (stateRef.current?.phase === 'player-aim') {
        startGame();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [startGame]);

  // ── Fire handler ───────────────────────────────────────────────────────────

  const handleFire = useCallback(() => {
    const state = stateRef.current;
    if (!state || state.phase !== 'player-aim') return;

    const weapon = WEAPONS[selectedWeapon];
    const s = fireProjectile({
      state,
      fromTank: state.player,
      angleDeg: angle,
      power,
      weapon,
      flipAngle: false,
    });
    s.phase = 'player-fire';
    stateRef.current = s;
    setPhase('player-fire');
  }, [angle, power, selectedWeapon]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const canFire = phase === 'player-aim';
  const isBusy = phase !== 'player-aim' && phase !== 'game-over';
  const availableWeapons = ALL_WEAPON_IDS.filter((id) => unlockedWeapons.includes(id));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-arcade-bg">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2">
        <Link to="/" className="text-sm text-arcade-accent hover:underline">
          &larr; Arcade
        </Link>
        <h1 className="font-display text-xs text-arcade-accent sm:text-sm">SCORCHED EARTH</h1>
        <div className="flex gap-3 text-xs">
          <span className="text-blue-400">YOU: {playerHP}</span>
          <span className="text-red-400">CPU: {aiHP}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex flex-1 items-center justify-center px-1">
        <canvas
          ref={canvasRef}
          className="rounded border border-arcade-border"
          style={{ maxWidth: '100%', touchAction: 'none' }}
        />
      </div>

      {/* Game over overlay */}
      {winner && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70">
          <p className="font-display text-lg text-white">
            {winner === 'player' ? 'YOU WIN!' : 'YOU LOSE'}
          </p>
          <button
            onClick={startGame}
            className="mt-4 rounded bg-arcade-accent px-6 py-2 font-bold text-white hover:bg-arcade-accent-hover active:scale-95"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Controls bar */}
      <div className="border-t border-arcade-border bg-arcade-card px-3 pb-4 pt-3">
        {/* Status line */}
        {isBusy && (
          <p className="mb-2 text-center text-xs text-gray-400">
            {phase === 'ai-wait' || phase === 'ai-fire'
              ? 'CPU is aiming...'
              : phase === 'explosion'
                ? 'Boom!'
                : 'Firing...'}
          </p>
        )}

        <div className="flex flex-wrap items-end justify-center gap-3">
          {/* Angle */}
          <div className="flex flex-col items-center">
            <label className="mb-1 text-[10px] uppercase text-gray-400">Angle: {angle}&deg;</label>
            <input
              type="range"
              min={5}
              max={175}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              disabled={!canFire}
              className="h-2 w-28 cursor-pointer accent-arcade-accent disabled:opacity-40 sm:w-36"
            />
          </div>

          {/* Power */}
          <div className="flex flex-col items-center">
            <label className="mb-1 text-[10px] uppercase text-gray-400">Power: {power}%</label>
            <input
              type="range"
              min={10}
              max={100}
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
              disabled={!canFire}
              className="h-2 w-28 cursor-pointer accent-arcade-accent disabled:opacity-40 sm:w-36"
            />
          </div>

          {/* Weapon selector */}
          {availableWeapons.length > 1 && (
            <div className="flex flex-col items-center">
              <label className="mb-1 text-[10px] uppercase text-gray-400">Weapon</label>
              <div className="flex gap-1">
                {availableWeapons.map((id) => (
                  <button
                    key={id}
                    onClick={() => setSelectedWeapon(id)}
                    disabled={!canFire}
                    className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                      selectedWeapon === id
                        ? 'bg-arcade-accent text-white'
                        : 'bg-arcade-border text-gray-300 hover:bg-arcade-accent/30'
                    } disabled:opacity-40`}
                  >
                    {WEAPONS[id].name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fire button */}
          <button
            onClick={handleFire}
            disabled={!canFire}
            className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold uppercase text-white shadow-lg transition-all hover:bg-red-500 active:scale-95 disabled:opacity-30"
          >
            Fire!
          </button>
        </div>
      </div>
    </div>
  );
}
