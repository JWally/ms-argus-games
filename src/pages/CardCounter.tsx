import React, { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { GameCabinet } from '../components/GameCabinet';
import {
  type GameState,
  type Card,
  type Suit,
  newGame,
  placeBet,
  hit,
  stand,
  doubleDown,
  nextHand,
  toggleShowCount,
  submitCountCheck,
  handValue,
  suitColor,
  hiLoValue,
  countAdvice,
  cardsRemaining,
  fullAdvice,
  calculateOdds,
} from '../games/card-counter/engine';

// ── Constants ──────────────────────────────────────────────────────────
const BET_AMOUNTS = [25, 50, 100, 250];
const CHIP_COLORS: Record<number, string> = {
  25: 'from-green-600 to-green-800 border-green-400',
  50: 'from-blue-600 to-blue-800 border-blue-400',
  100: 'from-red-600 to-red-800 border-red-400',
  250: 'from-purple-600 to-purple-800 border-purple-400',
};
const DEAL_MS = 320;
const BORDER_GREEN_DIM = '1px solid #1a6632';
const BORDER_GREEN_BRIGHT = '1px solid #22c55e';
const BORDER_RED_DIM = '1px solid #7f1d1d';
const BG_SURFACE = '#040e07';
const GLOW_GREEN = '0 0 10px #22c55e44';
const PHASE_COUNT_CHECK = 'count-check';
const DEALER_MS = 280;
const FLIP_MS = 450;
const RESULT_PAUSE = 800;

// ── Animation helpers ──────────────────────────────────────────────────
function useTimers() {
  const ids = useRef<number[]>([]);
  const add = useCallback((fn: () => void, ms: number) => {
    ids.current.push(window.setTimeout(fn, ms));
  }, []);
  const clear = useCallback(() => {
    for (const id of ids.current) clearTimeout(id);
    ids.current = [];
  }, []);
  useEffect(() => clear, [clear]);
  return { add, clear };
}

// ── CSS keyframes ──────────────────────────────────────────────────────
const STYLES = `
@keyframes cardFlyIn {
  0%   { transform: translateY(-100px) translateX(20px) rotate(6deg) scale(0.85); opacity:0; }
  40%  { opacity:1; }
  70%  { transform: translateY(4px) translateX(-2px) rotate(-1deg) scale(1.02); }
  100% { transform: none; opacity:1; }
}
@keyframes confettiPop {
  0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
  100% { transform: translate(var(--cx), var(--cy)) rotate(var(--cr)) scale(0.4); opacity:0; }
}
@keyframes greenFlash {
  0%   { opacity:0.45; }
  100% { opacity:0; }
}
@keyframes resultSlideIn {
  0%   { transform: translateY(30px) scale(0.9); opacity:0; }
  100% { transform: none; opacity:1; }
}
@keyframes softPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.04); }
}
@keyframes bs-victory {
  0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
  15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
  100% { transform: scale(1); filter: brightness(1); }
}
@keyframes bs-defeat {
  0%,100% { transform: translate(0,0); }
  20%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8); }
  50%  { transform: translate(6px,-1px) rotate(1deg); }
}
`;

// ── SVG suit icons ─────────────────────────────────────────────────────
function SuitIcon({ suit, size = 24 }: { suit: Suit | string; size?: number }) {
  const color = suitColor(suit as Suit);
  if (suit === 'hearts')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  if (suit === 'diamonds')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2L5 12l7 10 7-10z" />
      </svg>
    );
  if (suit === 'clubs')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2c-2.5 0-4.5 2-4.5 4.5 0 1.33.58 2.53 1.5 3.35C6.58 10.08 5 11.83 5 14c0 2.49 2.01 4.5 4.5 4.5.98 0 1.88-.31 2.5-.82V22h2v-4.32c.62.51 1.52.82 2.5.82 2.49 0 4.5-2.01 4.5-4.5 0-2.17-1.58-3.92-3.5-4.15.92-.82 1.5-2.02 1.5-3.35C19 4 17 2 14.5 2h-5z" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2S3 9 3 15c0 2.76 2.24 5 5 5 1.64 0 3.09-.8 4-2.03V22h2v-4.03C14.91 19.2 16.36 20 18 20c2.76 0 5-2.24 5-5C23 9 14 2 12 2z" />
    </svg>
  );
}

