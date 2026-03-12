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

export default function App() {
  return (
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
      <Route path="/river-rat" element={<RiverRat />} />
      <Route path="/ticket-blaster" element={<TicketBlaster />} />
    </Routes>
  );
}
