import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  { label: 'Small', size: 10, par: 18 },
  { label: 'Medium', size: 14, par: 25 },
  { label: 'Large', size: 18, par: 32 },
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

  // Cell pixel size — fill available width (max 400px), minus gaps.
  const cellSize = `calc((min(100vw - 32px, 400px) - ${(boardSize - 1) * 2}px) / ${boardSize})`;

  return (
    <div className="flex min-h-screen flex-col items-center bg-arcade-bg px-4 pb-12 pt-4">
      {/* Nav */}
      <div className="mb-4 w-full max-w-[400px]">
        <Link to="/" className="text-sm text-arcade-accent hover:underline">
          &larr; Back to Arcade
        </Link>
      </div>

      {/* Title */}
      <h1 className="font-display text-xl text-arcade-accent sm:text-2xl">COLOR FLOOD</h1>

      {/* Size selector */}
      <div className="mt-4 flex gap-2">
        {SIZE_OPTIONS.map((opt) => (
          <button
            key={opt.size}
            onClick={() => restart(opt.size)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              boardSize === opt.size
                ? 'bg-arcade-accent text-white'
                : 'bg-arcade-card text-gray-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-4 flex w-full max-w-[400px] items-center justify-between text-sm text-gray-300">
        <span>
          Moves:{' '}
          <span className={`font-bold ${game.moves > game.par ? 'text-red-400' : 'text-white'}`}>
            {game.moves}
          </span>{' '}
          / {game.par}
        </span>
        <span>{pct}% captured</span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-2 w-full max-w-[400px] overflow-hidden rounded-full bg-arcade-card">
        <div
          className="h-full rounded-full bg-arcade-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Board */}
      <div
        className="mt-4"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${boardSize}, ${cellSize})`,
          gap: '2px',
        }}
      >
        {game.board.map((row, r) =>
          row.map((colorIdx, c) => {
            const isOwned = game.owned.has(`${r},${c}`);
            return (
              <div
                key={`${r},${c}`}
                className="transition-colors duration-200"
                style={{
                  width: cellSize,
                  height: cellSize,
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
              className="h-12 w-12 rounded-lg border-2 transition-all active:scale-95 disabled:opacity-30 sm:h-14 sm:w-14"
              style={{
                backgroundColor: color.hex,
                borderColor: isActive ? '#fff' : 'transparent',
              }}
            />
          );
        })}
      </div>

      {/* Best score */}
      {bestScore !== null && !game.won && (
        <p className="mt-4 text-xs text-gray-500">
          Best: {bestScore} move{bestScore !== 1 ? 's' : ''} ({boardSize}x{boardSize})
        </p>
      )}

      {/* Win screen */}
      {game.won && (
        <div className="mt-6 w-full max-w-[400px] rounded-xl border border-arcade-accent/40 bg-arcade-card p-6 text-center">
          <p className="font-display text-sm text-arcade-accent">YOU WIN!</p>
          <p className="mt-3 text-lg text-white">
            {game.moves} move{game.moves !== 1 ? 's' : ''}{' '}
            {game.moves <= game.par ? (
              <span className="text-arcade-success">(under par!)</span>
            ) : (
              <span className="text-gray-400">(par: {game.par})</span>
            )}
          </p>
          {bestScore !== null && (
            <p className="mt-1 text-sm text-gray-400">
              Best: {bestScore} move{bestScore !== 1 ? 's' : ''}
            </p>
          )}
          <button
            onClick={() => restart()}
            className="mt-5 rounded-lg bg-arcade-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-arcade-accent-hover"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
