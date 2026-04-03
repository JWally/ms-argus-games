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
  empty: '#061510',
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
    <div
      className="flex min-h-screen flex-col items-center px-4 pb-12 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      {/* CRT Scanlines */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.15) 3px, rgba(0,10,0,0.15) 4px)',
          opacity: 0.5,
        }}
      />

      {/* Back link */}
      <div className="mb-4 w-full max-w-[400px]">
        <Link to="/" className="text-sm font-mono tracking-widest hover:underline transition-colors" style={{ color: '#22c55e' }}>
          &larr; Back to Arcade
        </Link>
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
          ATAXX
        </h1>
        <div className="text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          TERRITORIAL EXPANSION PROTOCOL
        </div>
      </div>

      {/* Divider */}
      <div
        className="my-2 h-px w-full max-w-[400px]"
        style={{
          background: 'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
          boxShadow: '0 0 6px #22c55e44',
        }}
      />

      {/* Score bar */}
      <div className="mt-2 flex w-full max-w-[400px] items-center justify-between font-mono text-sm">
        <span style={{ color: '#4ade80' }}>YOU: {game.blueCount}</span>
        <span style={{ color: '#86efac' }}>
          {game.gameOver
            ? game.winner === 'blue'
              ? 'MISSION COMPLETE'
              : game.winner === 'red'
                ? 'MISSION FAILED'
                : 'STALEMATE'
            : game.turn === 'blue'
              ? 'YOUR TURN'
              : 'CPU CALCULATING...'}
        </span>
        <span style={{ color: '#f87171' }}>CPU: {game.redCount}</span>
      </div>

      {/* Score bar visual */}
      <div
        className="mt-2 flex h-3 w-full max-w-[400px] overflow-hidden"
        style={{
          background: '#040e07',
          border: '1px solid #0f2a18',
          borderRadius: '2px',
        }}
      >
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
              bg = isClone ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.12)';
              border = '#22c55e';
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
              bg = '#061510';
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
      <div className="mt-4 font-mono text-xs tracking-widest" style={{ color: '#166534' }}>
        1 SQUARE = CLONE · 2 SQUARES = JUMP
      </div>

      {/* Record */}
      {(record.wins > 0 || record.losses > 0) && !game.gameOver && (
        <p className="mt-3 font-mono text-xs" style={{ color: '#166534' }}>
          RECORD: {record.wins}W - {record.losses}L
        </p>
      )}

      {/* Game over */}
      {game.gameOver && (
        <div
          className="mt-6 w-full max-w-[400px] p-6 text-center"
          style={
            game.winner === 'blue'
              ? {
                  background: '#030f06',
                  border: '1px solid #1a6632',
                  borderRadius: '4px',
                  boxShadow: '0 0 40px #22c55e22, inset 0 0 40px #00000060',
                  animation: 'bs-victory 0.8s ease-out',
                }
              : game.winner === 'red'
                ? {
                    background: '#0c0303',
                    border: '1px solid #7f1d1d',
                    borderRadius: '4px',
                    boxShadow: '0 0 40px #dc262622, inset 0 0 40px #00000060',
                    animation: 'bs-defeat 0.7s ease-out',
                  }
                : {
                    background: '#0d0a02',
                    border: '1px solid #78350f',
                    borderRadius: '4px',
                    boxShadow: '0 0 40px #f59e0b22, inset 0 0 40px #00000060',
                  }
          }
        >
          <p
            className="font-display text-2xl tracking-widest"
            style={
              game.winner === 'blue'
                ? { color: '#4ade80', textShadow: '0 0 20px #22c55e, 0 0 60px #22c55e66' }
                : game.winner === 'red'
                  ? { color: '#dc2626', textShadow: '0 0 20px #dc2626, 0 0 60px #dc262666' }
                  : { color: '#f59e0b', textShadow: '0 0 20px #f59e0b, 0 0 60px #f59e0b66' }
            }
          >
            {game.winner === 'blue' ? 'MISSION COMPLETE' : game.winner === 'red' ? 'MISSION FAILED' : 'STALEMATE'}
          </p>
          <p className="mt-3 font-mono text-lg" style={{ color: '#86efac' }}>
            {game.blueCount} - {game.redCount}
          </p>
          <p className="mt-1 font-mono text-xs" style={{ color: '#166534' }}>
            RECORD: {record.wins}W - {record.losses}L
          </p>
          <button
            onClick={restart}
            className="mt-5 px-6 py-2.5 text-sm font-bold tracking-widest transition-all hover:scale-105"
            style={{
              background: '#040e07',
              border: '1px solid #22c55e',
              color: '#4ade80',
              boxShadow: '0 0 10px #22c55e44',
              borderRadius: '2px',
            }}
          >
            NEW ENGAGEMENT
          </button>
        </div>
      )}

      <style>{`
        @keyframes ataxx-land {
          0%   { transform: scale(0.6); }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes ataxx-flip {
          0%   { transform: rotateY(0deg); }
          50%  { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }
        @keyframes bs-victory {
          0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
          15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
          30%  { transform: scale(0.97) rotate(-1deg); filter: brightness(1.4); }
          100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
        }
        @keyframes bs-defeat {
          0%   { transform: translate(0,0) rotate(0deg); }
          10%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8) saturate(2); }
          30%  { transform: translate(-6px,1px) rotate(-1.5deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
