import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
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

const BALL   = 36;
const GAP    = 4;
const PADH   = 6;
const PADB   = 8;
const BORDER = 2;

const TUBE_INNER_W = BALL + PADH * 2;
const TUBE_OUTER_W = TUBE_INNER_W + BORDER * 2;
const TUBE_BODY_H  = TUBE_CAPACITY * (BALL + GAP) - GAP + PADB + BORDER;
const FLOAT_H      = BALL + 14;

function isComplete(tube: Tube): boolean {
  return tube.length === TUBE_CAPACITY && tube.every(c => c === tube[0]);
}

// ── Ball ─────────────────────────────────────────────────────────────

function Ball({ colorIndex, animate }: { colorIndex: number; animate?: boolean }) {
  const { hex } = BALL_COLORS[colorIndex];
  return (
    <div
      style={{
        width:           BALL,
        height:          BALL,
        borderRadius:    '50%',
        flexShrink:      0,
        backgroundColor: hex,
        boxShadow:       `inset -4px -4px 8px rgba(0,0,0,0.5), inset 3px 3px 7px rgba(255,255,255,0.22), 0 0 6px ${hex}55`,
        animation:       animate ? 'float-bob 1.5s ease-in-out infinite' : undefined,
      }}
    />
  );
}

// ── Tube column ───────────────────────────────────────────────────────

