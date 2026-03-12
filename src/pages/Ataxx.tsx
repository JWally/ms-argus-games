import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type GameState,
  createGame,
  handleCellClick,
  aiMove,
  getBestScore,
  saveResult,
} from '../games/ataxx/engine';

const CELL_COLORS = {
  empty: '#1e1e3a',
  blue: '#3b82f6',
  red: '#ef4444',
} as const;

export default function Ataxx() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [animating, setAnimating] = useState(false);
  // Read record fresh — it's cheap (localStorage) and avoids stale state
  const record = getBestScore();
  const aiTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const animTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const restart = useCallback(() => {
    if (aiTimeout.current) clearTimeout(aiTimeout.current);
    if (animTimeout.current) clearTimeout(animTimeout.current);
    gameId.current++;
    setAnimating(false);
    setGame(createGame());
  }, []);

  // AI takes its turn after a short delay
  useEffect(() => {
    if (game.turn === 'red' && !game.gameOver) {
      aiTimeout.current = setTimeout(() => {
        setAnimating(true);
        setGame((prev) => aiMove(prev));
        // Clear animation highlights after they play
        animTimeout.current = setTimeout(() => setAnimating(false), 800);
      }, 400);
      return () => {
        if (aiTimeout.current) clearTimeout(aiTimeout.current);
        if (animTimeout.current) clearTimeout(animTimeout.current);
      };
    }
  }, [game.turn, game.gameOver]);

  // Save result when game ends
  const savedGameId = useRef(0);
  const gameId = useRef(0);
  useEffect(() => {
    if (game.gameOver && game.winner && savedGameId.current !== gameId.current) {
      savedGameId.current = gameId.current;
      if (game.winner !== 'tie') {
        saveResult(game.winner === 'blue');
      }
    }
  }, [game.gameOver, game.winner]);

  const onCellClick = useCallback((r: number, c: number) => {
    setGame((prev) => handleCellClick(prev, r, c));
  }, []);

  const cellSize = `calc((min(100vw - 32px, 400px) - ${(game.size - 1) * 3}px) / ${game.size})`;

  return (
    <div className="flex min-h-screen flex-col items-center bg-arcade-bg px-4 pb-12 pt-4">
      {/* Nav */}
      <div className="mb-4 w-full max-w-[400px]">
        <Link to="/" className="text-sm text-arcade-accent hover:underline">
          &larr; Back to Arcade
        </Link>
      </div>

      {/* Title */}
      <h1 className="font-display text-xl text-arcade-accent sm:text-2xl">ATAXX</h1>

      {/* Score bar */}
      <div className="mt-4 flex w-full max-w-[400px] items-center justify-between text-sm">
        <span className="font-bold text-blue-400">You: {game.blueCount}</span>
        <span className="text-gray-400">
          {game.gameOver
            ? game.winner === 'blue'
              ? 'You win!'
              : game.winner === 'red'
                ? 'CPU wins'
                : 'Tie game'
            : game.turn === 'blue'
              ? 'Your turn'
              : 'CPU thinking...'}
        </span>
        <span className="font-bold text-red-400">CPU: {game.redCount}</span>
      </div>

      {/* Score bar visual */}
      <div className="mt-2 flex h-3 w-full max-w-[400px] overflow-hidden rounded-full bg-arcade-card">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{
            width: `${(game.blueCount / (game.blueCount + game.redCount || 1)) * 100}%`,
          }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-300"
          style={{
            width: `${(game.redCount / (game.blueCount + game.redCount || 1)) * 100}%`,
          }}
        />
      </div>

      {/* Board */}
      <div
        className="mt-5"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${game.size}, ${cellSize})`,
          gap: '3px',
        }}
      >
        {game.board.map((row, r) =>
          row.map((cell, c) => {
            const k = `${r},${c}`;
            const isSelected = game.selected?.r === r && game.selected?.c === c;
            const isValidMove = game.validMoves.has(k);
            const isClone =
              isValidMove &&
              game.selected &&
              Math.max(Math.abs(r - game.selected.r), Math.abs(c - game.selected.c)) === 1;
            const wasFlipped = animating && game.flipped.has(k);
            const isLanding = animating && game.lastMove?.to.r === r && game.lastMove?.to.c === c;
            // Show source indicator only for jumps (source is now empty)
            const isSource =
              animating &&
              game.lastMove?.from.r === r &&
              game.lastMove?.from.c === c &&
              cell === 'empty';

            let bg: string = CELL_COLORS[cell];
            let border = 'transparent';
            let cursor = 'default';
            let scale = 1;
            let boxShadow = 'none';
            let anim = '';

            if (isSelected) {
              border = '#fff';
              scale = 1.08;
            } else if (isValidMove) {
              bg = isClone ? 'rgba(139,92,246,0.35)' : 'rgba(139,92,246,0.18)';
              border = '#8b5cf6';
              cursor = 'pointer';
            } else if (cell === 'blue' && game.turn === 'blue' && !game.gameOver) {
              cursor = 'pointer';
            }

            if (isLanding) {
              // Pulsing ring on where AI placed its piece
              boxShadow = '0 0 0 3px rgba(239,68,68,0.8), 0 0 12px rgba(239,68,68,0.5)';
              scale = 1.12;
              anim = 'ataxx-land 0.4s ease-out';
            } else if (wasFlipped) {
              // Flash on cells that got converted
              boxShadow = '0 0 8px rgba(239,68,68,0.6)';
              anim = 'ataxx-flip 0.5s ease-out';
            } else if (isSource) {
              // Dim ring showing where piece came from (jump)
              border = 'rgba(239,68,68,0.4)';
              bg = '#1e1e3a';
            }

            return (
              <button
                key={k}
                onClick={() => onCellClick(r, c)}
                className="transition-all duration-200"
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: bg,
                  borderRadius: '4px',
                  border: `2px solid ${border}`,
                  cursor,
                  transform: `scale(${scale})`,
                  boxShadow,
                  animation: anim,
                }}
              />
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <span>1 square = clone</span>
        <span>2 squares = jump</span>
      </div>

      {/* Record */}
      {(record.wins > 0 || record.losses > 0) && !game.gameOver && (
        <p className="mt-3 text-xs text-gray-500">
          Record: {record.wins}W - {record.losses}L
        </p>
      )}

      {/* Game over */}
      {game.gameOver && (
        <div className="mt-6 w-full max-w-[400px] rounded-xl border border-arcade-accent/40 bg-arcade-card p-6 text-center">
          <p className="font-display text-sm text-arcade-accent">
            {game.winner === 'blue' ? 'YOU WIN!' : game.winner === 'red' ? 'YOU LOSE' : 'TIE GAME'}
          </p>
          <p className="mt-3 text-lg text-white">
            {game.blueCount} - {game.redCount}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Record: {record.wins}W - {record.losses}L
          </p>
          <button
            onClick={restart}
            className="mt-5 rounded-lg bg-arcade-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-arcade-accent-hover"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
