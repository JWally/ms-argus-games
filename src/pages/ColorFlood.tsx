import { useState, useCallback, useMemo } from 'react';
import { GameCabinet } from '../components/GameCabinet';
import { Leaderboard } from '../components/GameShell';
import { getLeaderboard } from '../games/leaderboard';
import {
  COLORS,
  type ColorIndex,
  type GameState,
  createGame,
  playMove,
  capturePercent,
  getBestScore,
  saveBestScore,
} from '../games/color-flood/engine';

// ── Size presets ─────────────────────────────────────────────────────

const SIZE_OPTIONS = [
  { label: 'SMALL', size: 10, par: 18 },
  { label: 'MEDIUM', size: 14, par: 25 },
  { label: 'LARGE', size: 18, par: 32 },
] as const;

// ── Detect mobile (narrow viewport) for default size ─────────────────

function defaultSize(): number {
  if (typeof window !== 'undefined' && window.innerWidth < 640) return 10;
  return 14;
}

// ── Component ────────────────────────────────────────────────────────

export default function ColorFlood() {
  const [boardSize, setBoardSize] = useState(defaultSize);
  const [game, setGame] = useState<GameState>(() => createGame(boardSize));
  const [bestScore, setBestScore] = useState<number | null>(() => getBestScore(boardSize));

  // Restart with a new board of the given size.
  const restart = useCallback(
    (size?: number) => {
      const s = size ?? boardSize;
      setBoardSize(s);
      setGame(createGame(s));
      setBestScore(getBestScore(s));
    },
    [boardSize]
  );

  // Handle color pick.
  const pick = useCallback(
    (idx: ColorIndex) => {
      if (game.won) return;
      setGame((prev) => {
        const next = playMove(prev, idx);
        if (next.won) {
          saveBestScore(next.size, next.moves);
          setBestScore(getBestScore(next.size));
        }
        return next;
      });
    },
    [game.won]
  );

  const pct = useMemo(() => capturePercent(game), [game]);

  const lb = useMemo(
    () =>
      game.won
        ? getLeaderboard(
            {
              gameId: `color-flood-${boardSize}`,
              baseScore: Math.round(game.par * 1.5),
              lowerIsBetter: true,
            },
            game.moves
          )
        : null,
    // Only recompute when the game is won or the board changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.won, boardSize]
  );

  const status = (
    <div>
      {/* Size selector */}
      <div className="flex justify-center gap-2">
        {SIZE_OPTIONS.map((opt) => (
          <button
            key={opt.size}
            onClick={() => restart(opt.size)}
            className="px-4 py-1.5 text-xs font-bold tracking-widest transition-all hover:scale-105 lg:text-sm"
            style={
              boardSize === opt.size
                ? {
                    background: '#040e07',
                    border: '1px solid #22c55e',
                    color: '#4ade80',
                    boxShadow: '0 0 10px #22c55e44',
                    borderRadius: '2px',
                  }
                : {
                    background: '#040e07',
                    border: '1px solid #1a4a2a',
                    color: '#3f9e68',
                    borderRadius: '2px',
                  }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-4 flex w-full items-center justify-between font-mono text-sm lg:text-base">
        <span style={{ color: '#86efac' }}>
          MOVES:{' '}
          <span
            style={{ color: game.moves > game.par ? '#dc2626' : '#4ade80', fontWeight: 'bold' }}
          >
            {game.moves}
          </span>{' '}
          <span style={{ color: '#3f9e68' }}>/ {game.par}</span>
        </span>
        <span style={{ color: '#3f9e68' }}>{pct}% CAPTURED</span>
      </div>

      {/* Progress bar */}
      <div
        className="mt-2 h-2 w-full overflow-hidden lg:h-2.5"
        style={{
          background: '#040e07',
          border: '1px solid #0f2a18',
          borderRadius: '2px',
        }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, background: '#22c55e' }}
        />
      </div>
    </div>
  );

  const rules = (
    <ul
      className="flex flex-col gap-1.5 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· YOUR BLOB STARTS AT THE TOP-LEFT CELL</li>
      <li>· PICK A COLOR — YOUR WHOLE BLOB SWITCHES TO IT</li>
      <li>· TOUCHING CELLS OF THAT COLOR JOIN THE BLOB</li>
      <li>· FLOOD THE WHOLE BOARD IN ONE COLOR TO WIN</li>
      <li>· FINISH AT OR UNDER PAR FOR A PERFECT RUN</li>
    </ul>
  );

  return (
    <GameCabinet
      title="COLOR FLOOD"
      subtitle="PAINT THE WHOLE BOARD ONE COLOR"
      tag="Puzzle"
      record={
        bestScore !== null ? `BEST ${bestScore} MOVE${bestScore !== 1 ? 'S' : ''}` : undefined
      }
      onRestart={() => restart()}
      status={status}
      rules={rules}
      sidebar={game.won && lb ? <Leaderboard result={lb} /> : undefined}
    >
      {/* Board — fills the bezel; cells scale as equal fractions */}
      <div
        className="w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
          gap: '2px',
        }}
      >
        {game.board.map((row, r) =>
          row.map((colorIdx, c) => {
            const isOwned = game.owned.has(`${r},${c}`);
            return (
              <div
                key={`${r},${c}`}
                className="aspect-square w-full transition-colors duration-200"
                style={{
                  backgroundColor: COLORS[colorIdx].hex,
                  borderRadius: '2px',
                  boxShadow: isOwned ? 'inset 0 0 0 1.5px rgba(255,255,255,0.25)' : 'none',
                }}
              />
            );
          })
        )}
      </div>

      {/* Color picker */}
      <div className="mt-5 flex gap-3">
        {COLORS.map((color, idx) => {
          const isActive = idx === game.currentColor;
          return (
            <button
              key={color.name}
              disabled={isActive || game.won}
              onClick={() => pick(idx as ColorIndex)}
              aria-label={`Pick ${color.name}`}
              className="h-12 w-12 transition-all active:scale-95 disabled:opacity-30 sm:h-14 sm:w-14 lg:h-16 lg:w-16"
              style={{
                backgroundColor: color.hex,
                borderRadius: '4px',
                border: isActive ? '2px solid #22c55e' : '2px solid transparent',
              }}
            />
          );
        })}
      </div>

      {/* Win screen */}
      {game.won && (
        <div
          className="mt-6 w-full p-6 text-center"
          style={{
            background: '#030f06',
            border: '1px solid #1a6632',
            borderRadius: '4px',
            boxShadow: '0 0 40px #22c55e22, inset 0 0 40px #00000060',
            animation: 'bs-victory 0.8s ease-out',
          }}
        >
          <p
            className="font-display text-2xl tracking-widest lg:text-3xl"
            style={{ color: '#4ade80', textShadow: '0 0 20px #22c55e, 0 0 60px #22c55e66' }}
          >
            YOU WIN
          </p>
          <p
            className="mt-1 font-mono text-xs tracking-[0.3em] lg:text-sm"
            style={{ color: '#3f9e68' }}
          >
            THE WHOLE BOARD IS ONE COLOR
          </p>
          <p className="mt-3 font-mono text-lg lg:text-xl" style={{ color: '#86efac' }}>
            {game.moves} MOVE{game.moves !== 1 ? 'S' : ''}{' '}
            {game.moves <= game.par ? (
              <span style={{ color: '#4ade80' }}>(UNDER PAR)</span>
            ) : (
              <span style={{ color: '#3f9e68' }}>(PAR: {game.par})</span>
            )}
          </p>
          {bestScore !== null && (
            <p className="mt-1 font-mono text-xs lg:text-sm" style={{ color: '#3f9e68' }}>
              BEST: {bestScore} MOVE{bestScore !== 1 ? 'S' : ''}
            </p>
          )}
          <button
            onClick={() => restart()}
            className="mt-5 px-6 py-2.5 text-sm font-bold tracking-widest transition-all hover:scale-105"
            style={{
              background: '#040e07',
              border: '1px solid #22c55e',
              color: '#4ade80',
              boxShadow: '0 0 10px #22c55e44',
              borderRadius: '2px',
            }}
          >
            PLAY AGAIN
          </button>
        </div>
      )}

      <style>{`
        @keyframes bs-victory {
          0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
          15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
          30%  { transform: scale(0.97) rotate(-1deg); filter: brightness(1.4); }
          100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
        }
      `}</style>
    </GameCabinet>
  );
}
