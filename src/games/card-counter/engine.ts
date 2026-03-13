// ── Card Counter: Blackjack with Hi-Lo card counting training ────────

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  rank: Rank;
  suit: Suit;
  faceUp: boolean;
}

export type GamePhase = 'betting' | 'playing' | 'dealer-turn' | 'result' | 'count-check';
export type HandResult = 'win' | 'lose' | 'push' | 'blackjack' | null;

export interface GameState {
  deck: Card[];
  dealt: number; // cards dealt so far (for penetration)
  playerHand: Card[];
  dealerHand: Card[];
  phase: GamePhase;
  bet: number;
  bankroll: number;
  result: HandResult;
  message: string;
  runningCount: number;
  showCount: boolean; // toggle: always show vs hidden (training mode)
  handsPlayed: number;
  countChecks: number;
  countCorrect: number;
  lastCountAnswer: number | null; // player's last count-check answer
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// ── Hi-Lo system ────────────────────────────────────────────────────

export function hiLoValue(rank: Rank): number {
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) return -1;
  return 0; // 7, 8, 9
}

export function hiLoLabel(rank: Rank): string {
  const v = hiLoValue(rank);
  if (v === 1) return '+1';
  if (v === -1) return '-1';
  return '0';
}

// ── Deck ────────────────────────────────────────────────────────────

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, faceUp: true });
    }
  }
  return deck;
}

function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function drawCard(state: GameState, faceUp = true): { card: Card; state: GameState } {
  const card = { ...state.deck[state.dealt], faceUp };
  return { card, state: { ...state, dealt: state.dealt + 1 } };
}

// ── Hand evaluation ─────────────────────────────────────────────────

