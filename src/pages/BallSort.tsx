import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { GameCabinet } from '../components/GameCabinet';
import { Leaderboard } from '../components/GameShell';
import { getLeaderboard } from '../games/leaderboard';
import {
  BALL_COLORS,
  DIFFICULTIES,
  TUBE_CAPACITY,
  type DifficultyKey,
  type GameState,
  type Tube,
  createGame,
  selectTube,
  undoMove,
  topGroup,
  getBestScore,
  saveBestScore,
} from '../games/ball-sort/engine';
import { launchConfetti } from '../games/confetti';

// ── Layout constants ──────────────────────────────────────────────────

const BORDER_GREEN_DIM = '1px solid #1a6632';
const BORDER_GREEN_BRIGHT = '1px solid #22c55e';
const BORDER_STRIP = '1px solid #0f2a18';

const GAP = 4;
const PADH = 6;
const PADB = 8;
const BORDER = 2;
const ROW_GAP = 12; // gap-3 between tubes in a row

// Ball diameter scales with the actual board width (the bezel column, measured
// via ResizeObserver) so tube rows span the bezel, and stays height-bounded so
// two tube rows + chrome never scroll on short windows.
// Row height = FLOAT_H + TUBE_BODY_H + badge ≈ 5·ball + 56, so two rows
// plus the row gap ≈ 10·ball + 120.
function computeBall(rowW: number, vh: number, tubesInRow: number): number {
  const fromW = (rowW - (tubesInRow - 1) * ROW_GAP) / tubesInRow - PADH * 2 - BORDER * 2;
  const fromH = (vh * 0.68 - 120) / 10;
  return Math.max(26, Math.floor(Math.min(fromW, fromH)));
}

function isComplete(tube: Tube): boolean {
  return tube.length === TUBE_CAPACITY && tube.every((c) => c === tube[0]);
}

// ── Ball ─────────────────────────────────────────────────────────────

function Ball({
  colorIndex,
  size,
  animate,
}: {
  colorIndex: number;
  size: number;
  animate?: boolean;
}) {
  const { hex } = BALL_COLORS[colorIndex];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        backgroundColor: hex,
        boxShadow: `inset -4px -4px 8px rgba(0,0,0,0.5), inset 3px 3px 7px rgba(255,255,255,0.22), 0 0 6px ${hex}55`,
        animation: animate ? 'float-bob 1.5s ease-in-out infinite' : undefined,
      }}
    />
  );
}

// ── Tube column ───────────────────────────────────────────────────────

