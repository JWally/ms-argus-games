import { type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import Hub from './pages/Hub';
import Ataxx from './pages/Ataxx';
import Breakout from './pages/Breakout';
import Checkers from './pages/Checkers';
import ColorFlood from './pages/ColorFlood';
import Connect4 from './pages/Connect4';
import Flappy from './pages/Flappy';
import Multiply from './pages/Multiply';
import RiverRat from './pages/RiverRat';
import PegSolitaire from './pages/PegSolitaire';
import TicketBlaster from './pages/TicketBlaster';
import SpellingBee from './pages/SpellingBee';
import CaptchaGate from './components/CaptchaGate';

function Gated({ children }: { children: ReactNode }) {
  return <CaptchaGate>{children}</CaptchaGate>;
}

export default function App() {
  return (
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
        path="/river-rat"
        element={
          <Gated>
            <RiverRat />
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
      <Route path="/ticket-blaster" element={<TicketBlaster />} />
    </Routes>
  );
}
