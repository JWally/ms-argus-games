import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CrtOverlay } from '../components/GameShell';
import {
  createGame,
  placeStone,
  passTurn,
  resignGame,
  isValidMove,
  estimateScore,
  rowOf,
  colOf,
} from '../games/go/engine';
import type { GoState } from '../games/go/engine';
import { pickMove, STAR_POINTS } from '../games/go/mcts';
import { getLeaderboard } from '../games/leaderboard';

const BORDER_GREEN_BRIGHT = '1px solid #22c55e';
const BORDER_DARKEST = '1px solid #0f2a18';
const SIZE = 9;
const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J']; // no I
const ROW_LABELS = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];

// ── Keyframe animations ───────────────────────────────────────────────

const KEYFRAMES = `
@keyframes go-place {
  0%   { transform: scale(0); opacity: 0.5; }
  60%  { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes go-victory {
  0%   { transform: scale(1) rotate(0deg); filter: brightness(1); }
  20%  { transform: scale(1.15) rotate(-3deg); filter: brightness(1.4); }
  40%  { transform: scale(0.95) rotate(3deg); filter: brightness(1); }
  60%  { transform: scale(1.08) rotate(-2deg); filter: brightness(1.3); }
  80%  { transform: scale(0.98) rotate(1deg); filter: brightness(1); }
  100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
}
@keyframes go-defeat {
  0%   { transform: translate(0,0) rotate(0deg); }
  15%  { transform: translate(-4px,0) rotate(-1.5deg); }
  30%  { transform: translate(4px,0) rotate(1.5deg); }
  45%  { transform: translate(-3px,0) rotate(-1deg); }
  60%  { transform: translate(3px,0) rotate(1deg); }
  75%  { transform: translate(-1px,0) rotate(-0.5deg); }
  100% { transform: translate(0,0) rotate(0deg); }
}
@keyframes go-scan {
  0%   { top: -10%; }
  100% { top: 110%; }
}
@keyframes go-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
`;

// ── Leaderboard config ────────────────────────────────────────────────

const LB_CONFIG = {
  gameId: 'go-9x9',
  baseScore: 28,
  lowerIsBetter: false,
  count: 10,
  spread: 0.55,
};

// ── Rules Modal ───────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
    >
      <div
        className="w-full max-w-sm"
        style={{
          background: '#040e07',
          border: BORDER_GREEN_BRIGHT,
          boxShadow: '0 0 40px #22c55e22',
          padding: '1.5rem',
        }}
      >
        <div className="mb-1 font-mono text-xs tracking-[0.4em]" style={{ color: '#166534' }}>
          CLASSIFIED BRIEFING
        </div>
        <h2
          className="mb-4 font-mono text-lg font-bold tracking-[0.2em]"
          style={{ color: '#4ade80', textShadow: '0 0 10px #22c55e88' }}
        >
          GO — FIELD MANUAL
        </h2>

        <ol className="mb-4 space-y-2.5">
          {[
            'Place your red stone on any intersection on your turn.',
            "Surround all of an enemy stone's adjacent empty points to capture it — captured stones leave the board.",
            'Empty intersections surrounded only by your stones score as your territory.',
            'PASS when satisfied. Two consecutive passes ends the game.',
            'KO: you cannot immediately re-capture a single stone.',
          ].map((rule, i) => (
            <li key={i} className="flex gap-2.5">
              <span
                className="mt-0.5 shrink-0 font-mono text-xs font-bold"
                style={{ color: '#22c55e' }}
              >
                {i + 1}.
              </span>
              <span className="text-[12px] leading-snug" style={{ color: '#86efac' }}>
                {rule}
              </span>
            </li>
          ))}
        </ol>

        <div
          className="mb-5 border-l-2 pl-3 font-mono text-xs leading-relaxed"
          style={{ borderColor: '#1a6632', color: '#4ade80' }}
        >
          SCORING: your stones on board + territory you surround.
          <br />
          AI receives 5.5 bonus points (komi) for going second.
          <br />
          Most points wins.
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 font-mono text-xs font-bold tracking-[0.2em] transition-all"
          style={{
            background: '#0a2a14',
            border: BORDER_GREEN_BRIGHT,
            color: '#4ade80',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#0f3a1e';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px #22c55e44';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#0a2a14';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          [ UNDERSTOOD. ENGAGE. ]
        </button>
      </div>
    </div>
  );
}

// ── Go Board ──────────────────────────────────────────────────────────