function TubeCol({
  tube,
  index,
  ball,
  isSelected,
  isShaking,
  onClick,
}: {
  tube: Tube;
  index: number;
  ball: number;
  isSelected: boolean;
  isShaking: boolean;
  onClick: (i: number) => void;
}) {
  const tubeOuterW = ball + PADH * 2 + BORDER * 2;
  const tubeBodyH = TUBE_CAPACITY * (ball + GAP) - GAP + PADB + BORDER;
  const floatH = ball + 14;

  const group = topGroup(tube);
  const floating = isSelected && group ? group : null;
  const complete = isComplete(tube);
  const tubeColor = complete ? BALL_COLORS[tube[0]].hex : null;

  const innerBalls = floating ? (tube.slice(0, tube.length - floating.count) as Tube) : tube;

  const borderColor = complete
    ? (tubeColor ?? '#22c55e') + 'bb'
    : isSelected
      ? '#22c55e'
      : '#0f3018';

  const boxShadow = complete
    ? `0 0 22px ${tubeColor}55, inset 0 0 12px ${tubeColor}18`
    : isSelected
      ? '0 0 16px #22c55e55, inset 0 0 8px #0d3a1a'
      : 'inset 0 0 6px #00000060';

  const background = complete
    ? `linear-gradient(to bottom, ${tubeColor}18, rgba(3,12,6,0.85))`
    : isSelected
      ? 'linear-gradient(to bottom, #0a1f14, #030c06cc)'
      : 'linear-gradient(to bottom, #061510, #030c06cc)';

  return (
    <div
      className="flex flex-col items-center"
      style={{
        width: tubeOuterW,
        animation: isShaking ? 'tube-shake 0.4s ease' : undefined,
      }}
    >
      {/* Float zone — always reserved; ball appears when selected */}
      <div
        style={{ height: floatH, width: tubeOuterW }}
        className="flex flex-col items-center justify-end pb-1"
      >
        {floating && (
          <Ball
            key={`float-${index}-${floating.color}`}
            colorIndex={floating.color}
            size={ball}
            animate
          />
        )}
      </div>

      {/* Tube body */}
      <div
        onClick={() => onClick(index)}
        className="cursor-pointer"
        style={{
          width: tubeOuterW,
          height: tubeBodyH,
          borderWidth: BORDER,
          borderTopWidth: 0,
          borderStyle: 'solid',
          borderColor,
          borderBottomLeftRadius: 9999,
          borderBottomRightRadius: 9999,
          boxShadow,
          background,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: PADB,
          gap: GAP,
          transition: 'border-color 0.25s, box-shadow 0.25s, background 0.25s',
        }}
      >
        {[...innerBalls].reverse().map((colorIdx, i) => (
          <Ball key={i} colorIndex={colorIdx} size={ball} />
        ))}
      </div>

      {/* Badge */}
      <div style={{ height: 18 }} className="flex items-center justify-center mt-0.5">
        {complete && (
          <span
            style={{
              color: tubeColor ?? '#22c55e',
              textShadow: `0 0 6px ${tubeColor ?? '#22c55e'}`,
              fontSize: '11px',
            }}
          >
            ✓
          </span>
        )}
        {floating && floating.count > 1 && !complete && (
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#1a6632' }}>
            ×{floating.count}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Leaderboard config per difficulty ────────────────────────────────

const LB_BASE: Record<DifficultyKey, number> = { easy: 25, medium: 42, hard: 65 };

// ── Win modal ─────────────────────────────────────────────────────────

function WinModal({
  moves,
  bestScore,
  difficulty,
  isNewRecord,
  onClose,
}: {
  moves: number;
  bestScore: number | null;
  difficulty: DifficultyKey;
  isNewRecord: boolean;
  onClose: () => void;
}) {
  const lb = getLeaderboard(
    {
      gameId: `ball-sort-${difficulty}`,
      baseScore: LB_BASE[difficulty],
      lowerIsBetter: true,
      count: 7,
    },
    moves
  );
  const userRank = lb.playerRank ?? lb.entries.length;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
    >
      {/* Flash burst */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          animation: 'win-burst 0.6s ease-out forwards',
          background: 'radial-gradient(circle at 50% 40%, #22c55e33 0%, transparent 70%)',
        }}
      />

      <div
        className="relative w-full max-w-sm overflow-y-auto"
        style={{
          background: '#040e07',
          border: BORDER_GREEN_DIM,
          borderRadius: '2px',
          boxShadow: '0 0 60px #22c55e33, 0 0 120px #22c55e11, inset 0 0 40px #00000060',
          animation: 'modal-in 0.3s ease',
          maxHeight: '90dvh',
        }}
      >
        {/* Header flash bar */}
        <div
          style={{
            height: '3px',
            background:
              'linear-gradient(to right, transparent, #22c55e, #4ade80, #22c55e, transparent)',
            animation: 'header-pulse 1.5s ease-in-out infinite',
          }}
        />

        <div className="p-6">
          {/* Title */}
          <div className="text-center">
            <div
              className="font-display text-3xl tracking-[0.15em]"
              style={{
                color: '#4ade80',
                textShadow: '0 0 20px #22c55e, 0 0 60px #22c55e88, 0 0 100px #22c55e44',
                animation: 'title-glow 2s ease-in-out infinite',
              }}
            >
              SOLVED
            </div>
            <div className="mt-1 text-xs tracking-[0.4em]" style={{ color: '#1a6632' }}>
              EVERY TUBE MATCHED
            </div>
          </div>

          {/* New record badge */}
          {isNewRecord && (
            <div
              className="mt-4 mx-auto flex w-fit items-center gap-2 px-4 py-1.5"
              style={{
                background: '#0a2a14',
                border: BORDER_GREEN_BRIGHT,
                borderRadius: '2px',
                boxShadow: '0 0 16px #22c55e55',
                animation: 'record-pop 0.5s 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
              }}
            >
              <span style={{ color: '#fbbf24', textShadow: '0 0 8px #f59e0b' }}>★</span>
              <span className="text-xs font-bold tracking-[0.2em]" style={{ color: '#4ade80' }}>
                NEW PERSONAL BEST
              </span>
              <span style={{ color: '#fbbf24', textShadow: '0 0 8px #f59e0b' }}>★</span>
            </div>
          )}

          {/* Score metrics */}
          <div className="mt-4 flex justify-center gap-8">
            <div className="text-center">
              <div
                className="font-mono text-4xl font-bold"
                style={{ color: '#4ade80', textShadow: '0 0 16px #22c55e' }}
              >
                {moves}
              </div>
              <div className="text-xs tracking-widest" style={{ color: '#1a6632' }}>
                MOVES
              </div>
            </div>
            {bestScore !== null && !isNewRecord && (
              <div className="text-center">
                <div className="font-mono text-4xl font-bold" style={{ color: '#3f9e68' }}>
                  {bestScore}
                </div>
                <div className="text-xs tracking-widest" style={{ color: '#1a6632' }}>
                  PERSONAL BEST
                </div>
              </div>
            )}
            <div className="text-center">
              <div
                className="font-mono text-4xl font-bold"
                style={{
                  color: userRank <= 3 ? '#fbbf24' : '#4ade80',
                  textShadow: userRank <= 3 ? '0 0 12px #f59e0b' : undefined,
                }}
              >
                #{userRank}
              </div>
              <div className="text-xs tracking-widest" style={{ color: '#1a6632' }}>
                RANK
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            className="my-4 h-px"
            style={{
              background:
                'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
              boxShadow: '0 0 4px #22c55e44',
            }}
          />

          <Leaderboard result={lb} title={`LEADERBOARD · ${difficulty.toUpperCase()}`} />

          {/* CTA */}
          <button
            onClick={onClose}
            className="mt-5 w-full py-3 text-xs font-bold tracking-[0.25em] transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(to right, #0a2a14, #0f3a1c, #0a2a14)',
              border: BORDER_GREEN_BRIGHT,
              color: '#4ade80',
              boxShadow: '0 0 16px #22c55e44',
              borderRadius: '2px',
            }}
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

const DIFF_LABELS: Record<DifficultyKey, string> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
};

export default function BallSort() {
  const [difficulty, setDifficulty] = useState<DifficultyKey>('easy');
  const [game, setGame] = useState<GameState>(() => createGame('easy'));
  const [bestScore, setBestScore] = useState<number | null>(() => getBestScore('easy'));
  const [showWinModal, setShowWinModal] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [shakingTube, setShakingTube] = useState<number | null>(null);
  const [opsFlash, setOpsFlash] = useState(false);
  const [viewportH, setViewportH] = useState(() => window.innerHeight);
  const [boardW, setBoardW] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const gameRef = useRef(game);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevMoves = useRef(0);
  useLayoutEffect(() => {
    gameRef.current = game;
  });

  // Track viewport height for the ball-size sanity bound
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Measure the board container (bezel column) for ball sizing
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    setBoardW(el.clientWidth);
    const ro = new window.ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setBoardW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Flash MOVES counter on each increment
  useEffect(() => {
    if (game.moves > prevMoves.current && !game.won) {
      prevMoves.current = game.moves;
      const tOn = setTimeout(() => setOpsFlash(true), 0);
      const tOff = setTimeout(() => setOpsFlash(false), 350);
      return () => {
        clearTimeout(tOn);
        clearTimeout(tOff);
      };
    }
    prevMoves.current = game.moves;
  }, [game.moves, game.won]);

  const restart = useCallback((diff?: DifficultyKey) => {
    const d = diff ?? gameRef.current.difficulty;
    setDifficulty(d);
    setGame(createGame(d));
    setBestScore(getBestScore(d));
    setShowWinModal(false);
    setIsNewRecord(false);
    prevMoves.current = 0;
  }, []);

  const handleClick = useCallback((idx: number) => {
    const prev = gameRef.current;
    const next = selectTube(prev, idx);

    if (next === prev) {
      const target = prev.selected ?? idx;
      setShakingTube(null);
      requestAnimationFrame(() => {
        setShakingTube(target);
        clearTimeout(shakeTimer.current);
        shakeTimer.current = setTimeout(() => setShakingTube(null), 450);
      });
      return;
    }

    if (next.won && !prev.won) {
      const prevBest = getBestScore(next.difficulty);
      const newRecord = prevBest === null || next.moves < prevBest;
      saveBestScore(next.difficulty, next.moves);
      const updated = getBestScore(next.difficulty);
      setBestScore(updated);
      setIsNewRecord(newRecord);
      launchConfetti(2500);
      setTimeout(() => setShowWinModal(true), 800);
    }

    setGame(next);
  }, []);

  const handleUndo = useCallback(() => {
    setGame((prev) => undoMove(prev));
  }, []);

  const n = game.tubes.length;
  const mid = Math.ceil(n / 2);
  const ball = computeBall(boardW, viewportH, mid);

  function renderRow(indices: number[]) {
    return (
      <div className="flex" style={{ gap: ROW_GAP }}>
        {indices.map((i) => (
          <TubeCol
            key={i}
            tube={game.tubes[i]}
            index={i}
            ball={ball}
            isSelected={game.selected === i}
            isShaking={shakingTube === i}
            onClick={handleClick}
          />
        ))}
      </div>
    );
  }

  const status = (
    <div>
      {/* Status bar */}
      <div
        className="w-full px-3 py-2"
        style={{
          background: '#040e07',
          border: '1px solid #0f3018',
          borderRadius: '2px',
          boxShadow: 'inset 0 0 20px #00000060',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              background: '#22c55e',
              boxShadow: game.won ? '0 0 8px #22c55e' : '0 0 4px #22c55e66',
            }}
          />
          <span
            className="font-mono text-xs tracking-wider lg:text-sm"
            style={{ color: '#86efac' }}
          >
            {game.won ? 'ALL SORTED!' : 'SORT THE TUBES'}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span
                className="font-mono text-xs tracking-widest lg:text-sm"
                style={{ color: '#1a6632' }}
              >
                MOVES
              </span>
              <span
                className="font-mono text-lg font-bold leading-none lg:text-xl"
                style={{
                  color: opsFlash ? '#ffffff' : '#4ade80',
                  textShadow: opsFlash ? '0 0 16px #4ade80, 0 0 32px #22c55e' : '0 0 8px #22c55e66',
                  transition: 'color 0.05s, text-shadow 0.05s',
                  animation: opsFlash ? 'ops-pop 0.35s ease' : undefined,
                }}
              >
                {game.moves}
              </span>
            </div>
            {bestScore !== null && (
              <>
                <span style={{ color: '#26714a', fontFamily: 'monospace' }}>|</span>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-mono text-xs tracking-widest lg:text-sm"
                    style={{ color: '#1a6632' }}
                  >
                    BEST
                  </span>
                  <span
                    className="font-mono text-lg font-bold leading-none lg:text-xl"
                    style={{ color: '#3f9e68', textShadow: '0 0 6px #22c55e33' }}
                  >
                    {bestScore}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Difficulty tabstrip + undo — spans the full container width */}
      <div
        className="mt-2 flex w-full items-stretch overflow-hidden rounded-[2px]"
        style={{ border: BORDER_STRIP, background: '#040e07' }}
      >
        {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((d, i) => {
          const active = difficulty === d;
          return (
            <button
              key={d}
              onClick={() => restart(d)}
              className="flex-1 px-2 py-1.5 font-mono text-xs font-bold tracking-widest transition-colors lg:text-sm"
              style={{
                background: active ? '#071a0e' : 'transparent',
                color: active ? '#4ade80' : '#3f9e68',
                borderLeft: i > 0 ? BORDER_STRIP : 'none',
                borderTop: `2px solid ${active ? '#22c55e' : 'transparent'}`,
                borderBottom: `2px solid ${active ? '#22c55e' : 'transparent'}`,
              }}
            >
              {DIFF_LABELS[d]}
            </button>
          );
        })}
        <button
          onClick={handleUndo}
          disabled={game.history.length === 0 || game.won}
          className="flex-none px-3 py-1.5 font-mono text-xs font-bold tracking-widest transition-colors disabled:opacity-25 lg:text-sm"
          style={{
            background: 'transparent',
            color: '#3f9e68',
            borderLeft: BORDER_STRIP,
            borderTop: '2px solid transparent',
            borderBottom: '2px solid transparent',
          }}
        >
          ↩ UNDO
        </button>
      </div>
    </div>
  );

  const rules = (
    <ul
      className="flex flex-col gap-3 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· TAP A TUBE TO LIFT ITS TOP BALLS</li>
      <li>· TAP ANOTHER TUBE TO POUR THEM IN</li>
      <li>· BALLS ONLY LAND ON A MATCHING COLOR OR AN EMPTY TUBE</li>
      <li>· FILL A TUBE WITH ONE COLOR TO LOCK IT IN</li>
      <li>· SORT EVERY TUBE IN AS FEW MOVES AS YOU CAN — UNDO IS FREE</li>
    </ul>
  );

  return (
    <GameCabinet
      title="BALL SORT"
      subtitle="SORT EVERY TUBE TO A SINGLE COLOR"
      tag="Puzzle"
      record={bestScore !== null ? `BEST ${bestScore} MOVES` : undefined}
      onRestart={() => restart()}
      status={status}
      rules={rules}
    >
      {/* Board */}
      <div ref={boardRef} className="relative w-full overflow-hidden">
        {/* Board scan line */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{
            height: '2px',
            background:
              'linear-gradient(to right, transparent, #22c55e44 20%, #22c55e88 50%, #22c55e44 80%, transparent)',
            animation: 'bs-scan 4s linear infinite',
          }}
        />
        <div className="relative flex flex-col items-center gap-2">
          {renderRow(Array.from({ length: mid }, (_, i) => i))}
          {renderRow(Array.from({ length: n - mid }, (_, i) => i + mid))}
        </div>
      </div>

      {showWinModal && (
        <WinModal
          moves={game.moves}
          bestScore={bestScore}
          difficulty={difficulty}
          isNewRecord={isNewRecord}
          onClose={() => restart()}
        />
      )}

      <style>{`
        @keyframes float-bob {
          0%, 100% { transform: translateY(0);    }
          50%       { transform: translateY(-9px); }
        }
        @keyframes tube-shake {
          0%,100% { transform: translateX(0);    }
          15%     { transform: translateX(-8px); }
          35%     { transform: translateX(8px);  }
          55%     { transform: translateX(-6px); }
          75%     { transform: translateX(6px);  }
          90%     { transform: translateX(-3px); }
        }
        @keyframes bs-scan {
          0%   { top: -2px; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: calc(100% + 2px); opacity: 0; }
        }
        @keyframes modal-in {
          0%   { opacity: 0; transform: scale(0.93) translateY(12px); }
          100% { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes ops-pop {
          0%   { transform: scale(1);    }
          40%  { transform: scale(1.35); }
          70%  { transform: scale(0.95); }
          100% { transform: scale(1);    }
        }
        @keyframes win-burst {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes header-pulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes title-glow {
          0%, 100% { text-shadow: 0 0 20px #22c55e, 0 0 60px #22c55e88; }
          50%       { text-shadow: 0 0 30px #22c55e, 0 0 90px #22c55eaa, 0 0 120px #22c55e44; }
        }
        @keyframes record-pop {
          0%   { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1);   }
        }
      `}</style>
    </GameCabinet>
  );
}
