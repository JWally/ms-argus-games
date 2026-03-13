import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
const DEALER_MS = 280;
const FLIP_MS = 450;
const RESULT_PAUSE = 800; // pause after last card before showing result

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        className={`relative z-10 mx-4 w-full max-w-[320px] rounded-2xl border-2 p-6 text-center shadow-2xl ${
          isWin
            ? 'border-yellow-400/60 bg-gradient-to-b from-green-900 to-green-950'
            : result === 'lose'
              ? 'border-red-500/40 bg-gradient-to-b from-red-950 to-gray-950'
              : 'border-gray-500/40 bg-gradient-to-b from-gray-900 to-gray-950'
        }`}
        style={{ animation: 'resultSlideIn 0.35s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className={`font-display text-2xl ${isWin ? 'text-yellow-400' : result === 'lose' ? 'text-red-400' : 'text-gray-400'}`}
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
          <div className="flex justify-between text-green-300/60">
            <span>Previous balance</span>
            <span>${prevBankroll.toLocaleString()}</span>
          </div>
          {isWin ? (
            <div className="flex justify-between font-bold text-yellow-400">
              <span>Winnings</span>
              <span>+${winnings.toLocaleString()}</span>
            </div>
          ) : result === 'lose' ? (
            <div className="flex justify-between font-bold text-red-400">
              <span>Lost</span>
              <span>-${bet.toLocaleString()}</span>
            </div>
          ) : (
            <div className="flex justify-between text-gray-400">
              <span>Bet returned</span>
              <span>${bet.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-white/10 pt-1" />
          <div className="flex justify-between text-base font-bold text-white">
            <span>New balance</span>
            <span>${newBankroll.toLocaleString()}</span>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className={`mt-5 w-full rounded-xl py-3 text-sm font-bold active:scale-95 ${
            isWin ? 'bg-yellow-500 text-green-900' : 'bg-white/10 text-white'
          }`}
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
        className="relative h-[110px] w-[76px] sm:h-[150px] sm:w-[105px]"
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
            <span className="text-base font-bold leading-tight sm:text-lg" style={{ color }}>
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
            <span className="text-base font-bold leading-tight sm:text-lg" style={{ color }}>
              {card.rank}
            </span>
            <SuitIcon suit={card.suit} size={12} />
          </div>
          {/* Hi-Lo badge */}
          <span
            className={`absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow-md ${
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
  hitFlipIdx?: number; // index of card currently flipping from hit
}) {
  const shown = cards.slice(0, visibleCount);

  return (
    <div className="text-center">
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="text-sm font-semibold uppercase tracking-wider text-green-200/70 sm:text-base">
          {label}
        </span>
        {value > 0 && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-sm font-bold sm:text-base ${
              value > 21
                ? 'bg-red-600 text-white'
                : value === 21
                  ? 'bg-yellow-500 text-black'
                  : active
                    ? 'bg-white/90 text-green-900'
                    : 'bg-black/40 text-white'
            }`}
          >
            {value}
          </span>
        )}
      </div>
      <div className="flex justify-center gap-2 sm:gap-3">
        {shown.map((card, i) => {
          const isFaceDown =
            (holeDown && i === 1) || // dealer hole card
            (hitFlipIdx !== undefined && i === hitFlipIdx); // hit card flipping

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

    // Deal sequence: P1, D1, P2, D2
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
      // Immediate blackjack?
      if (next.phase === 'result' || next.phase === 'count-check') {
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

    // Card flies in face-down, then flips
    add(() => {
      setHitFlipIdx(undefined); // flip to face-up
    }, 450);

    add(() => {
      setAnimLock(false);
      // Check for bust
      if (next.phase === 'result' || next.phase === 'count-check') {
        // Player busted — pause then show result
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

    // 1. Flip hole card
    add(() => setHoleDown(false), 300);

    // 2. Reveal additional dealer cards one by one (faster)
    const totalDealerCards = resolved.dealerHand.length;
    const extraCards = totalDealerCards - 2;
    const revealStart = 300 + FLIP_MS + 100;

    for (let i = 0; i < extraCards; i++) {
      add(() => setVisDealer(3 + i), revealStart + i * DEALER_MS);
    }

    // 3. Last card settles
    const lastCardDelay = revealStart + Math.max(0, extraCards) * DEALER_MS + 300;
    add(() => {
      setVisDealer(totalDealerCards);
      setFlyInDealer(false);
    }, lastCardDelay);

    // 4. Pause, then show result
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

    // Card flies in face-down, then flips
    add(() => setHitFlipIdx(undefined), 450);

    // Then dealer reveal
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

  return (
    <>
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

      <div
        className="flex h-[100dvh] flex-col"
        style={{ background: 'linear-gradient(160deg, #1a5c2a 0%, #0d3d1a 40%, #0a2e14 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3">
          <Link to="/" className="text-sm text-green-300/70 hover:text-green-200 hover:underline">
            {'\u2190'} Back
          </Link>
          <h1 className="font-display text-base text-yellow-400/90 sm:text-lg">CARD COUNTER</h1>
          <div className="text-right text-sm text-green-300/50">{remaining} left</div>
        </div>

        {/* Info bar */}
        <div className="mt-2 flex items-center justify-between px-4">
          <button
            onClick={handleToggleCount}
            className="rounded-lg bg-black/30 px-2.5 py-1 text-xs font-semibold text-green-300/60 active:scale-95"
          >
            {game.showCount ? 'Hide Count' : 'Show Count'}
          </button>

          {game.showCount ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-300/50">Count:</span>
              <span
                className={`rounded px-2 py-0.5 text-base font-bold ${
                  game.runningCount > 0
                    ? 'bg-green-400/20 text-green-300'
                    : game.runningCount < 0
                      ? 'bg-red-400/20 text-red-300'
                      : 'bg-black/30 text-green-300/50'
                }`}
              >
                {game.runningCount > 0 ? '+' : ''}
                {game.runningCount}
              </span>
            </div>
          ) : (
            <span className="text-xs italic text-green-300/30">Track it yourself!</span>
          )}

          <div className="flex items-center gap-1 text-right">
            <span className="text-xs text-green-300/50">Bank:</span>
            <span className="text-base font-bold text-yellow-400">
              ${game.bankroll.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Count betting advice */}
        {game.showCount && game.phase === 'betting' && (
          <div className="mx-4 mt-1 rounded-lg bg-black/20 px-3 py-1 text-center text-xs text-green-300/50">
            {countAdvice(game.runningCount)}
          </div>
        )}

        {/* ── Table area ── */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4">
          {/* Place bet prompt */}
          {game.phase === 'betting' && game.playerHand.length === 0 && !game.message && (
            <p
              className="text-center font-display text-xl text-lime-400 sm:text-2xl"
              style={{ animation: 'softPulse 2.5s ease-in-out infinite' }}
            >
              Place Bet to Play!
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
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-dashed border-yellow-400/50 bg-black/40 sm:h-14 sm:w-14">
              <span className="text-xs font-bold text-yellow-400">${game.bet}</span>
            </div>
          )}

          {/* Message (non-overlay, for reshuffled etc.) */}
          {game.message && !showResultOverlay && game.phase === 'betting' && (
            <div className="rounded-lg bg-black/40 px-4 py-2 text-center text-sm text-green-200">
              {game.message}
            </div>
          )}

          {/* Result badge (inline, when overlay dismissed) */}
          {game.phase === 'result' && !showResultOverlay && game.result && (
            <div
              className={`rounded-lg px-5 py-2 text-center text-base font-bold shadow-lg ${
                game.result === 'win' || game.result === 'blackjack'
                  ? 'bg-yellow-500 text-green-900'
                  : game.result === 'lose'
                    ? 'bg-red-700/80 text-white'
                    : 'bg-black/50 text-gray-300'
              }`}
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
            <div className="flex w-full max-w-[400px] justify-center gap-3 text-[11px] sm:gap-4 sm:text-xs">
              <div className="rounded-lg bg-black/40 px-2.5 py-1.5">
                <span className="text-green-300/50">Bust risk </span>
                <span
                  className={`font-bold ${odds.bustPct > 50 ? 'text-red-400' : odds.bustPct > 30 ? 'text-yellow-400' : 'text-green-400'}`}
                >
                  {odds.bustPct}%
                </span>
              </div>
              <div className="rounded-lg bg-black/40 px-2.5 py-1.5">
                <span className="text-green-300/50">Dealer bust </span>
                <span
                  className={`font-bold ${odds.dealerBustPct > 35 ? 'text-green-400' : 'text-yellow-400'}`}
                >
                  {odds.dealerBustPct}%
                </span>
              </div>
              <div className="rounded-lg bg-black/40 px-2.5 py-1.5">
                <span className="text-green-300/50">Edge </span>
                <span
                  className={`font-bold ${odds.playerEdge > 0 ? 'text-green-400' : odds.playerEdge < 0 ? 'text-red-400' : 'text-gray-400'}`}
                >
                  {odds.playerEdge > 0 ? '+' : ''}
                  {odds.playerEdge}%
                </span>
              </div>
            </div>
          )}

          {/* Advice panel */}
          {showAdvice && advice && (
            <div className="w-full max-w-[380px] rounded-xl border border-yellow-400/30 bg-black/50 px-4 py-2.5 text-center text-sm text-yellow-300/90">
              {'\u{1F4A1}'} {advice}
            </div>
          )}

          {/* Count check quiz */}
          {game.phase === 'count-check' && !animLock && (
            <div className="w-full max-w-[340px] rounded-xl border border-yellow-400/40 bg-black/60 p-5 text-center">
              <p className="text-base font-semibold text-yellow-400">
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
                  className="w-20 rounded-lg border border-green-700 bg-green-950 px-3 py-2.5 text-center text-xl font-bold text-white outline-none focus:border-yellow-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCountSubmit();
                  }}
                />
                <button
                  onClick={handleCountSubmit}
                  disabled={countInput === ''}
                  className="rounded-lg bg-yellow-500 px-5 py-2.5 text-base font-bold text-green-900 active:scale-95 disabled:opacity-30"
                >
                  Check
                </button>
              </div>
            </div>
          )}

          {/* Count check feedback */}
          {game.phase === 'result' && game.lastCountAnswer !== null && !showResultOverlay && (
            <div
              className={`rounded-lg px-4 py-2 text-center text-sm ${
                game.lastCountAnswer === game.runningCount
                  ? 'bg-green-600/40 text-green-300'
                  : 'bg-red-700/40 text-red-300'
              }`}
            >
              {game.lastCountAnswer === game.runningCount
                ? 'Count correct!'
                : `Count was ${game.runningCount > 0 ? '+' : ''}${game.runningCount}, you said ${game.lastCountAnswer > 0 ? '+' : ''}${game.lastCountAnswer}`}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="px-4 pb-5">
          {/* Betting phase */}
          {game.phase === 'betting' && (
            <div className="mx-auto max-w-[420px]">
              <p className="mb-3 text-center text-sm text-green-300/50">Place your bet</p>
              <div className="flex justify-center gap-4 sm:gap-5">
                {BET_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleBet(amount)}
                    disabled={amount > game.bankroll}
                    className="group active:scale-90 disabled:opacity-30"
                  >
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] bg-gradient-to-b shadow-xl transition-transform group-hover:scale-110 sm:h-[72px] sm:w-[72px] ${CHIP_COLORS[amount]}`}
                    >
                      <span className="text-sm font-bold text-white drop-shadow sm:text-base">
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
            <div className="mx-auto max-w-[420px]">
              <div className="flex gap-2.5">
                <button
                  onClick={handleHit}
                  className="flex-1 rounded-xl bg-green-700 py-3.5 text-base font-bold text-white shadow-lg active:scale-95"
                >
                  Hit
                </button>
                <button
                  onClick={handleStand}
                  className="flex-1 rounded-xl bg-red-700 py-3.5 text-base font-bold text-white shadow-lg active:scale-95"
                >
                  Stand
                </button>
                <button
                  onClick={handleDouble}
                  disabled={game.playerHand.length !== 2 || game.bet > game.bankroll}
                  className="flex-1 rounded-xl bg-yellow-600 py-3.5 text-base font-bold text-white shadow-lg active:scale-95 disabled:opacity-30"
                >
                  Double
                </button>
              </div>
              <button
                onClick={() => setShowAdvice((v) => !v)}
                className="mt-2 w-full rounded-lg bg-black/30 py-2 text-xs font-semibold text-yellow-400/70 active:scale-95"
              >
                {showAdvice ? 'Hide Advice' : '\u{1F4A1} Advice'}
              </button>
            </div>
          )}

          {/* Result phase (after overlay dismissed) */}
          {(game.phase === 'result' || game.phase === 'count-check') &&
            !animLock &&
            !showResultOverlay &&
            game.phase !== 'count-check' && (
              <div className="mx-auto flex max-w-[420px] flex-col gap-2">
                <button
                  onClick={handleNext}
                  className="w-full rounded-xl bg-yellow-500 py-3.5 text-base font-bold text-green-900 shadow-lg active:scale-95"
                >
                  {game.bankroll <= 0 ? 'New Game' : 'Next Hand'}
                </button>
                <button
                  onClick={handleNewGame}
                  className="w-full rounded-xl bg-black/30 py-2 text-sm font-semibold text-green-300/50 active:scale-95"
                >
                  Reset
                </button>
              </div>
            )}

          {/* Stats bar */}
          <div className="mx-auto mt-2 flex max-w-[420px] justify-between text-xs text-green-300/30">
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
    </>
  );
}