// ── Confetti ───────────────────────────────────────────────────────────
function makeConfettiPieces() {
  const colors = ['#fbbf24', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899'];
  return Array.from({ length: 50 }, (_, i) => {
    const angle = Math.random() * 360 * (Math.PI / 180);
    const dist = 80 + Math.random() * 260;
    return {
      id: i,
      color: colors[i % colors.length],
      cx: `${Math.cos(angle) * dist}px`,
      cy: `${Math.sin(angle) * dist - 200}px`,
      cr: `${Math.random() * 720 - 360}deg`,
      delay: `${Math.random() * 0.3}s`,
      size: 6 + Math.random() * 6,
    };
  });
}

function Confetti() {
  const pieces = useMemo(() => makeConfettiPieces(), []);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={
            {
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              '--cx': p.cx,
              '--cy': p.cy,
              '--cr': p.cr,
              animation: `confettiPop 1.2s ease-out ${p.delay} forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

// ── Win/Lose overlay ───────────────────────────────────────────────────
function ResultOverlay({
  result,
  bet,
  prevBankroll,
  newBankroll,
  onDismiss,
}: {
  result: 'win' | 'blackjack' | 'lose' | 'push';
  bet: number;
  prevBankroll: number;
  newBankroll: number;
  onDismiss: () => void;
}) {
  const isWin = result === 'win' || result === 'blackjack';
  const winnings = result === 'blackjack' ? Math.floor(bet * 1.5) : result === 'win' ? bet : 0;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      onClick={onDismiss}
    >
      {isWin && (
        <div
          className="pointer-events-none absolute inset-0 bg-green-500"
          style={{ animation: 'greenFlash 0.8s ease-out forwards' }}
        />
      )}
      <div
        className="relative z-10 mx-4 w-full max-w-[320px] p-6 text-center shadow-2xl"
        style={
          isWin
            ? {
                background: '#030f06',
                border: BORDER_GREEN_DIM,
                borderRadius: '4px',
                boxShadow: '0 0 40px #22c55e22',
                animation: 'bs-victory 0.8s ease-out',
              }
            : result === 'lose'
              ? {
                  background: '#0c0303',
                  border: BORDER_RED_DIM,
                  borderRadius: '4px',
                  boxShadow: '0 0 40px #dc262622',
                  animation: 'bs-defeat 0.7s ease-out',
                }
              : {
                  background: BG_SURFACE,
                  border: BORDER_GREEN_DIM,
                  borderRadius: '4px',
                  animation: 'resultSlideIn 0.35s ease-out',
                }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="font-display text-2xl"
          style={{
            color: isWin ? '#4ade80' : result === 'lose' ? '#f87171' : '#86efac',
            textShadow: isWin
              ? '0 0 10px #22c55e, 0 0 30px #22c55e66'
              : result === 'lose'
                ? '0 0 10px #dc2626'
                : undefined,
          }}
        >
          {result === 'blackjack'
            ? 'BLACKJACK!'
            : result === 'win'
              ? 'YOU WIN!'
              : result === 'lose'
                ? 'YOU LOSE'
                : 'PUSH'}
        </h2>

        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between" style={{ color: '#3f9e68' }}>
            <span>Previous balance</span>
            <span>${prevBankroll.toLocaleString()}</span>
          </div>
          {isWin ? (
            <div className="flex justify-between font-bold" style={{ color: '#f59e0b' }}>
              <span>Winnings</span>
              <span>+${winnings.toLocaleString()}</span>
            </div>
          ) : result === 'lose' ? (
            <div className="flex justify-between font-bold" style={{ color: '#f87171' }}>
              <span>Lost</span>
              <span>-${bet.toLocaleString()}</span>
            </div>
          ) : (
            <div className="flex justify-between" style={{ color: '#86efac' }}>
              <span>Bet returned</span>
              <span>${bet.toLocaleString()}</span>
            </div>
          )}
          <div style={{ borderTop: BORDER_GREEN_DIM, paddingTop: '4px' }} />
          <div className="flex justify-between text-base font-bold" style={{ color: '#4ade80' }}>
            <span>New balance</span>
            <span>${newBankroll.toLocaleString()}</span>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="mt-5 w-full py-3 text-sm font-bold transition-all hover:scale-105 active:scale-95"
          style={
            isWin
              ? {
                  background: BG_SURFACE,
                  border: BORDER_GREEN_BRIGHT,
                  color: '#4ade80',
                  boxShadow: GLOW_GREEN,
                  borderRadius: '2px',
                }
              : {
                  background: BG_SURFACE,
                  border: BORDER_GREEN_DIM,
                  color: '#86efac',
                  borderRadius: '2px',
                }
          }
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Card component (3D flip) ───────────────────────────────────────────
function CardView({
  card,
  visualFaceDown,
  flyIn,
  flyDelay,
}: {
  card: Card;
  visualFaceDown?: boolean;
  flyIn?: boolean;
  flyDelay?: number;
}) {
  const color = suitColor(card.suit);
  const hilo = hiLoValue(card.rank);

  return (
    <div
      className="shrink-0"
      style={{
        perspective: '800px',
        animation: flyIn
          ? `cardFlyIn 0.5s cubic-bezier(0.23, 1, 0.32, 1) ${flyDelay ?? 0}ms both`
          : undefined,
      }}
    >
      <div
        className="relative h-[110px] w-[76px] sm:h-[150px] sm:w-[105px] lg:h-[168px] lg:w-[118px]"
        style={{
          transformStyle: 'preserve-3d',
          transition: `transform ${FLIP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          transform: visualFaceDown ? 'rotateY(0deg)' : 'rotateY(180deg)',
        }}
      >
        {/* ── Back face ── */}
        <div
          className="absolute inset-0 rounded-xl border-2 border-blue-400/30 bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-800 shadow-xl"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex h-full items-center justify-center rounded-lg border border-blue-400/10 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(99,102,241,0.12)_5px,rgba(99,102,241,0.12)_10px)]">
            <SuitIcon suit="spades" size={28} />
          </div>
        </div>

        {/* ── Front face ── */}
        <div
          className="absolute inset-0 flex flex-col rounded-xl border border-gray-300 bg-white shadow-xl"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* Top-left */}
          <div className="flex flex-col items-center pl-1.5 pt-1">
            <span
              className="text-base font-bold leading-tight sm:text-lg lg:text-xl"
              style={{ color }}
            >
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} size={12} />
          </div>
          {/* Center */}
          <div className="flex flex-1 items-center justify-center">
            <SuitIcon suit={card.suit} size={36} />
          </div>
          {/* Bottom-right */}
          <div className="flex rotate-180 flex-col items-center pl-1.5 pt-1">
            <span
              className="text-base font-bold leading-tight sm:text-lg lg:text-xl"
              style={{ color }}
            >
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} size={12} />
          </div>
          {/* Hi-Lo badge */}
          <span
            className={`absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold shadow-md ${
              hilo === 1
                ? 'bg-green-500 text-white'
                : hilo === -1
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-400 text-white'
            }`}
          >
            {hilo === 1 ? '+1' : hilo === -1 ? '-1' : '0'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Hand display ───────────────────────────────────────────────────────
function HandDisplay({
  cards,
  label,
  value,
  active,
  visibleCount,
  holeDown,
  flyIn,
  hitFlipIdx,
}: {
  cards: Card[];
  label: string;
  value: number;
  active?: boolean;
  visibleCount: number;
  holeDown?: boolean;
  flyIn?: boolean;
  hitFlipIdx?: number;
}) {
  const shown = cards.slice(0, visibleCount);

  return (
    <div className="text-center">
      <div className="mb-2 flex items-center justify-center gap-2">
        <span
          className="text-sm font-semibold uppercase tracking-wider sm:text-base lg:text-lg"
          style={{ color: '#86efac' }}
        >
          {label}
        </span>
        {value > 0 && (
          <span
            className="rounded-full px-2.5 py-0.5 text-sm font-bold sm:text-base lg:text-lg"
            style={
              value > 21
                ? { background: '#7f1d1d', color: '#fca5a5' }
                : value === 21
                  ? { background: '#f59e0b', color: '#1a0a00' }
                  : active
                    ? { background: '#0a2a14', color: '#4ade80', border: BORDER_GREEN_BRIGHT }
                    : { background: 'rgba(0,0,0,0.4)', color: '#86efac' }
            }
          >
            {value}
          </span>
        )}
      </div>
      <div className="flex justify-center gap-2 sm:gap-3">
        {shown.map((card, i) => {
          const isFaceDown =
            (holeDown && i === 1) || (hitFlipIdx !== undefined && i === hitFlipIdx);

          return (
            <CardView
              key={`${i}-${card.rank}-${card.suit}`}
              card={card}
              visualFaceDown={isFaceDown}
              flyIn={flyIn}
              flyDelay={flyIn ? i * DEAL_MS : 0}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────
export default function CardCounter() {
  const { add, clear } = useTimers();

  // Game state
  const [game, setGame] = useState<GameState>(newGame);
  const [countInput, setCountInput] = useState('');
  const [showAdvice, setShowAdvice] = useState(false);

  // Animation state
  const [visPlayer, setVisPlayer] = useState(0);
  const [visDealer, setVisDealer] = useState(0);
  const [holeDown, setHoleDown] = useState(true);
  const [hitFlipIdx, setHitFlipIdx] = useState<number | undefined>();
  const [animLock, setAnimLock] = useState(false);
  const [flyInPlayer, setFlyInPlayer] = useState(false);
  const [flyInDealer, setFlyInDealer] = useState(false);

  // Result state
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [prevBank, setPrevBank] = useState(1000);
  const [resultBet, setResultBet] = useState(0);

  // Derived
  const playerValue = handValue(
    game.playerHand.slice(0, visPlayer).map((c) => ({ ...c, faceUp: true }))
  );
  const dealerDisplayCards = game.dealerHand
    .slice(0, visDealer)
    .map((c, i) => (i === 1 && holeDown ? { ...c, faceUp: false } : c));
  const dealerValue = handValue(dealerDisplayCards);
  const remaining = cardsRemaining(game);
  const advice = fullAdvice(game);

  // ── Actions ──────────────────────────────────────────────────────────

  const handleBet = (amount: number) => {
    clear();
    setPrevBank(game.bankroll);
    const next = placeBet(game, amount);
    setGame(next);
    setResultBet(amount);
    setShowResultOverlay(false);
    setShowConfetti(false);
    setShowAdvice(false);
    setHoleDown(true);
    setAnimLock(true);
    setFlyInPlayer(true);
    setFlyInDealer(true);
    setHitFlipIdx(undefined);

    setVisPlayer(0);
    setVisDealer(0);
    add(() => setVisPlayer(1), DEAL_MS);
    add(() => setVisDealer(1), DEAL_MS * 2);
    add(() => setVisPlayer(2), DEAL_MS * 3);
    add(() => setVisDealer(2), DEAL_MS * 4);
    add(() => {
      setAnimLock(false);
      setFlyInPlayer(false);
      setFlyInDealer(false);
      if (next.phase === 'result' || next.phase === PHASE_COUNT_CHECK) {
        setHoleDown(false);
        if (next.result === 'win' || next.result === 'blackjack') {
          add(() => {
            setShowConfetti(true);
            setShowResultOverlay(true);
          }, FLIP_MS + RESULT_PAUSE);
        } else {
          add(() => setShowResultOverlay(true), FLIP_MS + RESULT_PAUSE);
        }
      }
    }, DEAL_MS * 5);
  };

  const handleHit = () => {
    clear();
    const next = hit(game);
    setGame(next);
    const newIdx = next.playerHand.length - 1;
    setVisPlayer(next.playerHand.length);
    setHitFlipIdx(newIdx);
    setAnimLock(true);

    add(() => {
      setHitFlipIdx(undefined);
    }, 450);

    add(() => {
      setAnimLock(false);
      if (next.phase === 'result' || next.phase === PHASE_COUNT_CHECK) {
        add(() => {
          if (next.result === 'lose') {
            setShowResultOverlay(true);
          }
        }, RESULT_PAUSE);
      }
    }, 900);
  };

  const handleStand = () => {
    clear();
    const resolved = stand(game);
    setGame(resolved);
    setResultBet(resolved.bet);
    setAnimLock(true);
    setFlyInDealer(true);

    add(() => setHoleDown(false), 300);

    const totalDealerCards = resolved.dealerHand.length;
    const extraCards = totalDealerCards - 2;
    const revealStart = 300 + FLIP_MS + 100;

    for (let i = 0; i < extraCards; i++) {
      add(() => setVisDealer(3 + i), revealStart + i * DEALER_MS);
    }

    const lastCardDelay = revealStart + Math.max(0, extraCards) * DEALER_MS + 300;
    add(() => {
      setVisDealer(totalDealerCards);
      setFlyInDealer(false);
    }, lastCardDelay);

    add(() => {
      setAnimLock(false);
      if (resolved.result === 'win' || resolved.result === 'blackjack') {
        setShowConfetti(true);
      }
      setShowResultOverlay(true);
    }, lastCardDelay + RESULT_PAUSE);
  };

  const handleDouble = () => {
    clear();
    const resolved = doubleDown(game);
    setGame(resolved);
    setResultBet(resolved.bet);
    const newIdx = resolved.playerHand.length - 1;
    setVisPlayer(resolved.playerHand.length);
    setHitFlipIdx(newIdx);
    setAnimLock(true);

    add(() => setHitFlipIdx(undefined), 450);

    add(() => {
      setHoleDown(false);
      setFlyInDealer(true);
    }, 900);

    const totalDealerCards = resolved.dealerHand.length;
    const extraCards = totalDealerCards - 2;
    const revealStart = 900 + FLIP_MS + 100;

    for (let i = 0; i < extraCards; i++) {
      add(() => setVisDealer(3 + i), revealStart + i * DEALER_MS);
    }

    const lastCardDelay = revealStart + Math.max(0, extraCards) * DEALER_MS + 300;
    add(() => {
      setVisDealer(totalDealerCards);
      setFlyInDealer(false);
    }, lastCardDelay);

    add(() => {
      setAnimLock(false);
      if (resolved.result === 'win' || resolved.result === 'blackjack') {
        setShowConfetti(true);
      }
      setShowResultOverlay(true);
    }, lastCardDelay + RESULT_PAUSE);
  };

  const handleNext = () => {
    clear();
    setShowResultOverlay(false);
    setShowConfetti(false);
    setShowAdvice(false);
    setHitFlipIdx(undefined);
    const next = nextHand(game);
    setGame(next);
    setVisPlayer(0);
    setVisDealer(0);
    setHoleDown(true);
  };

  const handleToggleCount = () => setGame((g) => toggleShowCount(g));

  const handleCountSubmit = () => {
    const n = parseInt(countInput, 10);
    if (isNaN(n)) return;
    setGame((g) => submitCountCheck(g, n));
    setCountInput('');
  };

  const handleNewGame = () => {
    clear();
    setShowResultOverlay(false);
    setShowConfetti(false);
    setShowAdvice(false);
    setHitFlipIdx(undefined);
    const fresh = newGame();
    setGame(fresh);
    setPrevBank(1000);
    setVisPlayer(0);
    setVisDealer(0);
    setHoleDown(true);
  };

  const dismissResult = () => {
    setShowResultOverlay(false);
    setShowConfetti(false);
  };

  // ── Render ───────────────────────────────────────────────────────────
  const isPlaying = game.phase === 'playing' && !animLock;
  const odds = calculateOdds(game);

  const statTile = (label: string, value: ReactNode) => (
    <div
      className="px-2.5 py-2"
      style={{ background: BG_SURFACE, border: BORDER_GREEN_DIM, borderRadius: '2px' }}
    >
      <div className="font-mono text-[10px] tracking-widest" style={{ color: '#3f9e68' }}>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base font-bold tabular-nums lg:text-lg">{value}</div>
    </div>
  );

  const status = (
    <div>
      {/* COUNT / BANK / SHOE as uniform tiles; the toggle completes the grid */}
      <div className="grid grid-cols-2 gap-2">
        {statTile(
          'COUNT',
          game.showCount ? (
            <span
              style={{
                color:
                  game.runningCount > 0 ? '#4ade80' : game.runningCount < 0 ? '#f87171' : '#86efac',
              }}
            >
              {game.runningCount > 0 ? '+' : ''}
              {game.runningCount}
            </span>
          ) : (
            <span style={{ color: '#3f9e68' }}>—</span>
          )
        )}
        {statTile(
          'BANK',
          <span style={{ color: '#f59e0b' }}>${game.bankroll.toLocaleString()}</span>
        )}
        {statTile('SHOE', <span style={{ color: '#86efac' }}>{remaining} CARDS</span>)}
        <button
          onClick={handleToggleCount}
          className="flex items-center justify-center font-mono text-xs tracking-widest transition-colors duration-150 hover:text-[#86efac]"
          style={{
            background: BG_SURFACE,
            border: BORDER_GREEN_DIM,
            color: '#4ade80',
            borderRadius: '2px',
          }}
        >
          {game.showCount ? 'HIDE COUNT' : 'SHOW COUNT'}
        </button>
      </div>

      {/* Advice line — fixed slot so the layout never jumps */}
      <div
        className="mt-2 flex min-h-[2.25rem] items-center justify-center px-3 py-1 text-center font-mono text-xs lg:text-sm"
        style={{
          background: BG_SURFACE,
          border: BORDER_GREEN_DIM,
          borderRadius: '2px',
          color: '#3f9e68',
        }}
      >
        {game.showCount
          ? game.phase === 'betting'
            ? countAdvice(game.runningCount)
            : 'COUNT THE CARDS AS THEY FALL'
          : 'TRACK THE COUNT YOURSELF'}
      </div>
    </div>
  );

  const rules = (
    <ul
      className="flex flex-col gap-3 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· CLASSIC BLACKJACK — GET CLOSER TO 21 THAN THE DEALER</li>
      <li>· EVERY CARD SHOWS ITS HI-LO VALUE: 2–6 = +1, 10–A = −1</li>
      <li>· KEEP A RUNNING COUNT AS THE CARDS FLY</li>
      <li>· COUNT HIGH? BET BIG — THE DECK IS ON YOUR SIDE</li>
      <li>· SURPRISE QUIZZES CHECK YOUR COUNT BETWEEN HANDS</li>
    </ul>
  );

  return (
    <GameCabinet
      title="CARD COUNTER"
      subtitle="KEEP THE COUNT · BEAT THE DEALER"
      tag="Brain"
      onRestart={handleNewGame}
      status={status}
      rules={rules}
    >
      <style>{STYLES}</style>

      {showConfetti && <Confetti />}

      {showResultOverlay && game.result && (
        <ResultOverlay
          result={game.result}
          bet={resultBet}
          prevBankroll={prevBank}
          newBankroll={game.bankroll}
          onDismiss={dismissResult}
        />
      )}

      <div className="flex w-full flex-col">
        {/* ── Table area ── */}
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 lg:min-h-[400px]">
          {/* Place bet prompt */}
          {game.phase === 'betting' && game.playerHand.length === 0 && !game.message && (
            <p
              className="font-display text-xl tracking-[0.2em] sm:text-2xl lg:text-3xl text-center"
              style={{
                color: '#4ade80',
                textShadow: '0 0 10px #22c55e66',
                animation: 'softPulse 2.5s ease-in-out infinite',
              }}
            >
              PLACE BET TO PLAY
            </p>
          )}

          {/* Dealer hand */}
          {game.dealerHand.length > 0 && visDealer > 0 && (
            <HandDisplay
              cards={game.dealerHand}
              label="Dealer"
              value={dealerValue}
              active={false}
              visibleCount={visDealer}
              holeDown={holeDown}
              flyIn={flyInDealer}
            />
          )}

          {/* Bet chip */}
          {game.bet > 0 && game.phase !== 'betting' && (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-dashed sm:h-14 sm:w-14"
              style={{ borderColor: '#f59e0b88', background: 'rgba(0,0,0,0.4)' }}
            >
              <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>
                ${game.bet}
              </span>
            </div>
          )}

          {/* Message (non-overlay) */}
          {game.message && !showResultOverlay && game.phase === 'betting' && (
            <div
              className="px-4 py-2 text-center text-sm"
              style={{
                background: BG_SURFACE,
                border: BORDER_GREEN_DIM,
                borderRadius: '2px',
                color: '#86efac',
              }}
            >
              {game.message}
            </div>
          )}

          {/* Result badge (inline, when overlay dismissed) */}
          {game.phase === 'result' && !showResultOverlay && game.result && (
            <div
              className="px-5 py-2 text-center text-base font-bold"
              style={
                game.result === 'win' || game.result === 'blackjack'
                  ? {
                      background: '#0a2a14',
                      border: BORDER_GREEN_BRIGHT,
                      color: '#4ade80',
                      borderRadius: '2px',
                    }
                  : game.result === 'lose'
                    ? {
                        background: '#1c0607',
                        border: BORDER_RED_DIM,
                        color: '#f87171',
                        borderRadius: '2px',
                      }
                    : {
                        background: BG_SURFACE,
                        border: BORDER_GREEN_DIM,
                        color: '#86efac',
                        borderRadius: '2px',
                      }
              }
            >
              {game.message}
            </div>
          )}

          {/* Player hand */}
          {game.playerHand.length > 0 && visPlayer > 0 && (
            <HandDisplay
              cards={game.playerHand}
              label="You"
              value={playerValue}
              active={game.phase === 'playing'}
              visibleCount={visPlayer}
              hitFlipIdx={hitFlipIdx}
              flyIn={flyInPlayer}
            />
          )}

          {/* Live odds bar */}
          {game.phase === 'playing' && !animLock && (
            <div className="flex w-full justify-center gap-3 text-sm sm:gap-4 sm:text-xs lg:text-sm">
              <div
                className="px-2.5 py-1.5"
                style={{ background: BG_SURFACE, border: BORDER_GREEN_DIM, borderRadius: '2px' }}
              >
                <span style={{ color: '#3f9e68' }}>Bust risk </span>
                <span
                  className="font-bold"
                  style={{
                    color:
                      odds.bustPct > 50 ? '#f87171' : odds.bustPct > 30 ? '#f59e0b' : '#4ade80',
                  }}
                >
                  {odds.bustPct}%
                </span>
              </div>
              <div
                className="px-2.5 py-1.5"
                style={{ background: BG_SURFACE, border: BORDER_GREEN_DIM, borderRadius: '2px' }}
              >
                <span style={{ color: '#3f9e68' }}>Dealer bust </span>
                <span
                  className="font-bold"
                  style={{ color: odds.dealerBustPct > 35 ? '#4ade80' : '#f59e0b' }}
                >
                  {odds.dealerBustPct}%
                </span>
              </div>
              <div
                className="px-2.5 py-1.5"
                style={{ background: BG_SURFACE, border: BORDER_GREEN_DIM, borderRadius: '2px' }}
              >
                <span style={{ color: '#3f9e68' }}>Edge </span>
                <span
                  className="font-bold"
                  style={{
                    color:
                      odds.playerEdge > 0 ? '#4ade80' : odds.playerEdge < 0 ? '#f87171' : '#86efac',
                  }}
                >
                  {odds.playerEdge > 0 ? '+' : ''}
                  {odds.playerEdge}%
                </span>
              </div>
            </div>
          )}

          {/* Advice panel */}
          {showAdvice && advice && (
            <div
              className="w-full px-4 py-2.5 text-center text-sm lg:text-base"
              style={{
                background: BG_SURFACE,
                border: BORDER_GREEN_DIM,
                color: '#86efac',
                borderRadius: '2px',
              }}
            >
              {'\u{1F4A1}'} {advice}
            </div>
          )}

          {/* Count check quiz */}
          {game.phase === PHASE_COUNT_CHECK && !animLock && (
            <div
              className="w-full p-5 text-center"
              style={{
                background: BG_SURFACE,
                border: BORDER_GREEN_DIM,
                borderRadius: '2px',
              }}
            >
              <p className="text-base font-semibold" style={{ color: '#4ade80' }}>
                What&rsquo;s the running count?
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={countInput}
                  onChange={(e) => setCountInput(e.target.value)}
                  placeholder="?"
                  autoFocus
                  className="w-20 px-3 py-2.5 text-center text-xl font-bold outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={
                    {
                      background: BG_SURFACE,
                      border: BORDER_GREEN_DIM,
                      color: '#86efac',
                      borderRadius: '2px',
                      MozAppearance: 'textfield',
                    } as React.CSSProperties
                  }
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#22c55e')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#1a6632')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCountSubmit();
                  }}
                />
                <button
                  onClick={handleCountSubmit}
                  disabled={countInput === ''}
                  className="px-5 py-2.5 text-base font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                  style={{
                    background: BG_SURFACE,
                    border: BORDER_GREEN_BRIGHT,
                    color: '#4ade80',
                    boxShadow: GLOW_GREEN,
                    borderRadius: '2px',
                  }}
                >
                  Check
                </button>
              </div>
            </div>
          )}

          {/* Count check feedback */}
          {game.phase === 'result' && game.lastCountAnswer !== null && !showResultOverlay && (
            <div
              className="px-4 py-2 text-center text-sm"
              style={
                game.lastCountAnswer === game.runningCount
                  ? { background: '#0a2a14', color: '#4ade80', borderRadius: '2px' }
                  : { background: '#1c0607', color: '#f87171', borderRadius: '2px' }
              }
            >
              {game.lastCountAnswer === game.runningCount
                ? 'Count correct!'
                : `Count was ${game.runningCount > 0 ? '+' : ''}${game.runningCount}, you said ${game.lastCountAnswer > 0 ? '+' : ''}${game.lastCountAnswer}`}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="w-full pt-4">
          {/* Betting phase */}
          {game.phase === 'betting' && (
            <div className="w-full">
              <p className="mb-3 text-center text-sm lg:text-base" style={{ color: '#3f9e68' }}>
                Place your bet
              </p>
              <div className="flex justify-center gap-4 sm:gap-5">
                {BET_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleBet(amount)}
                    disabled={amount > game.bankroll}
                    className="group active:scale-90 disabled:opacity-30"
                  >
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] bg-gradient-to-b shadow-xl transition-transform group-hover:scale-110 sm:h-[72px] sm:w-[72px] lg:h-20 lg:w-20 ${CHIP_COLORS[amount]}`}
                    >
                      <span className="text-sm font-bold text-white drop-shadow sm:text-base lg:text-lg">
                        ${amount}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Playing phase */}
          {isPlaying && (
            <div className="w-full">
              <div className="flex gap-2.5">
                <button
                  onClick={handleHit}
                  className="flex-1 py-3.5 text-base font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 lg:text-lg"
                  style={{
                    background: BG_SURFACE,
                    border: BORDER_GREEN_BRIGHT,
                    color: '#4ade80',
                    boxShadow: GLOW_GREEN,
                    borderRadius: '2px',
                  }}
                >
                  Hit
                </button>
                <button
                  onClick={handleStand}
                  className="flex-1 py-3.5 text-base font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 lg:text-lg"
                  style={{
                    background: '#1c0607',
                    border: BORDER_RED_DIM,
                    color: '#f87171',
                    borderRadius: '2px',
                  }}
                >
                  Stand
                </button>
                <button
                  onClick={handleDouble}
                  disabled={game.playerHand.length !== 2 || game.bet > game.bankroll}
                  className="flex-1 py-3.5 text-base font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 lg:text-lg disabled:opacity-30"
                  style={{
                    background: BG_SURFACE,
                    border: '1px solid #f59e0b',
                    color: '#f59e0b',
                    borderRadius: '2px',
                  }}
                >
                  Double
                </button>
              </div>
              <button
                onClick={() => setShowAdvice((v) => !v)}
                className="mt-2 w-full py-2 text-xs font-semibold transition-all hover:scale-[1.01] active:scale-95"
                style={{
                  background: BG_SURFACE,
                  border: BORDER_GREEN_DIM,
                  color: '#3f9e68',
                  borderRadius: '2px',
                }}
              >
                {showAdvice ? 'Hide Advice' : '\u{1F4A1} Advice'}
              </button>
            </div>
          )}

          {/* Result phase (after overlay dismissed) */}
          {(game.phase === 'result' || game.phase === PHASE_COUNT_CHECK) &&
            !animLock &&
            !showResultOverlay &&
            game.phase !== PHASE_COUNT_CHECK && (
              <div className="flex w-full flex-col gap-2">
                <button
                  onClick={handleNext}
                  className="w-full py-3.5 text-base font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 lg:text-lg"
                  style={{
                    background: BG_SURFACE,
                    border: BORDER_GREEN_BRIGHT,
                    color: '#4ade80',
                    boxShadow: GLOW_GREEN,
                    borderRadius: '2px',
                  }}
                >
                  {game.bankroll <= 0 ? 'New Game' : 'Next Hand'}
                </button>
                <button
                  onClick={handleNewGame}
                  className="w-full py-2 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-95"
                  style={{
                    background: BG_SURFACE,
                    border: '1px solid #1a4a2a',
                    color: '#3f9e68',
                    borderRadius: '2px',
                  }}
                >
                  Reset
                </button>
              </div>
            )}

          {/* Stats bar */}
          <div
            className="mt-2 flex w-full justify-between text-xs lg:text-sm"
            style={{ color: '#3f9e68' }}
          >
            <span>Hands: {game.handsPlayed}</span>
            <span>Bet: {game.bet > 0 ? `$${game.bet}` : '\u2014'}</span>
            {game.countChecks > 0 && (
              <span>
                Count: {game.countCorrect}/{game.countChecks} (
                {Math.round((game.countCorrect / game.countChecks) * 100)}%)
              </span>
            )}
          </div>
        </div>
      </div>
    </GameCabinet>
  );
}
