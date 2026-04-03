import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import { BackLink, CrtOverlay, GameDivider } from '../components/GameShell';
import {
  createGame,
  reshuffleFleet,
  startGame,
  playerShoot,
  aiShoot,
  getShipDefs,
  type Cell,
  type GameState,
} from '../games/battleship/engine';

const COL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SHIP_DEFS = getShipDefs();

// ─── cell visual config ─────────────────────────────────────────────────────

type CellVariant = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk' | 'target-hover';

const CELL_STYLES: Record<CellVariant, CSSProperties> = {
  empty: {
    background: '#061510',
    border: '1px solid #0f2a18',
  },
  ship: {
    background: '#0a2a14',
    border: '1px solid #1a6632',
    boxShadow: 'inset 0 0 6px #0d4a22',
  },
  hit: {
    background: '#1c0407',
    border: '1px solid #7f1d1d',
    boxShadow: '0 0 8px #dc2626, inset 0 0 8px #7f1d1d',
  },
  miss: {
    background: '#05121a',
    border: '1px solid #0c3a5a',
    boxShadow: 'inset 0 0 4px #0c2a40',
  },
  sunk: {
    background: '#0d0202',
    border: '1px solid #450a0a',
    boxShadow: '0 0 4px #7f1d1d88',
  },
  'target-hover': {
    background: '#0a1f14',
    border: '1px solid #22c55e',
    boxShadow: '0 0 8px #22c55e66',
    cursor: 'crosshair',
  },
};

function cellVariant(cell: Cell, isHover: boolean, isEnemy: boolean): CellVariant {
  if (isHover && isEnemy && cell === 'empty') return 'target-hover';
  if (cell === 'ship' && isEnemy) return 'empty'; // hide enemy ships
  return cell as CellVariant;
}

// ─── grid component ──────────────────────────────────────────────────────────

interface GridProps {
  grid: Cell[][];
  isEnemy: boolean;
  label: string;
  hoverKey?: string | null;
  animKey?: string | null;
  onCellClick?: (r: number, c: number) => void;
  onCellHover?: (r: number, c: number) => void;
  onGridLeave?: () => void;
  disabled?: boolean;
}