export function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (!card.faceUp) continue;
    if (card.rank === 'A') {
      aces++;
      total += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

export function isBusted(hand: Card[]): boolean {
  return handValue(hand) > 21;
}

// ── Card display helpers ────────────────────────────────────────────

export function suitSymbol(suit: Suit): string {
  const map: Record<Suit, string> = {
    hearts: '\u2665',
    diamonds: '\u2666',
    clubs: '\u2663',
    spades: '\u2660',
  };
  return map[suit];
}

export function suitColor(suit: Suit): string {
  return suit === 'hearts' || suit === 'diamonds' ? '#ef4444' : '#1a1a1a';
}

// ── Count advice ────────────────────────────────────────────────────

export function countAdvice(runningCount: number): string {
  if (runningCount >= 4) return 'Count is very high — bet big!';
  if (runningCount >= 2) return 'Count is positive — increase your bet';
  if (runningCount <= -3) return 'Count is very negative — bet minimum';
  if (runningCount <= -1) return 'Count is negative — keep bets low';
  return 'Count is neutral — standard bet';
}

// ── Game flow ───────────────────────────────────────────────────────

const INITIAL_BANKROLL = 1000;

export function newGame(): GameState {
  return {
    deck: shuffle(createDeck()),
    dealt: 0,
    playerHand: [],
    dealerHand: [],
    phase: 'betting',
    bet: 0,
    bankroll: INITIAL_BANKROLL,
    result: null,
    message: '',
    runningCount: 0,
    showCount: true,
    handsPlayed: 0,
    countChecks: 0,
    countCorrect: 0,
    lastCountAnswer: null,
  };
}

function needsShuffle(state: GameState): boolean {
  // Reshuffle when ~60% of deck is dealt
  return state.dealt > 30;
}

function reshuffleIfNeeded(state: GameState): GameState {
  if (!needsShuffle(state)) return state;
  return {
    ...state,
    deck: shuffle(createDeck()),
    dealt: 0,
    runningCount: 0,
    message: 'Deck reshuffled!',
  };
}

function updateCount(state: GameState, card: Card): GameState {
  if (!card.faceUp) return state;
  return {
    ...state,
    runningCount: state.runningCount + hiLoValue(card.rank),
  };
}

export function placeBet(state: GameState, bet: number): GameState {
  if (state.phase !== 'betting') return state;
  if (bet > state.bankroll || bet <= 0) return state;

  let s = reshuffleIfNeeded({
    ...state,
    bet,
    bankroll: state.bankroll - bet, // deduct bet upfront
    result: null,
    message: '',
  });

  // Deal initial cards: player, dealer, player, dealer(facedown)
  const d1 = drawCard(s);
  s = updateCount(d1.state, d1.card);

  const d2 = drawCard(s, true);
  s = updateCount(d2.state, d2.card);

  const d3 = drawCard(s);
  s = updateCount(d3.state, d3.card);

  const d4 = drawCard(s, false); // dealer hole card — NOT counted yet
  // Don't update count for face-down card

  s = {
    ...s,
    playerHand: [d1.card, d3.card],
    dealerHand: [d2.card, d4.card],
    phase: 'playing',
  };

  // Check for player blackjack
  if (isBlackjack(s.playerHand)) {
    return revealAndResolve(s);
  }

  return s;
}

export function hit(state: GameState): GameState {
  if (state.phase !== 'playing') return state;

  const { card, state: s } = drawCard(state);
  const updated = updateCount(s, card);
  const newHand = [...updated.playerHand, card];
  const next = { ...updated, playerHand: newHand };

  if (isBusted(newHand)) {
    return revealAndResolve(next);
  }

  return next;
}

export function stand(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  return revealAndResolve(state);
}

export function doubleDown(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  if (state.playerHand.length !== 2) return state;
  if (state.bet > state.bankroll) return state; // need bankroll to cover the extra bet

  const { card, state: s } = drawCard({
    ...state,
    bet: state.bet * 2,
    bankroll: state.bankroll - state.bet, // deduct the additional bet
  });
  const updated = updateCount(s, card);
  const newHand = [...updated.playerHand, card];

  return revealAndResolve({ ...updated, playerHand: newHand });
}

function revealAndResolve(state: GameState): GameState {
  // Flip dealer's hole card and count it
  const dealerHand = state.dealerHand.map((c) => ({ ...c, faceUp: true }));
  let s = { ...state, dealerHand };

  // Count the revealed hole card now
  const holeCard = state.dealerHand.find((c) => !c.faceUp);
  if (holeCard) {
    s = updateCount(s, { ...holeCard, faceUp: true });
  }

  // Dealer draws to 17
  while (handValue(s.dealerHand) < 17) {
    const { card, state: ns } = drawCard(s);
    s = updateCount(ns, card);
    s = { ...s, dealerHand: [...s.dealerHand, card] };
  }

  // Determine result
  const pv = handValue(s.playerHand);
  const dv = handValue(s.dealerHand);
  const playerBJ = isBlackjack(s.playerHand);
  const dealerBJ = isBlackjack(s.dealerHand);

  let result: HandResult;
  let message: string;
  let bankrollDelta: number;

  // Bet was already deducted from bankroll at bet time.
  // bankrollDelta here is what comes BACK to the player.
  if (playerBJ && dealerBJ) {
    result = 'push';
    message = 'Both blackjack — push';
    bankrollDelta = s.bet; // return bet
  } else if (playerBJ) {
    result = 'blackjack';
    message = 'Blackjack! Pays 3:2';
    bankrollDelta = s.bet + Math.floor(s.bet * 1.5); // bet + 1.5x winnings
  } else if (pv > 21) {
    result = 'lose';
    message = `Busted at ${pv}`;
    bankrollDelta = 0; // already lost
  } else if (dv > 21) {
    result = 'win';
    message = `Dealer busts at ${dv}!`;
    bankrollDelta = s.bet * 2; // bet + 1x winnings
  } else if (pv > dv) {
    result = 'win';
    message = `${pv} beats ${dv}!`;
    bankrollDelta = s.bet * 2;
  } else if (dv > pv) {
    result = 'lose';
    message = `Dealer's ${dv} beats ${pv}`;
    bankrollDelta = 0;
  } else {
    result = 'push';
    message = `Push at ${pv}`;
    bankrollDelta = s.bet; // return bet
  }

  const handsPlayed = s.handsPlayed + 1;

  // Every 5 hands (when count is hidden), quiz the player
  const shouldCheck = !s.showCount && handsPlayed % 5 === 0;

  return {
    ...s,
    result,
    message,
    bankroll: s.bankroll + bankrollDelta,
    handsPlayed,
    phase: shouldCheck ? 'count-check' : 'result',
  };
}

export function submitCountCheck(state: GameState, answer: number): GameState {
  if (state.phase !== 'count-check') return state;
  const correct = answer === state.runningCount;
  return {
    ...state,
    phase: 'result',
    countChecks: state.countChecks + 1,
    countCorrect: state.countCorrect + (correct ? 1 : 0),
    lastCountAnswer: answer,
  };
}

export function nextHand(state: GameState): GameState {
  if (state.bankroll <= 0) {
    return {
      ...newGame(),
      showCount: state.showCount,
      message: 'Bankrupt! Starting fresh...',
    };
  }
  return {
    ...state,
    playerHand: [],
    dealerHand: [],
    phase: 'betting',
    bet: 0,
    result: null,
    message: needsShuffle(state) ? 'Deck reshuffled!' : '',
    lastCountAnswer: null,
  };
}

export function toggleShowCount(state: GameState): GameState {
  return { ...state, showCount: !state.showCount };
}

export function cardsRemaining(state: GameState): number {
  return 52 - state.dealt;
}

// ── Basic strategy advice ──────────────────────────────────────────

function dealerUpValue(hand: Card[]): number {
  const up = hand.find((c) => c.faceUp);
  if (!up) return 0;
  if (up.rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(up.rank)) return 10;
  return parseInt(up.rank, 10);
}

function isSoft(hand: Card[]): boolean {
  // Hand is "soft" if it has an ace counted as 11
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (!c.faceUp) continue;
    if (c.rank === 'A') {
      aces++;
      total += 11;
    } else if (['K', 'Q', 'J'].includes(c.rank)) {
      total += 10;
    } else {
      total += parseInt(c.rank, 10);
    }
  }
  // If we have aces and haven't needed to reduce them all, it's soft
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return aces > 0 && total <= 21;
}

