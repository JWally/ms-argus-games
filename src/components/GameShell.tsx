import { Link } from 'react-router-dom';

/** Fixed CRT scanline overlay — identical across all game pages. */
export function CrtOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.15) 3px, rgba(0,10,0,0.15) 4px)',
        opacity: 0.5,
      }}
    />
  );
}

/** Gradient hr divider used between game header and canvas. */
export function GameDivider({ className }: { className?: string }) {
  return (
    <div
      className={`my-2 h-px w-full max-w-[400px] ${className ?? ''}`}
      style={{
        background:
          'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
        boxShadow: '0 0 6px #22c55e44',
      }}
    />
  );
}

/** Standard "← Back to Arcade" nav link used in every game page. */
export function BackLink() {
  return (
    <Link
      to="/"
      className="text-sm font-mono tracking-widest transition-colors hover:underline"
      style={{ color: '#22c55e' }}
    >
      &larr; Back to Arcade
    </Link>
  );
}
