import { type ReactNode, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Hub from './pages/Hub';
import CaptchaGate from './components/CaptchaGate';

const Ataxx = lazy(() => import('./pages/Ataxx'));
const Breakout = lazy(() => import('./pages/Breakout'));
const Checkers = lazy(() => import('./pages/Checkers'));
const ColorFlood = lazy(() => import('./pages/ColorFlood'));
const Connect4 = lazy(() => import('./pages/Connect4'));
const Flappy = lazy(() => import('./pages/Flappy'));
const Multiply = lazy(() => import('./pages/Multiply'));
const PegSolitaire = lazy(() => import('./pages/PegSolitaire'));
const TicketBlaster = lazy(() => import('./pages/TicketBlaster'));
const SpellingBee = lazy(() => import('./pages/SpellingBee'));
const CardCounter = lazy(() => import('./pages/CardCounter'));
const RockPaperScissors = lazy(() => import('./pages/RockPaperScissors'))
const Battleship = lazy(() => import('./pages/Battleship'));
const BallSort = lazy(() => import('./pages/BallSort'));
const Go = lazy(() => import('./pages/Go'));
const TicTacToe = lazy(() => import('./pages/TicTacToe'));
const HanoiHilton = lazy(() => import('./pages/HanoiHilton'));
const Wayfinder = lazy(() => import('./pages/Wayfinder'));
const Amaze = lazy(() => import('./pages/Amaze'));

function Gated({ children }: { children: ReactNode }) {
  return <CaptchaGate>{children}</CaptchaGate>;
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route
          path="/ataxx"
          element={
            <Gated>
              <Ataxx />
            </Gated>
          }
        />
        <Route
          path="/breakout"
          element={
            <Gated>
              <Breakout />
            </Gated>
          }
        />
        <Route
          path="/checkers"
          element={
            <Gated>
              <Checkers />
            </Gated>
          }
        />
        <Route
          path="/color-flood"
          element={
            <Gated>
              <ColorFlood />
            </Gated>
          }
        />
        <Route
          path="/connect-4"
          element={
            <Gated>
              <Connect4 />
            </Gated>
          }
        />
        <Route
          path="/flappy"
          element={
            <Gated>
              <Flappy />
            </Gated>
          }
        />
        <Route
          path="/multiply"
          element={
            <Gated>
              <Multiply />
            </Gated>
          }
        />
        <Route
          path="/peg-solitaire"
          element={
            <Gated>
              <PegSolitaire />
            </Gated>
          }
        />
        <Route
          path="/spelling-bee"
          element={
            <Gated>
              <SpellingBee />
            </Gated>
          }
        />
        <Route
          path="/card-counter"
          element={
            <Gated>
              <CardCounter />
            </Gated>
          }
        />
        <Route
          path="/rps"
          element={
            <Gated>
              <RockPaperScissors />
            </Gated>
          }
        />
        <Route
          path="/battleship"
          element={
            <Gated>
              <Battleship />
            </Gated>
          }
        />
        <Route
          path="/ball-sort"
          element={
            <Gated>
              <BallSort />
            </Gated>
          }
        />
        <Route
          path="/go"
          element={
            <Gated>
              <Go />
            </Gated>
          }
        />
        <Route
          path="/tic-tac-toe"
          element={
            <Gated>
              <TicTacToe />
            </Gated>
          }
        />
        <Route
          path="/hanoi-hilton"
          element={
            <Gated>
              <HanoiHilton />
            </Gated>
          }
        />
        <Route
          path="/wayfinder"
          element={
            <Gated>
              <Wayfinder />
            </Gated>
          }
        />
        <Route
          path="/amaze"
          element={
            <Gated>
              <Amaze />
            </Gated>
          }
        />
        <Route
          path="/ticket-blaster"
          element={
            <Gated>
              <TicketBlaster />
            </Gated>
          }
        />
      </Routes>
    </Suspense>
  );
}
