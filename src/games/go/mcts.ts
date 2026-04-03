// ── MCTS Go AI (9×9) ─────────────────────────────────────────────────
// Monte Carlo Tree Search with UCB1 selection and heuristic rollouts.
// Synchronous — caller wraps in setTimeout to avoid blocking UI.

import {
  type GoState,
  type Stone,
  type Board,
  placeStone,
  passTurn,
  getValidMoves,
  getGroup,
  getLiberties,
  adjacents,
  idx,
  rowOf,
  colOf,
} from './engine';

const ITERATIONS = 600;
const UCB_C = Math.SQRT2;
const ROLLOUT_LIMIT = 40;
const SIZE = 9;

// ── MCTS Node ────────────────────────────────────────────────────────

interface MCTSNode {
  move: number; // board index, or -1 for pass
  wins: number;
  visits: number;
  children: MCTSNode[];
  untriedMoves: number[]; // -1 included for pass
  parent: MCTSNode | null;
  state: GoState;
}

function makeNode(state: GoState, move: number, parent: MCTSNode | null): MCTSNode {
  const valid = getValidMoves(state);
  // Include pass as an option (-1), but weight it last
  const untriedMoves = [...valid, -1];
  return { move, wins: 0, visits: 0, children: [], untriedMoves, parent, state };
}

// ── UCB1 selection ───────────────────────────────────────────────────

function ucb1(child: MCTSNode, parentVisits: number): number {
  if (child.visits === 0) return Infinity;
  return child.wins / child.visits + UCB_C * Math.sqrt(Math.log(parentVisits) / child.visits);
}

function selectChild(node: MCTSNode): MCTSNode {
  let best = node.children[0];
  let bestScore = -Infinity;
  for (const child of node.children) {
    const score = ucb1(child, node.visits);
    if (score > bestScore) {
      bestScore = score;
      best = child;
    }
  }
  return best;
}

// ── Expand ───────────────────────────────────────────────────────────

function expand(node: MCTSNode): MCTSNode {
  const move = node.untriedMoves.shift()!;
  const childState = move === -1 ? passTurn(node.state) : placeStone(node.state, move);
  const child = makeNode(childState, move, node);
  node.children.push(child);
  return child;
}

// ── Rollout ──────────────────────────────────────────────────────────

function rollout(state: GoState, aiPlayer: 1 | 2): number {
  let cur = state;
  let steps = 0;

  while (cur.phase === 'playing' && steps < ROLLOUT_LIMIT) {
    const move = pickRolloutMove(cur);
    cur = move === -1 ? passTurn(cur) : placeStone(cur, move);
    steps++;
  }

  return evaluateState(cur, aiPlayer);
}

function pickRolloutMove(state: GoState): number {
  const valid = getValidMoves(state);
  if (valid.length === 0) return -1;

  // 50% bias toward capture moves
  if (Math.random() < 0.5) {
    const captures = valid.filter((i) => isCaptureMove(state.board, i, state.turn));
    if (captures.length > 0) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
  }

  // Filter out obvious self-atari (fills last liberty of own group)
  const safe = valid.filter((i) => !isSelfAtari(state, i));
  const pool = safe.length > 0 ? safe : valid;
  return pool[Math.floor(Math.random() * pool.length)];
}

function isCaptureMove(board: Board, i: number, player: 1 | 2): boolean {
  const enemy = (player === 1 ? 2 : 1) as Stone;
  for (const adj of adjacents(i)) {
    if (board[adj] === enemy) {
      const group = getGroup(board, adj);
      if (getLiberties(board, group) === 1) return true;
    }
  }
  return false;
}

function isSelfAtari(state: GoState, i: number): boolean {
  // After placing, would own group have exactly 1 liberty? (walking into atari)
  const testBoard = [...state.board] as Board;
  testBoard[i] = state.turn;
  const enemy = (state.turn === 1 ? 2 : 1) as Stone;

  // Remove captures first
  for (const adj of adjacents(i)) {
    if (testBoard[adj] === enemy) {
      const group = getGroup(testBoard, adj);
      if (getLiberties(testBoard, group) === 0) {
        for (const g of group) testBoard[g] = 0;
      }
    }
  }

  const ownGroup = getGroup(testBoard, i);
  return getLiberties(testBoard, ownGroup) === 1;
}

// ── Evaluation ───────────────────────────────────────────────────────
// Fast area count: stones + rough territory (no full flood fill).

function evaluateState(state: GoState, aiPlayer: 1 | 2): number {
  if (state.phase === 'done') {
    if (state.score) {
      return state.score.winner === aiPlayer ? 1 : 0;
    }
    // resigned
    return state.resignedBy === aiPlayer ? 0 : 1;
  }

  // Quick stone count with komi
  let playerScore = 0;
  let aiScore = 5.5; // komi always goes to AI (player 2)
  for (const stone of state.board) {
    if (stone === 1) playerScore++;
    else if (stone === 2) aiScore++;
  }

  const aiWinning = aiPlayer === 2 ? aiScore > playerScore : playerScore > aiScore;
  return aiWinning ? 0.6 : 0.4; // partial credit
}

// ── Backprop ─────────────────────────────────────────────────────────

function backprop(node: MCTSNode, result: number): void {
  let cur: MCTSNode | null = node;
  while (cur !== null) {
    cur.visits++;
    cur.wins += result;
    result = 1 - result; // flip perspective at each level
    cur = cur.parent;
  }
}

// ── Main MCTS loop ───────────────────────────────────────────────────

export function pickMove(state: GoState): number {
  if (state.phase !== 'playing') return -1;

  const aiPlayer = state.turn; // the AI is whoever's turn it is
  const root = makeNode(state, -1, null);

  for (let i = 0; i < ITERATIONS; i++) {
    // Selection
    let node = root;
    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = selectChild(node);
    }

    // Expansion
    if (node.untriedMoves.length > 0 && node.state.phase === 'playing') {
      node = expand(node);
    }

    // Rollout
    const result = rollout(node.state, aiPlayer);

    // Backprop
    backprop(node, result);
  }

  // Pick child with most visits
  if (root.children.length === 0) return -1;

  let best = root.children[0];
  for (const child of root.children) {
    if (child.visits > best.visits) best = child;
  }

  return best.move;
}

// ── Opening bias: avoid playing on edges early ───────────────────────
// Exposed for testing / future use.

export function isEdgePoint(i: number): boolean {
  const r = rowOf(i);
  const c = colOf(i);
  return r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1;
}

export function isCenterRegion(i: number): boolean {
  const r = rowOf(i);
  const c = colOf(i);
  return r >= 2 && r <= 6 && c >= 2 && c <= 6;
}

// Star points on a 9×9 board (0-indexed)
export const STAR_POINTS = new Set([
  idx(2, 2), idx(2, 6),
  idx(6, 2), idx(6, 6),
  idx(4, 4),
]);
