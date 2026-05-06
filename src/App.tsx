import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Hub from './pages/Hub';
import { useIntegrityGuard } from './hooks/useIntegrityGuard';

// Routes that run their own integrity scan — the app-wide collector should
// skip them so we don't double-POST to /v1/integrity-collect.
const SELF_SCANNED_ROUTES = new Set(['/bot-buster', '/fpjs']);

const Ataxx = lazy(() => import('./pages/Ataxx'));
const Breakout = lazy(() => import('./pages/Breakout'));
const Checkers = lazy(() => import('./pages/Checkers'));
const ColorFlood = lazy(() => import('./pages/ColorFlood'));
const Connect4 = lazy(() => import('./pages/Connect4'));
const Flappy = lazy(() => import('./pages/Flappy'));
const Multiply = lazy(() => import('./pages/Multiply'));
const PegSolitaire = lazy(() => import('./pages/PegSolitaire'));
const SpellingBee = lazy(() => import('./pages/SpellingBee'));
const CardCounter = lazy(() => import('./pages/CardCounter'));
const RockPaperScissors = lazy(() => import('./pages/RockPaperScissors'));
const Battleship = lazy(() => import('./pages/Battleship'));
const BallSort = lazy(() => import('./pages/BallSort'));
const Go = lazy(() => import('./pages/Go'));
const TicTacToe = lazy(() => import('./pages/TicTacToe'));
const HanoiHilton = lazy(() => import('./pages/HanoiHilton'));
const Wayfinder = lazy(() => import('./pages/Wayfinder'));
const Amaze = lazy(() => import('./pages/Amaze'));
const Scan = lazy(() => import('./pages/Scan'));
const Fpjs = lazy(() => import('./pages/Fpjs'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  const { pathname } = useLocation();
  useIntegrityGuard({
    enabled: !SELF_SCANNED_ROUTES.has(pathname),
    trigger: pathname,
  });

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/ataxx" element={<Ataxx />} />
        <Route path="/breakout" element={<Breakout />} />
        <Route path="/checkers" element={<Checkers />} />
        <Route path="/color-flood" element={<ColorFlood />} />
        <Route path="/connect-4" element={<Connect4 />} />
        <Route path="/flappy" element={<Flappy />} />
        <Route path="/multiply" element={<Multiply />} />
        <Route path="/peg-solitaire" element={<PegSolitaire />} />
        <Route path="/spelling-bee" element={<SpellingBee />} />
        <Route path="/card-counter" element={<CardCounter />} />
        <Route path="/rps" element={<RockPaperScissors />} />
        <Route path="/battleship" element={<Battleship />} />
        <Route path="/ball-sort" element={<BallSort />} />
        <Route path="/go" element={<Go />} />
        <Route path="/tic-tac-toe" element={<TicTacToe />} />
        <Route path="/hanoi-hilton" element={<HanoiHilton />} />
        <Route path="/wayfinder" element={<Wayfinder />} />
        <Route path="/amaze" element={<Amaze />} />
        <Route path="/bot-buster" element={<Scan />} />
        <Route path="/fpjs" element={<Fpjs />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