interface BoardProps {
  game: GoState;
  hoverIdx: number | null;
  onPlace: (i: number) => void;
  onHover: (i: number | null) => void;
  disabled: boolean;
}

function GoBoard({ game, hoverIdx, onPlace, onHover, disabled }: BoardProps) {
  const cellSize = 40; // px per intersection gap
  const boardPx = (SIZE - 1) * cellSize; // 320px
  const stonePx = Math.round(cellSize * 0.82);
  const pad = cellSize; // padding for labels

  const territory = game.phase === 'done' ? game.score?.territory : null;

  return (
    <div className="flex items-center justify-center">
      {/* Outer frame */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f3a1a, #071510, #0f3a1a)',
          border: '1px solid #1a6632',
          boxShadow: '0 0 30px #22c55e18, inset 0 0 30px #00000060',
          padding: `${pad}px`,
          position: 'relative',
        }}
      >
        {/* Scan line */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '20%',
            background:
              'linear-gradient(to bottom, transparent, rgba(34,197,94,0.04), transparent)',
            animation: 'go-scan 5s linear infinite',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Column labels (A-J, no I) */}
        <div
          style={{
            position: 'absolute',
            top: pad - 18,
            left: pad,
            width: boardPx,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          {COL_LABELS.map((l) => (
            <span
              key={l}
              style={{
                width: 0,
                textAlign: 'center',
                fontFamily: 'monospace',
                fontSize: 9,
                color: '#1a6632',
                letterSpacing: '0.05em',
              }}
            >
              {l}
            </span>
          ))}
        </div>

        {/* Row labels (9-1) */}
        <div
          style={{
            position: 'absolute',
            top: pad,
            left: pad - 22,
            height: boardPx,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {ROW_LABELS.map((l) => (
            <span
              key={l}
              style={{
                height: 0,
                lineHeight: 0,
                fontFamily: 'monospace',
                fontSize: 9,
                color: '#1a6632',
              }}
            >
              {l}
            </span>
          ))}
        </div>

        {/* Board area */}
        <div
          style={{
            position: 'relative',
            width: boardPx,
            height: boardPx,
          }}
          onMouseLeave={() => onHover(null)}
        >
          {/* Grid lines */}
          {Array.from({ length: SIZE }, (_, i) => (
            <div
              key={`h${i}`}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: i * cellSize,
                height: 1,
                background: '#1a4a28',
              }}
            />
          ))}
          {Array.from({ length: SIZE }, (_, i) => (
            <div
              key={`v${i}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: i * cellSize,
                width: 1,
                background: '#1a4a28',
              }}
            />
          ))}

          {/* Star points */}
          {[...STAR_POINTS].map((si) => (
            <div
              key={`star${si}`}
              style={{
                position: 'absolute',
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#2a6640',
                left: colOf(si) * cellSize - 2,
                top: rowOf(si) * cellSize - 2,
              }}
            />
          ))}

          {/* Intersections */}
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const r = rowOf(i);
            const c = colOf(i);
            const stone = game.board[i];
            const isLast = game.lastMove === i;
            const isKo = game.koPoint === i;
            const isHovering = hoverIdx === i && stone === 0;
            const canPlace = !disabled && stone === 0 && isValidMove(game, i);
            const terr = territory?.[i] ?? 0;

            return (
              <div
                key={i}
                onClick={() => canPlace && onPlace(i)}
                onMouseEnter={() => !disabled && onHover(i)}
                style={{
                  position: 'absolute',
                  left: c * cellSize - stonePx / 2,
                  top: r * cellSize - stonePx / 2,
                  width: stonePx,
                  height: stonePx,
                  cursor: canPlace ? 'pointer' : 'default',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Territory overlay (game end) */}
                {stone === 0 && terr !== 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 6,
                      borderRadius: '50%',
                      background: terr === 1 ? 'rgba(220,38,38,0.25)' : 'rgba(226,232,240,0.18)',
                      border:
                        terr === 1
                          ? '1px solid rgba(220,38,38,0.4)'
                          : '1px solid rgba(226,232,240,0.3)',
                    }}
                  />
                )}

                {/* Ko marker */}
                {isKo && stone === 0 && !isHovering && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 10,
                      borderRadius: '50%',
                      border: '1px solid #f59e0b',
                      opacity: 0.6,
                    }}
                  />
                )}

                {/* Ghost stone */}
                {isHovering && canPlace && !stone && (
                  <div
                    style={{
                      width: stonePx - 6,
                      height: stonePx - 6,
                      borderRadius: '50%',
                      background: 'rgba(220,38,38,0.35)',
                      border: '1px solid rgba(220,38,38,0.5)',
                    }}
                  />
                )}

                {/* Actual stone */}
                {stone !== 0 && (
                  <div
                    style={{
                      width: stonePx - 4,
                      height: stonePx - 4,
                      borderRadius: '50%',
                      animation: isLast ? 'go-place 0.2s ease-out' : undefined,
                      ...(stone === 1
                        ? {
                            background:
                              'radial-gradient(circle at 35% 35%, #f87171, #dc2626 60%, #991b1b)',
                            boxShadow:
                              '0 0 8px #dc2626, 0 0 20px #dc262650, inset 0 1px 2px rgba(255,255,255,0.2)',
                          }
                        : {
                            background:
                              'radial-gradient(circle at 35% 35%, #f1f5f9, #e2e8f0 60%, #94a3b8)',
                            boxShadow:
                              '0 0 6px #94a3b880, 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.5)',
                          }),
                    }}
                  >
                    {/* Last move dot */}
                    {isLast && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background:
                              stone === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(220,38,38,0.7)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Game Over Panel ───────────────────────────────────────────────────

function GameOverPanel({ game, onNewGame }: { game: GoState; onNewGame: () => void }) {
  const score = game.score;
  const resigned = game.resignedBy;
  const winner = score?.winner ?? (resigned === 1 ? 2 : 1);
  const playerWon = winner === 1;

  const playerScore = score?.playerTotal ?? 0;
  const lb = useMemo(() => getLeaderboard(LB_CONFIG, Math.round(playerScore)), [playerScore]);

  const resultLabel = resigned
    ? resigned === 1
      ? 'RESIGNED'
      : 'ENEMY RESIGNED'
    : playerWon
      ? 'VICTORY'
      : 'DEFEAT';

  const resultColor = playerWon ? '#4ade80' : '#dc2626';
  const resultShadow = playerWon ? '0 0 20px #22c55e88' : '0 0 20px #dc262688';

  return (
    <div
      style={{
        background: '#030c06',
        border: `1px solid ${playerWon ? '#22c55e' : '#dc2626'}`,
        boxShadow: `0 0 30px ${playerWon ? '#22c55e22' : '#dc262622'}`,
        padding: '1.25rem',
        marginTop: '1rem',
        maxWidth: 380,
        marginInline: 'auto',
      }}
    >
      {/* Result */}
      <div
        className="mb-3 text-center font-mono text-2xl font-bold tracking-[0.3em]"
        style={{
          color: resultColor,
          textShadow: resultShadow,
          animation: playerWon ? 'go-victory 0.8s ease-in-out' : 'go-defeat 0.7s ease-in-out',
        }}
      >
        {resultLabel}
      </div>

      {/* Score breakdown */}
      {score && (
        <div
          className="mb-3"
          style={{
            background: '#040e07',
            border: BORDER_DARKEST,
            padding: '0.75rem',
            fontFamily: 'monospace',
          }}
        >
          <div className="mb-2 text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
            FINAL SCORE
          </div>
          <div className="space-y-1">
            {[
              ['RED STONES', score.playerStones, null],
              ['RED TERRITORY', score.playerTerritory, null],
              ['RED TOTAL', score.playerTotal, 1],
              ['WHITE STONES', score.aiStones, null],
              ['WHITE TERRITORY', score.aiTerritory, null],
              ['KOMI', '+5.5', null],
              ['WHITE TOTAL', score.aiTotal, 2],
            ].map(([label, val, highlight]) => (
              <div
                key={String(label)}
                className="flex justify-between text-xs"
                style={{
                  color: highlight === 1 ? '#f87171' : highlight === 2 ? '#e2e8f0' : '#1a6632',
                  fontWeight: highlight ? 'bold' : 'normal',
                  borderTop: highlight ? BORDER_DARKEST : undefined,
                  paddingTop: highlight ? '0.25rem' : undefined,
                  marginTop: highlight ? '0.25rem' : undefined,
                }}
              >
                <span>{label}</span>
                <span>{typeof val === 'number' ? val.toFixed(highlight ? 1 : 0) : val}</span>
              </div>
            ))}
          </div>
          <div
            className="mt-2 pt-2 text-center text-xs tracking-widest"
            style={{ borderTop: BORDER_DARKEST, color: '#22c55e' }}
          >
            {playerWon
              ? `MARGIN: +${score.margin.toFixed(1)}`
              : `DEFICIT: −${score.margin.toFixed(1)}`}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div
        style={{
          background: '#040e07',
          border: BORDER_DARKEST,
          padding: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div
          className="mb-2 text-xs tracking-[0.3em]"
          style={{ color: '#166534', fontFamily: 'monospace' }}
        >
          {lb.isNewBest ? '▲ NEW PERSONAL BEST — ' : ''}LEADERBOARD
        </div>
        <div className="space-y-0.5">
          {lb.entries.map((entry, i) => (
            <div
              key={i}
              className="flex justify-between font-mono text-xs"
              style={{
                color: entry.isPlayer ? '#4ade80' : '#1a6632',
                fontWeight: entry.isPlayer ? 'bold' : 'normal',
                background: entry.isPlayer ? '#0a2a1444' : 'transparent',
                padding: '1px 4px',
              }}
            >
              <span>
                {String(i + 1).padStart(2, ' ')}. {entry.name}
              </span>
              <span>{entry.score}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onNewGame}
        className="w-full py-2 font-mono text-xs font-bold tracking-[0.2em] transition-all"
        style={{
          background: '#0a2a14',
          border: BORDER_GREEN_BRIGHT,
          color: '#4ade80',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = '#0f3a1e';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = '#0a2a14';
        }}
      >
        [ NEW ENGAGEMENT ]
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

export default function Go() {
  const [game, setGame] = useState<GoState>(createGame);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [showRules, setShowRules] = useState(true);
  const [blinkOn, setBlinkOn] = useState(true);

  // Blink cursor
  useEffect(() => {
    const t = setInterval(() => setBlinkOn((v) => !v), 530);
    return () => clearInterval(t);
  }, []);

  const handlePlace = useCallback(
    (i: number) => {
      if (aiThinking || game.phase !== 'playing' || game.turn !== 1) return;
      const next = placeStone(game, i);
      if (next === game) return; // invalid move
      setGame(next);

      if (next.phase === 'done') return;

      setAiThinking(true);
      setTimeout(() => {
        const aiMove = pickMove(next);
        const afterAi = aiMove === -1 ? passTurn(next) : placeStone(next, aiMove);
        setGame(afterAi);
        setAiThinking(false);
      }, 350);
    },
    [game, aiThinking]
  );

  const handlePass = useCallback(() => {
    if (aiThinking || game.phase !== 'playing' || game.turn !== 1) return;
    const next = passTurn(game);
    setGame(next);

    if (next.phase === 'done') return;

    setAiThinking(true);
    setTimeout(() => {
      const aiMove = pickMove(next);
      const afterAi = aiMove === -1 ? passTurn(next) : placeStone(next, aiMove);
      setGame(afterAi);
      setAiThinking(false);
    }, 350);
  }, [game, aiThinking]);

  const handleResign = useCallback(() => {
    if (game.phase !== 'playing') return;
    setGame(resignGame(game, 1));
    setAiThinking(false);
  }, [game]);

  const handleNewGame = useCallback(() => {
    setGame(createGame());
    setAiThinking(false);
    setShowRules(true);
  }, []);

  const estimate = useMemo(() => estimateScore(game), [game]);

  const isPlayerTurn = game.phase === 'playing' && game.turn === 1 && !aiThinking;
  const boardDisabled = !isPlayerTurn || game.phase !== 'playing';

  // Status bar message
  let statusMsg: string;
  let statusColor: string;
  if (game.phase === 'done') {
    const winner = game.score?.winner ?? (game.resignedBy === 1 ? 2 : 1);
    statusMsg = winner === 1 ? 'MISSION COMPLETE — VICTORY' : 'MISSION FAILED';
    statusColor = winner === 1 ? '#4ade80' : '#dc2626';
  } else if (aiThinking) {
    statusMsg = 'ORACLE CALCULATING...';
    statusColor = '#f59e0b';
  } else if (game.turn === 1) {
    statusMsg = `YOUR MOVE${blinkOn ? ' ▌' : '  '}`;
    statusColor = '#dc2626';
  } else {
    statusMsg = 'AWAITING AI';
    statusColor = '#94a3b8';
  }

  return (
    <>
      <style>{KEYFRAMES}</style>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      <CrtOverlay />

      <div
        className="flex min-h-[100dvh] flex-col"
        style={{ background: '#030c06', color: '#4ade80' }}
      >
        {/* Back link */}
        <div className="px-4 pt-4">
          <Link
            to="/"
            className="font-mono text-xs tracking-widest transition-colors hover:text-[#4ade80]"
            style={{ color: '#166534' }}
          >
            ← ARCADE
          </Link>
        </div>

        {/* Header */}
        <header className="px-4 pb-3 pt-3 text-center">
          <h1
            className="font-mono text-2xl font-bold tracking-[0.4em]"
            style={{
              color: '#4ade80',
              textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66',
            }}
          >
            GO
          </h1>
          <div className="mt-0.5 font-mono text-xs tracking-[0.4em]" style={{ color: '#166534' }}>
            9×9 TACTICAL BOARD
          </div>
          <div
            className="mx-auto mt-3 h-px w-48"
            style={{
              background:
                'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
              boxShadow: '0 0 6px #22c55e44',
            }}
          />
        </header>

        {/* Status bar */}
        <div className="mx-auto w-full max-w-lg px-4">
          <div
            className="flex items-center gap-2 px-3 py-1.5"
            style={{
              background: '#040e07',
              border: '1px solid #0f3018',
              fontFamily: 'monospace',
            }}
          >
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: statusColor,
                boxShadow: `0 0 4px ${statusColor}`,
              }}
            />
            <span className="text-xs tracking-[0.15em]" style={{ color: statusColor }}>
              {statusMsg}
            </span>
            {game.phase === 'playing' && (
              <span className="ml-auto text-xs" style={{ color: '#166534' }}>
                MOVE {game.moveCount}
              </span>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="mx-auto mt-1.5 w-full max-w-lg px-4">
          <div
            className="flex justify-between px-3 py-1"
            style={{
              background: '#040e07',
              border: BORDER_DARKEST,
              fontFamily: 'monospace',
            }}
          >
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#dc2626',
                  boxShadow: '0 0 5px #dc2626',
                }}
              />
              <span className="text-xs font-bold" style={{ color: '#f87171' }}>
                RED{' '}
                {game.phase === 'done' && game.score
                  ? game.score.playerTotal.toFixed(1)
                  : estimate.player}
              </span>
              <span className="text-xs" style={{ color: '#166534' }}>
                ({game.captured[0]} cap)
              </span>
            </div>
            <div className="text-xs" style={{ color: '#0f3018' }}>
              VS
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#166534' }}>
                ({game.captured[1]} cap)
              </span>
              <span className="text-xs font-bold" style={{ color: '#e2e8f0' }}>
                {game.phase === 'done' && game.score ? game.score.aiTotal.toFixed(1) : estimate.ai}{' '}
                WHITE
              </span>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#e2e8f0',
                  boxShadow: '0 0 4px #94a3b880',
                }}
              />
            </div>
          </div>
        </div>

        {/* Board */}
        <main className="flex-1 overflow-x-auto px-2 py-3">
          <GoBoard
            game={game}
            hoverIdx={hoverIdx}
            onPlace={handlePlace}
            onHover={setHoverIdx}
            disabled={boardDisabled}
          />

          {/* Controls */}
          {game.phase === 'playing' && (
            <div className="mt-3 flex justify-center gap-3">
              <button
                onClick={handlePass}
                disabled={!isPlayerTurn}
                className="font-mono text-xs font-bold tracking-[0.2em] px-4 py-2 transition-all disabled:opacity-40"
                style={{
                  background: '#040e07',
                  border: '1px solid #1a6632',
                  color: '#4ade80',
                }}
                onMouseEnter={(e) => {
                  if (!boardDisabled)
                    (e.currentTarget as HTMLElement).style.borderColor = '#22c55e';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1a6632';
                }}
              >
                [ PASS ]
              </button>
              <button
                onClick={handleResign}
                className="font-mono text-xs font-bold tracking-[0.2em] px-4 py-2 transition-all"
                style={{
                  background: '#040e07',
                  border: '1px solid #7f1d1d',
                  color: '#f87171',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#7f1d1d';
                }}
              >
                [ RESIGN ]
              </button>
            </div>
          )}

          {/* Game over */}
          {game.phase === 'done' && <GameOverPanel game={game} onNewGame={handleNewGame} />}
        </main>

        {/* Footer */}
        <footer
          className="px-4 py-3 text-center font-mono text-xs tracking-wider"
          style={{ borderTop: BORDER_DARKEST, color: '#0f3018' }}
        >
          POWERED BY{' '}
          <a
            href="https://bio-dev-jw.argus.pw"
            className="hover:underline"
            style={{ color: '#166534' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            ARGUS BIO
          </a>{' '}
          · AUTHORIZED ACCESS ONLY
        </footer>
      </div>
    </>
  );
}