function TubeCol({
  tube, index, isSelected, isShaking, onClick,
}: {
  tube: Tube; index: number; isSelected: boolean; isShaking: boolean;
  onClick: (i: number) => void;
}) {
  const group     = topGroup(tube);
  const floating  = isSelected && group ? group : null;
  const complete  = isComplete(tube);
  const tubeColor = complete ? BALL_COLORS[tube[0]].hex : null;

  const innerBalls = floating
    ? (tube.slice(0, tube.length - floating.count) as Tube)
    : tube;

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
        width:     TUBE_OUTER_W,
        animation: isShaking ? 'tube-shake 0.4s ease' : undefined,
      }}
    >
      {/* Float zone — always reserved; ball appears when selected */}
      <div
        style={{ height: FLOAT_H, width: TUBE_OUTER_W }}
        className="flex flex-col items-center justify-end pb-1"
      >
        {floating && (
          <Ball
            key={`float-${index}-${floating.color}`}
            colorIndex={floating.color}
            animate
          />
        )}
      </div>

      {/* Tube body */}
      <div
        onClick={() => onClick(index)}
        className="cursor-pointer"
        style={{
          width:                  TUBE_OUTER_W,
          height:                 TUBE_BODY_H,
          borderWidth:            BORDER,
          borderTopWidth:         0,
          borderStyle:            'solid',
          borderColor,
          borderBottomLeftRadius:  9999,
          borderBottomRightRadius: 9999,
          boxShadow,
          background,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'flex-end',
          paddingBottom:  PADB,
          gap:            GAP,
          transition:     'border-color 0.25s, box-shadow 0.25s, background 0.25s',
        }}
      >
        {[...innerBalls].reverse().map((colorIdx, i) => (
          <Ball key={i} colorIndex={colorIdx} />
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

// ── Mini tube (used in modal) ─────────────────────────────────────────

const MINI = 13;
const MINI_GAP = 2;
const MINI_PAD = 3;

function MiniTube({
  colors = [],
  highlight = false,
  complete = false,
}: {
  colors?: number[];
  highlight?: boolean;
  complete?: boolean;
}) {
  const tubeColor = complete && colors.length > 0 ? BALL_COLORS[colors[0]].hex : null;
  return (
    <div
      style={{
        width:                  MINI + MINI_PAD * 2 + 2,
        height:                 TUBE_CAPACITY * (MINI + MINI_GAP) - MINI_GAP + MINI_PAD + 2,
        borderWidth:            1.5,
        borderTopWidth:         0,
        borderStyle:            'solid',
        borderColor:            complete ? (tubeColor ?? '#22c55e') + 'cc' : highlight ? '#22c55e' : '#1a4a2a',
        borderBottomLeftRadius:  9999,
        borderBottomRightRadius: 9999,
        boxShadow:              complete
          ? `0 0 10px ${tubeColor}55`
          : highlight
          ? '0 0 8px #22c55e44'
          : undefined,
        background:             'rgba(6,21,16,0.55)',
        display:                'flex',
        flexDirection:          'column',
        alignItems:             'center',
        justifyContent:         'flex-end',
        paddingBottom:          MINI_PAD,
        gap:                    MINI_GAP,
      }}
    >
      {[...colors].reverse().map((c, i) => (
        <div
          key={i}
          style={{
            width:           MINI,
            height:          MINI,
            borderRadius:    '50%',
            backgroundColor: BALL_COLORS[c].hex,
            boxShadow:       'inset -1px -1px 3px rgba(0,0,0,0.5)',
            flexShrink:      0,
          }}
        />
      ))}
    </div>
  );
}

// ── How To Play modal ─────────────────────────────────────────────────

function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-6 shadow-2xl"
        style={{
          background: '#040e07',
          border: '1px solid #1a6632',
          borderRadius: '2px',
          boxShadow: '0 0 40px #22c55e22, inset 0 0 40px #00000060',
          animation: 'modal-in 0.22s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          className="font-display text-center text-xs tracking-[0.3em]"
          style={{
            color: '#4ade80',
            textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66',
          }}
        >
          CONTAINMENT PROTOCOL
        </h2>
        <div
          className="mt-1 text-center text-sm tracking-[0.3em]"
          style={{ color: '#166534' }}
        >
          OPERATIONAL BRIEFING
        </div>

        <div
          className="my-3 h-px"
          style={{
            background: 'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
            boxShadow: '0 0 4px #22c55e44',
          }}
        />

        <div className="mt-4 space-y-5">
          <ModalStep n={1} text="Select a vessel to extract its top compound">
            <div className="flex items-end gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  style={{
                    width: MINI, height: MINI, borderRadius: '50%',
                    backgroundColor: BALL_COLORS[2].hex,
                    boxShadow: 'inset -1px -1px 3px rgba(0,0,0,0.4)',
                    animation: 'float-bob 1.5s ease-in-out infinite',
                  }}
                />
                <MiniTube colors={[1, 0, 2]} highlight />
              </div>
              <MiniTube colors={[0, 1]} />
            </div>
          </ModalStep>

          <ModalStep n={2} text="Transfer to a vessel with matching compound on top">
            <div className="flex items-end gap-1.5">
              <MiniTube colors={[1, 0]} />
              <span className="mb-4 text-base" style={{ color: '#166534' }}>→</span>
              <MiniTube colors={[0, 2, 2]} highlight />
            </div>
          </ModalStep>

          <ModalStep n={3} text="Isolate each compound to complete containment">
            <div className="flex items-end gap-1.5">
              <MiniTube colors={[0, 0, 0, 0]} complete />
              <MiniTube colors={[1, 1, 1, 1]} complete />
              <MiniTube colors={[2, 2, 2, 2]} complete />
              <MiniTube colors={[]} />
            </div>
          </ModalStep>
        </div>

        <p
          className="mt-5 text-center text-xs tracking-wider"
          style={{ color: '#0f4a22' }}
        >
          ROLLBACK AVAILABLE AT ANY CHECKPOINT
        </p>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 text-sm font-bold tracking-[0.2em] transition-all hover:scale-105"
          style={{
            background: '#040e07',
            border: '1px solid #22c55e',
            color: '#4ade80',
            boxShadow: '0 0 10px #22c55e44',
            borderRadius: '2px',
          }}
        >
          INITIATE PROTOCOL
        </button>
      </div>
    </div>
  );
}

function ModalStep({ n, text, children }: { n: number; text: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold"
        style={{
          background: '#0a2a14',
          border: '1px solid #1a6632',
          borderRadius: '2px',
          color: '#4ade80',
          fontFamily: 'monospace',
        }}
      >
        {n}
      </span>
      <div className="flex-1">
        <p className="text-xs leading-snug tracking-wider" style={{ color: '#86efac' }}>{text}</p>
        <div className="mt-2 flex items-end gap-2">{children}</div>
      </div>
    </div>
  );
}

// ── Fake leaderboard data ─────────────────────────────────────────────

const FAKE_BOARDS: Record<DifficultyKey, { name: string; score: number }[]> = {
  easy: [
    { name: 'APEX-7',    score: 14 },
    { name: 'FALCON-2',  score: 18 },
    { name: 'VENOM-4',   score: 21 },
    { name: 'DELTA-9',   score: 26 },
    { name: 'GHOST-1',   score: 31 },
    { name: 'RAZOR-6',   score: 38 },
    { name: 'BRAVO-5',   score: 47 },
  ],
  medium: [
    { name: 'APEX-7',    score: 24 },
    { name: 'SIGMA-3',   score: 29 },
    { name: 'COBRA-8',   score: 35 },
    { name: 'HAWK-2',    score: 43 },
    { name: 'NOVA-5',    score: 51 },
    { name: 'REAPER-1',  score: 60 },
    { name: 'TANGO-4',   score: 74 },
  ],
  hard: [
    { name: 'TITAN-1',   score: 40 },
    { name: 'VIPER-6',   score: 49 },
    { name: 'ECHO-3',    score: 58 },
    { name: 'STORM-9',   score: 67 },
    { name: 'ALPHA-7',   score: 79 },
    { name: 'NEXUS-2',   score: 93 },
    { name: 'PHANTOM-5', score: 108 },
  ],
};

function buildLeaderboard(difficulty: DifficultyKey, userScore: number) {
  const fakes = FAKE_BOARDS[difficulty];
  const rows: { name: string; score: number; isUser: boolean }[] = [
    ...fakes.map(f => ({ ...f, isUser: false })),
    { name: 'YOU', score: userScore, isUser: true },
  ];
  rows.sort((a, b) => a.score - b.score);
  return rows;
}

// ── Win modal ─────────────────────────────────────────────────────────

function WinModal({
  moves, bestScore, difficulty, isNewRecord, onClose,
}: {
  moves: number; bestScore: number | null; difficulty: DifficultyKey;
  isNewRecord: boolean; onClose: () => void;
}) {
  const board = buildLeaderboard(difficulty, moves);
  const userRank = board.findIndex(r => r.isUser) + 1;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
    >
      {/* Flash burst */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ animation: 'win-burst 0.6s ease-out forwards', background: 'radial-gradient(circle at 50% 40%, #22c55e33 0%, transparent 70%)' }}
      />

      <div
        className="relative w-full max-w-sm overflow-y-auto"
        style={{
          background: '#040e07',
          border: '1px solid #1a6632',
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
            background: 'linear-gradient(to right, transparent, #22c55e, #4ade80, #22c55e, transparent)',
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
              CONTAINED
            </div>
            <div className="mt-1 text-xs tracking-[0.4em]" style={{ color: '#1a6632' }}>
              ALL COMPOUNDS ISOLATED
            </div>
          </div>

          {/* New record badge */}
          {isNewRecord && (
            <div
              className="mt-4 mx-auto flex w-fit items-center gap-2 px-4 py-1.5"
              style={{
                background: '#0a2a14',
                border: '1px solid #22c55e',
                borderRadius: '2px',
                boxShadow: '0 0 16px #22c55e55',
                animation: 'record-pop 0.5s 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
              }}
            >
              <span style={{ color: '#fbbf24', textShadow: '0 0 8px #f59e0b' }}>★</span>
              <span className="text-xs font-bold tracking-[0.2em]" style={{ color: '#4ade80' }}>
                NEW PERSONAL RECORD
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
              <div className="text-xs tracking-widest" style={{ color: '#1a6632' }}>OPERATIONS</div>
            </div>
            {bestScore !== null && !isNewRecord && (
              <div className="text-center">
                <div className="font-mono text-4xl font-bold" style={{ color: '#166534' }}>
                  {bestScore}
                </div>
                <div className="text-xs tracking-widest" style={{ color: '#1a6632' }}>PERSONAL BEST</div>
              </div>
            )}
            <div className="text-center">
              <div
                className="font-mono text-4xl font-bold"
                style={{ color: userRank <= 3 ? '#fbbf24' : '#4ade80', textShadow: userRank <= 3 ? '0 0 12px #f59e0b' : undefined }}
              >
                #{userRank}
              </div>
              <div className="text-xs tracking-widest" style={{ color: '#1a6632' }}>RANK</div>
            </div>
          </div>

          {/* Divider */}
          <div
            className="my-4 h-px"
            style={{
              background: 'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
              boxShadow: '0 0 4px #22c55e44',
            }}
          />

          {/* Leaderboard */}
          <div className="text-xs tracking-[0.25em] mb-2 text-center" style={{ color: '#166534' }}>
            CONTAINMENT LEADERBOARD · {difficulty.toUpperCase()}
          </div>
          <div className="space-y-0.5">
            {board.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1"
                style={{
                  background: row.isUser ? '#0a2a14' : i % 2 === 0 ? '#030c06' : '#040e07',
                  border: row.isUser ? '1px solid #1a6632' : '1px solid transparent',
                  borderRadius: '2px',
                  boxShadow: row.isUser ? '0 0 8px #22c55e22' : undefined,
                }}
              >
                <span
                  className="w-5 text-center font-mono text-xs"
                  style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#166534' }}
                >
                  {i + 1}
                </span>
                <span
                  className="flex-1 font-mono text-xs tracking-wider"
                  style={{ color: row.isUser ? '#4ade80' : '#1a6632', fontWeight: row.isUser ? 'bold' : undefined }}
                >
                  {row.isUser ? '▶ YOU' : row.name}
                </span>
                <span
                  className="font-mono text-xs"
                  style={{ color: row.isUser ? '#4ade80' : '#166534' }}
                >
                  {row.score}
                </span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onClose}
            className="mt-5 w-full py-3 text-xs font-bold tracking-[0.25em] transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(to right, #0a2a14, #0f3a1c, #0a2a14)',
              border: '1px solid #22c55e',
              color: '#4ade80',
              boxShadow: '0 0 16px #22c55e44',
              borderRadius: '2px',
            }}
          >
            NEW ENGAGEMENT
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

const DIFF_LABELS: Record<DifficultyKey, string> = {
  easy:   'EASY',
  medium: 'MEDIUM',
  hard:   'HARD',
};

const TUTORIAL_KEY = 'ball-sort-tutorial-v2';

export default function BallSort() {
  const [difficulty, setDifficulty] = useState<DifficultyKey>('easy');
  const [game, setGame]             = useState<GameState>(() => createGame('easy'));
  const [bestScore, setBestScore]   = useState<number | null>(() => getBestScore('easy'));
  const [showModal, setShowModal]   = useState(() => !localStorage.getItem(TUTORIAL_KEY));
  const [showWinModal, setShowWinModal] = useState(false);
  const [isNewRecord, setIsNewRecord]   = useState(false);
  const [shakingTube, setShakingTube]   = useState<number | null>(null);
  const [opsFlash, setOpsFlash]         = useState(false);

  const gameRef    = useRef(game);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevMoves  = useRef(0);
  gameRef.current  = game;

  // Flash OPS counter on each increment
  useEffect(() => {
    if (game.moves > prevMoves.current && !game.won) {
      setOpsFlash(true);
      const t = setTimeout(() => setOpsFlash(false), 350);
      prevMoves.current = game.moves;
      return () => clearTimeout(t);
    }
    prevMoves.current = game.moves;
  }, [game.moves, game.won]);

  const closeModal = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    setShowModal(false);
  }, []);

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
    setGame(prev => undoMove(prev));
  }, []);

  const n   = game.tubes.length;
  const mid = Math.ceil(n / 2);

  function renderRow(indices: number[]) {
    return (
      <div className="flex gap-3">
        {indices.map(i => (
          <TubeCol
            key={i}
            tube={game.tubes[i]}
            index={i}
            isSelected={game.selected === i}
            isShaking={shakingTube === i}
            onClick={handleClick}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center px-4 pb-12 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      {/* Global CRT scanlines */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.15) 3px, rgba(0,10,0,0.15) 4px)',
          opacity: 0.5,
        }}
      />

      {showModal && <HowToPlay onClose={closeModal} />}

      {/* Nav */}
      <div className="mb-3 w-full max-w-md">
        <Link
          to="/"
          className="text-sm font-mono tracking-widest hover:underline transition-colors"
          style={{ color: '#22c55e' }}
        >
          &larr; Back to Arcade
        </Link>
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
          BALL SORT
        </h1>
        <div className="mt-1 flex items-center justify-center gap-2">
          <div
            className="text-xs tracking-[0.35em]"
            style={{ color: '#166534' }}
          >
            CHEMICAL CONTAINMENT SYSTEM v1.0
          </div>
          <button
            onClick={() => setShowModal(true)}
            aria-label="How to play"
            className="flex h-5 w-5 items-center justify-center text-xs font-bold transition-all hover:scale-105"
            style={{
              background: '#040e07',
              border: '1px solid #1a6632',
              color: '#166534',
              borderRadius: '2px',
            }}
          >
            ?
          </button>
        </div>
      </div>

      {/* Divider */}
      <div
        className="my-2 h-px w-full max-w-md"
        style={{
          background: 'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
          boxShadow: '0 0 6px #22c55e44',
        }}
      />

      {/* Status bar */}
      <div
        className="mb-3 w-full max-w-md px-3 py-2"
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
          <span className="font-mono text-xs tracking-wider" style={{ color: '#86efac' }}>
            {game.won ? 'CONTAINMENT ACHIEVED' : 'CONTAINMENT IN PROGRESS'}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-xs tracking-widest" style={{ color: '#1a6632' }}>OPS</span>
              <span
                className="font-mono text-lg font-bold leading-none"
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
                <span style={{ color: '#0f3018', fontFamily: 'monospace' }}>|</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xs tracking-widest" style={{ color: '#1a6632' }}>BEST</span>
                  <span className="font-mono text-lg font-bold leading-none" style={{ color: '#166534', textShadow: '0 0 6px #22c55e33' }}>
                    {bestScore}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Difficulty + controls row */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex gap-1.5">
          {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map(d => (
            <button
              key={d}
              onClick={() => restart(d)}
              className="px-3 py-1.5 text-xs font-bold tracking-[0.15em] transition-all hover:scale-105"
              style={{
                background: difficulty === d ? '#0a2a14' : '#040e07',
                border: `1px solid ${difficulty === d ? '#22c55e' : '#1a4a2a'}`,
                color: difficulty === d ? '#4ade80' : '#166534',
                boxShadow: difficulty === d ? '0 0 8px #22c55e33' : undefined,
                borderRadius: '2px',
              }}
            >
              {DIFF_LABELS[d]}
            </button>
          ))}
        </div>

        <div
          className="h-4 w-px"
          style={{ background: '#1a4a2a' }}
        />

        <div className="flex gap-1.5">
          <button
            onClick={handleUndo}
            disabled={game.history.length === 0 || game.won}
            className="px-3 py-1.5 text-xs font-bold tracking-[0.1em] transition-all hover:scale-105 disabled:opacity-25"
            style={{
              background: '#040e07',
              border: '1px solid #1a4a2a',
              color: '#166534',
              borderRadius: '2px',
            }}
          >
            ↩ ROLLBACK
          </button>
          <button
            onClick={() => restart()}
            className="px-3 py-1.5 text-xs font-bold tracking-[0.1em] transition-all hover:scale-105"
            style={{
              background: '#040e07',
              border: '1px solid #1a4a2a',
              color: '#166534',
              borderRadius: '2px',
            }}
          >
            ↺ REINIT
          </button>
        </div>
      </div>

      {/* Board */}
      <div
        className="relative overflow-hidden p-3"
        style={{
          background: '#040e07',
          border: '1px solid #0f2a18',
          borderRadius: '4px',
          boxShadow: '0 0 20px #22c55e11, inset 0 0 20px #00000066',
        }}
      >
        {/* Board scan line */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{
            height: '2px',
            background: 'linear-gradient(to right, transparent, #22c55e44 20%, #22c55e88 50%, #22c55e44 80%, transparent)',
            animation: 'bs-scan 4s linear infinite',
          }}
        />
        <div className="relative flex flex-col items-center gap-2">
          {renderRow(Array.from({ length: mid },     (_, i) => i))}
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
    </div>
  );
}
