import { Routes, Route } from 'react-router-dom';
import Hub from './pages/Hub';
import ScorchedEarth from './pages/ScorchedEarth';
import ColorFlood from './pages/ColorFlood';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/scorched-earth" element={<ScorchedEarth />} />
      <Route path="/color-flood" element={<ColorFlood />} />
    </Routes>
  );
}