function isPair(hand: Card[]): boolean {
  if (hand.length !== 2) return false;
  return hand[0].rank === hand[1].rank;
}

function cardVal(rank: Rank): number {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export function basicStrategyAdvice(state: GameState): string {
  if (state.phase !== 'playing') return '';
  const pv = handValue(state.playerHand);
  const dv = dealerUpValue(state.dealerHand);

  // Pair splitting (simplified — no split in our game, but still advise)
  if (isPair(state.playerHand)) {
    const pairVal = cardVal(state.playerHand[0].rank);
    if (pairVal === 11) return "Always split Aces — but we can't split, so Hit";
    if (pairVal === 8) return "Always split 8s — but we can't split, so Hit";
    // For non-split pairs, fall through to hard/soft logic
  }

  // Soft hands
  if (isSoft(state.playerHand)) {
    if (pv >= 19) return 'Stand — soft 19+ is strong';
    if (pv === 18) {
      if (dv >= 9) return 'Hit — soft 18 vs strong dealer';
      return 'Stand — soft 18 vs weak dealer';
    }
    if (pv === 17) {
      if (state.playerHand.length === 2) return 'Double down — soft 17 vs dealer';
      return 'Hit — soft 17, try to improve';
    }
    return "Hit — soft hand, can't bust";
  }

  // Hard hands
  if (pv >= 17) return 'Stand — 17+ is too risky to hit';
  if (pv >= 13 && pv <= 16) {
    if (dv >= 7) return `Hit — ${pv} vs dealer ${dv}, dealer likely has 17+`;
    return `Stand — ${pv} vs weak dealer (${dv}), let them bust`;
  }
  if (pv === 12) {
    if (dv >= 4 && dv <= 6) return 'Stand — 12 vs weak dealer, let them bust';
    return 'Hit — 12 vs strong dealer, need to improve';
  }
  if (pv === 11) {
    if (state.playerHand.length === 2) return 'Double down! 11 is the best double';
    return "Hit — 11 can't bust";
  }
  if (pv === 10) {
    if (state.playerHand.length === 2 && dv <= 9) return 'Double down — 10 vs weak dealer';
    return "Hit — 10 can't bust";
  }
  if (pv === 9) {
    if (state.playerHand.length === 2 && dv >= 3 && dv <= 6)
      return 'Double down — 9 vs weak dealer';
    return "Hit — 9 can't bust";
  }
  return "Hit — low hand, can't bust";
}

export function fullAdvice(state: GameState): string {
  const strategy = basicStrategyAdvice(state);
  if (!strategy) return '';

  const countTip = state.showCount
    ? ` (Count: ${state.runningCount > 0 ? '+' : ''}${state.runningCount})`
    : '';
  let countMod = '';

  if (state.showCount && state.phase === 'playing') {
    const pv = handValue(state.playerHand);
    if (state.runningCount >= 3 && pv >= 12 && pv <= 16) {
      countMod = ' | High count favors standing';
    } else if (state.runningCount <= -2 && pv >= 12 && pv <= 16) {
      countMod = ' | Low count favors hitting';
    }
  }

  return strategy + countMod + countTip;
}

// ── Real-time odds ─────────────────────────────────────────────────

export interface Odds {
  bustPct: number; // % chance player busts on next hit
  winPct: number; // estimated win probability
  dealerBustPct: number; // estimated dealer bust probability
  playerEdge: number; // positive = player favored
}

function rankValue(rank: Rank): number[] {
  if (rank === 'A') return [1, 11];
  if (['K', 'Q', 'J'].includes(rank)) return [10];
  return [parseInt(rank, 10)];
}

export function calculateOdds(state: GameState): Odds {
  if (state.phase !== 'playing')
    return { bustPct: 0, winPct: 50, dealerBustPct: 28, playerEdge: 0 };

  const pv = handValue(state.playerHand);
  const remaining = state.deck.slice(state.dealt);
  const total = remaining.length;
  if (total === 0) return { bustPct: 0, winPct: 50, dealerBustPct: 28, playerEdge: 0 };

  // Count how many remaining cards would bust the player
  let bustCards = 0;
  for (const card of remaining) {
    const vals = rankValue(card.rank);
    const minVal = Math.min(...vals);
    if (pv + minVal > 21) bustCards++;
  }
  const bustPct = Math.round((bustCards / total) * 100);

  // Estimate dealer bust probability based on up card
  const dealerUp = state.dealerHand.find((c) => c.faceUp);
  let dealerBustPct = 28; // average
  if (dealerUp) {
    // Approximate dealer bust rates by up card (standard probabilities)
    const bustRates: Record<string, number> = {
      '2': 35,
      '3': 37,
      '4': 40,
      '5': 42,
      '6': 42,
      '7': 26,
      '8': 24,
      '9': 23,
      '10': 23,
      J: 23,
      Q: 23,
      K: 23,
      A: 17,
    };
    dealerBustPct = bustRates[dealerUp.rank] ?? 28;
  }

  // Simple win probability estimate
  // If player stands at current value, combine with dealer bust rate and value comparison
  let standWinPct: number;
  if (pv >= 17) {
    standWinPct = dealerBustPct + (100 - dealerBustPct) * 0.4; // rough estimate
  } else if (pv >= 13) {
    standWinPct = dealerBustPct * 0.9;
  } else {
    standWinPct = dealerBustPct * 0.5;
  }

  // If player hits, win% accounts for bust risk
  const hitWinPct = (100 - bustPct) * 0.5 + (100 - bustPct) * dealerBustPct * 0.005;
  const winPct = Math.round(Math.max(standWinPct, hitWinPct));

  // Player edge: positive count helps, factor in bust risk
  const countEdge = state.runningCount * 0.5;
  const playerEdge = Math.round(winPct - 50 + countEdge);

  return { bustPct, winPct: Math.min(99, Math.max(1, winPct)), dealerBustPct, playerEdge };
}