function BattleGrid({
  grid,
  isEnemy,
  label,
  hoverKey,
  animKey,
  onCellClick,
  onCellHover,
  onGridLeave,
  disabled = false,
}: GridProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Grid label */}
      <div
        className="w-full text-center text-xs font-bold tracking-[0.25em]"
        style={{
          color: isEnemy ? '#f87171' : '#166534',
          textShadow: isEnemy ? '0 0 10px #dc2626, 0 0 20px #dc262666' : 'none',
        }}
      >
        {label}
      </div>

      {/* Outer glow frame */}
      <div
        style={{
          padding: '2px',
          background: 'linear-gradient(135deg, #0f3a1a, #071510, #0f3a1a)',
          boxShadow: isEnemy
            ? '0 0 20px #22c55e33, inset 0 0 20px #00000066'
            : '0 0 12px #0f4a2233, inset 0 0 12px #00000066',
          borderRadius: '4px',
          position: 'relative',
        }}
        onMouseLeave={onGridLeave}
      >
        {/* Scan line */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{
            height: '2px',
            background:
              'linear-gradient(to right, transparent, #22c55e44 20%, #22c55e88 50%, #22c55e44 80%, transparent)',
            animation: 'bs-scan 4s linear infinite',
          }}
        />

        {/* 9×9 grid: col-0 = row labels, row-0 = col labels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '14px repeat(8, 1fr)',
            gridTemplateRows: '14px repeat(8, 1fr)',
            gap: '2px',
            width: 'min(calc(100vw - 56px), 290px)',
          }}
        >
          {/* [0,0] corner */}
          <div />

          {/* Column header labels */}
          {COL_LABELS.map((l) => (
            <div
              key={l}
              className="flex items-center justify-center text-sm"
              style={{ color: '#1a5c2a' }}
            >
              {l}
            </div>
          ))}

          {/* Rows */}
          {ROW_LABELS.map((rowLabel, r) => (
            <>
              {/* Row label */}
              <div
                key={`lbl-${r}`}
                className="flex items-center justify-center text-sm"
                style={{ color: '#1a5c2a' }}
              >
                {rowLabel}
              </div>

              {/* Cells */}
              {grid[r].map((cell, c) => {
                const key = `${r},${c}`;
                const isHover = hoverKey === key;
                const isAnim = animKey === key;
                const variant = cellVariant(cell, isHover, isEnemy);
                const style: CSSProperties = {
                  ...CELL_STYLES[variant],
                  aspectRatio: '1',
                  borderRadius: '2px',
                  transition: 'background 0.15s, box-shadow 0.15s',
                  cursor: disabled
                    ? 'default'
                    : onCellClick && (isEnemy ? cell === 'empty' : true)
                      ? 'pointer'
                      : 'default',
                  animation: isAnim
                    ? cell === 'hit' || cell === 'sunk'
                      ? 'bs-hit 0.5s ease-out'
                      : 'bs-miss 0.5s ease-out'
                    : undefined,
                };

                // Overlay: hit cross
                const showCross = cell === 'hit';
                // Overlay: miss circle
                const showCircle = cell === 'miss';
                // Overlay: ship block segments for sunk/ship
                const showShip = cell === 'ship' || cell === 'sunk';

                return (
                  <div
                    key={key}
                    style={style}
                    onClick={() => !disabled && onCellClick?.(r, c)}
                    onMouseEnter={() => onCellHover?.(r, c)}
                  >
                    {showCross && (
                      <svg viewBox="0 0 10 10" className="h-full w-full">
                        <line
                          x1="2"
                          y1="2"
                          x2="8"
                          y2="8"
                          stroke="#dc2626"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <line
                          x1="8"
                          y1="2"
                          x2="2"
                          y2="8"
                          stroke="#dc2626"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                    {showCircle && (
                      <svg viewBox="0 0 10 10" className="h-full w-full">
                        <circle
                          cx="5"
                          cy="5"
                          r="2.5"
                          fill="none"
                          stroke="#1e6a9a"
                          strokeWidth="1"
                        />
                      </svg>
                    )}
                    {showShip && !showCross && (
                      <div
                        className="h-full w-full rounded-sm"
                        style={{
                          background:
                            cell === 'sunk'
                              ? 'linear-gradient(135deg, #1a0303, #0a0202)'
                              : 'linear-gradient(135deg, #133a1e, #0a2a14)',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ship status panel ───────────────────────────────────────────────────────

function ShipStatus({ ships }: { ships: GameState['playerShips'] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {SHIP_DEFS.map((def) => {
        const ship = ships.find((s) => s.id === def.id);
        return (
          <div key={def.id} className="flex items-center gap-1.5">
            <div
              className="w-[60px] truncate text-xs"
              style={{
                color: ship?.sunk ? '#4a1a1a' : '#1a6632',
              }}
            >
              {def.name.slice(0, 7).toUpperCase()}
            </div>
            <div className="flex gap-[2px]">
              {Array.from({ length: def.size }, (_, i) => {
                const hit = ship ? i < ship.hitCount : false;
                const sunk = ship?.sunk ?? false;
                return (
                  <div
                    key={i}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 2,
                      background: sunk ? '#2a0505' : hit ? '#7f1d1d' : '#0f3a1e',
                      border: `1px solid ${sunk ? '#450a0a' : hit ? '#dc2626' : '#1a6632'}`,
                      boxShadow: !sunk && !hit ? '0 0 3px #22c55e44' : undefined,
                    }}
                  />
                );
              })}
            </div>
            {ship?.sunk && (
              <span
                className="text-sm font-bold"
                style={{ color: '#7f1d1d', textShadow: '0 0 4px #dc2626' }}
              >
                ✕
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Battleship() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [animEnemyKey, setAnimEnemyKey] = useState<string | null>(null);
  const [animPlayerKey, setAnimPlayerKey] = useState<string | null>(null);
  const [blinkOn, setBlinkOn] = useState(true);

  // Blinking cursor
  useEffect(() => {
    const t = setInterval(() => setBlinkOn((v) => !v), 530);
    return () => clearInterval(t);
  }, []);

  // Clear anim markers
  useEffect(() => {
    if (!animEnemyKey) return;
    const t = setTimeout(() => setAnimEnemyKey(null), 600);
    return () => clearTimeout(t);
  }, [animEnemyKey]);

  useEffect(() => {
    if (!animPlayerKey) return;
    const t = setTimeout(() => setAnimPlayerKey(null), 600);
    return () => clearTimeout(t);
  }, [animPlayerKey]);

  // Revealed enemy grid on game over
  const displayEnemyGrid = useMemo<Cell[][]>(() => {
    if (game.phase !== 'won' && game.phase !== 'lost') return game.enemyGrid;
    const g = game.enemyGrid.map((r) => [...r]) as Cell[][];
    for (const ship of game.enemyShips) {
      if (!ship.sunk) {
        for (const [r, c] of ship.positions) {
          if (g[r][c] === 'empty') g[r][c] = 'ship';
        }
      }
    }
    return g;
  }, [game.phase, game.enemyGrid, game.enemyShips]);

  const handleShootClick = useCallback(
    (r: number, c: number) => {
      if (game.currentTurn !== 'player' || aiPending) return;
      if (game.enemyGrid[r][c] !== 'empty') return;

      const afterPlayer = playerShoot(game, r, c);
      setGame(afterPlayer);
      setAnimEnemyKey(`${r},${c}`);

      if (afterPlayer.phase === 'playing') {
        setAiPending(true);
        setTimeout(() => {
          setGame((prev) => {
            const afterAi = aiShoot(prev);
            if (afterAi.lastAiPos) {
              setAnimPlayerKey(`${afterAi.lastAiPos[0]},${afterAi.lastAiPos[1]}`);
            }
            return afterAi;
          });
          setAiPending(false);
        }, 900);
      }
    },
    [game, aiPending]
  );

  const accuracy = game.totalShots > 0 ? Math.round((game.hits / game.totalShots) * 100) : 0;

  const isOver = game.phase === 'won' || game.phase === 'lost';
  const isPlaying = game.phase === 'playing';
  const isStaging = game.phase === 'staging';

  const hoverKey = hoverPos ? `${hoverPos[0]},${hoverPos[1]}` : null;
  const enemySunkCount = game.enemyShips.filter((s) => s.sunk).length;
  const playerSunkCount = game.playerShips.filter((s) => s.sunk).length;

  return (
    <div
      className="flex min-h-screen flex-col items-center px-3 pb-12 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />

      {/* Back link */}
      <div className="mb-3 w-full max-w-2xl">
        <BackLink />
      </div>

      {/* Title */}
      <div className="mb-1 text-center">
        <h1
          className="font-display text-lg tracking-[0.3em] sm:text-2xl"
          style={{
            color: '#4ade80',
            textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66, 0 0 60px #22c55e33',
          }}
        >
          BATTLESHIP
        </h1>
        <div className="mt-1 text-xs tracking-[0.4em]" style={{ color: '#166534' }}>
          NAVAL COMBAT SYSTEM v4.2
        </div>
      </div>

      {/* Divider */}
      <GameDivider className="my-2 max-w-2xl" />

      {/* Status bar */}
      <div
        className="mb-3 w-full max-w-2xl rounded px-3 py-2"
        style={{
          background: '#040e07',
          border: '1px solid #0f3018',
          boxShadow: 'inset 0 0 20px #00000060',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: isOver
                ? game.phase === 'won'
                  ? '#22c55e'
                  : '#dc2626'
                : aiPending
                  ? '#f59e0b'
                  : '#22c55e',
              boxShadow: isOver
                ? game.phase === 'won'
                  ? '0 0 6px #22c55e'
                  : '0 0 6px #dc2626'
                : aiPending
                  ? '0 0 6px #f59e0b'
                  : '0 0 6px #22c55e',
            }}
          />
          <span
            className="font-mono text-xs tracking-wider"
            style={{
              color: isOver ? (game.phase === 'won' ? '#4ade80' : '#dc2626') : '#86efac',
              textShadow: isOver
                ? game.phase === 'won'
                  ? '0 0 6px #22c55e'
                  : '0 0 6px #dc2626'
                : undefined,
            }}
          >
            {game.message}
            {!isOver && <span style={{ opacity: blinkOn ? 1 : 0 }}>_</span>}
          </span>
          {aiPending && (
            <span className="ml-auto font-mono text-xs" style={{ color: '#f59e0b' }}>
              ENEMY CALCULATING...
            </span>
          )}
          {isPlaying && !aiPending && (
            <span className="ml-auto font-mono text-xs" style={{ color: '#166534' }}>
              SHOTS: {game.totalShots} | ACC: {accuracy}%
            </span>
          )}
        </div>
      </div>

      {/* ── Staging phase ── */}
      {isStaging && (
        <div className="flex w-full max-w-2xl flex-col items-center gap-4">
          <BattleGrid
            grid={game.playerGrid}
            isEnemy={false}
            label="YOUR FLEET — DEPLOY ZONE"
            disabled
          />

          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-xs" style={{ color: '#0f4a22' }}>
              KEEP SHUFFLING UNTIL YOU LIKE THE LAYOUT
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setGame((prev) => reshuffleFleet(prev))}
                className="rounded px-4 py-2 text-sm font-bold tracking-widest transition-all hover:scale-105"
                style={{
                  background: '#040e07',
                  border: '1px solid #22c55e',
                  color: '#4ade80',
                  boxShadow: '0 0 10px #22c55e44',
                }}
              >
                RESHUFFLE FLEET
              </button>
              <button
                onClick={() => setGame((prev) => startGame(prev))}
                className="rounded px-4 py-2 text-sm font-bold tracking-widest transition-all hover:scale-105"
                style={{
                  background: '#0a2a14',
                  border: '1px solid #1a6632',
                  color: '#86efac',
                  boxShadow: '0 0 6px #22c55e22',
                }}
              >
                OPEN FIRE →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Playing / Game over phase ── */}
      {(isPlaying || isOver) && (
        <div className="flex w-full max-w-2xl flex-col gap-4">
          {/* Grids row */}
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
            {/* Enemy grid */}
            <div className="flex flex-col items-center gap-2">
              <BattleGrid
                grid={displayEnemyGrid}
                isEnemy={true}
                label="▶ ENEMY WATERS — ATTACK"
                hoverKey={isPlaying && !aiPending ? hoverKey : null}
                animKey={animEnemyKey}
                onCellClick={isPlaying && !aiPending ? handleShootClick : undefined}
                onCellHover={isPlaying && !aiPending ? (r, c) => setHoverPos([r, c]) : undefined}
                onGridLeave={() => setHoverPos(null)}
                disabled={!isPlaying || aiPending}
              />
              {/* Enemy ship status */}
              <div
                className="w-full max-w-[290px] rounded p-2"
                style={{ background: '#040e07', border: '1px solid #0f2a18' }}
              >
                <div
                  className="mb-1.5 text-xs font-bold tracking-[0.2em]"
                  style={{ color: '#1a4a2a' }}
                >
                  ENEMY FLEET STATUS — {enemySunkCount}/{SHIP_DEFS.length} SUNK
                </div>
                <ShipStatus ships={game.enemyShips} />
              </div>
            </div>

            {/* Player grid */}
            <div className="flex flex-col items-center gap-2">
              <BattleGrid
                grid={game.playerGrid}
                isEnemy={false}
                label="FRIENDLY WATERS — DEFENSIVE"
                animKey={animPlayerKey}
                disabled
              />
              {/* Friendly ship status */}
              <div
                className="w-full max-w-[290px] rounded p-2"
                style={{ background: '#040e07', border: '1px solid #0f2a18' }}
              >
                <div
                  className="mb-1.5 text-xs font-bold tracking-[0.2em]"
                  style={{ color: '#1a4a2a' }}
                >
                  FRIENDLY FLEET — {playerSunkCount}/{SHIP_DEFS.length} LOST
                </div>
                <ShipStatus ships={game.playerShips} />
              </div>
            </div>
          </div>

          {/* Game over result */}
          {isOver && (
            <div
              className="w-full rounded-xl p-6 text-center"
              style={{
                background: game.phase === 'won' ? '#030f06' : '#0c0303',
                border: `1px solid ${game.phase === 'won' ? '#1a6632' : '#7f1d1d'}`,
                boxShadow:
                  game.phase === 'won'
                    ? '0 0 40px #22c55e22, inset 0 0 40px #00000060'
                    : '0 0 40px #dc262622, inset 0 0 40px #00000060',
                animation:
                  game.phase === 'won' ? 'bs-victory 0.8s ease-out' : 'bs-defeat 0.7s ease-out',
              }}
            >
              <div
                className="font-display text-3xl tracking-widest"
                style={{
                  color: game.phase === 'won' ? '#4ade80' : '#dc2626',
                  textShadow:
                    game.phase === 'won'
                      ? '0 0 20px #22c55e, 0 0 60px #22c55e66'
                      : '0 0 20px #dc2626, 0 0 60px #dc262666',
                }}
              >
                {game.phase === 'won' ? 'VICTORY' : 'DEFEAT'}
              </div>
              <div
                className="mt-1 text-xs tracking-[0.3em]"
                style={{ color: game.phase === 'won' ? '#166534' : '#7f1d1d' }}
              >
                {game.phase === 'won' ? 'ENEMY FLEET ELIMINATED' : 'FRIENDLY FLEET ANNIHILATED'}
              </div>

              <div className="mt-4 flex justify-center gap-6">
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#4ade80' }}>
                    {game.totalShots}
                  </div>
                  <div className="text-xs tracking-widest" style={{ color: '#166534' }}>
                    ROUNDS FIRED
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#4ade80' }}>
                    {accuracy}%
                  </div>
                  <div className="text-xs tracking-widest" style={{ color: '#166534' }}>
                    ACCURACY
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#4ade80' }}>
                    {game.hits}
                  </div>
                  <div className="text-xs tracking-widest" style={{ color: '#166534' }}>
                    DIRECT HITS
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setGame(createGame());
                  setHoverPos(null);
                  setAiPending(false);
                  setAnimEnemyKey(null);
                  setAnimPlayerKey(null);
                }}
                className="mt-6 rounded px-8 py-2.5 text-xs font-bold tracking-[0.2em] transition-all hover:scale-105"
                style={{
                  background: '#040e07',
                  border: '1px solid #22c55e',
                  color: '#4ade80',
                  boxShadow: '0 0 12px #22c55e44',
                }}
              >
                NEW ENGAGEMENT
              </button>
            </div>
          )}
        </div>
      )}

      {/* Keyframe styles */}
      <style>{`
        @keyframes bs-scan {
          0% { top: -2px; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: calc(100% + 2px); opacity: 0; }
        }
        @keyframes bs-hit {
          0% { transform: scale(1); filter: brightness(1); }
          20% { transform: scale(1.4); filter: brightness(3); }
          60% { transform: scale(0.9); filter: brightness(1.5); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes bs-miss {
          0% { transform: scale(1); }
          40% { transform: scale(0.85); }
          100% { transform: scale(1); }
        }
        @keyframes bs-victory {
          0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
          15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
          30%  { transform: scale(0.97) rotate(-1deg); filter: brightness(1.4); }
          45%  { transform: scale(1.04) rotate(0.8deg); filter: brightness(1.8); }
          60%  { transform: scale(0.99) rotate(-0.4deg); filter: brightness(1.2); }
          75%  { transform: scale(1.02) rotate(0.3deg); filter: brightness(1.1); }
          100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
        }
        @keyframes bs-defeat {
          0%   { transform: translate(0, 0) rotate(0deg); filter: brightness(1); }
          10%  { transform: translate(-8px, 2px) rotate(-2deg); filter: brightness(1.8) saturate(2); }
          20%  { transform: translate(8px, -2px) rotate(2deg); }
          30%  { transform: translate(-6px, 1px) rotate(-1.5deg); filter: brightness(1.4); }
          40%  { transform: translate(6px, -1px) rotate(1.5deg); }
          50%  { transform: translate(-4px, 1px) rotate(-1deg); filter: brightness(1.2); }
          60%  { transform: translate(4px, 0px) rotate(1deg); }
          70%  { transform: translate(-2px, 0px) rotate(-0.5deg); }
          80%  { transform: translate(2px, 0px) rotate(0.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); filter: brightness(1); }
        }
      `}</style>
    </div>
  );
}
