import { Link } from 'react-router-dom';
import type { LeaderboardResult } from '../games/leaderboard';

/** Fixed CRT scanline overlay — identical across all game pages. */
export function CrtOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.12) 3px, rgba(0,10,0,0.12) 4px)',
        opacity: 0.35,
      }}
    />
  );
}

/** Gradient hr divider used between game header and canvas. */
export function GameDivider({ className }: { className?: string }) {
  return (
    <div
      className={`h-px w-full ${className ?? 'my-2 max-w-[400px]'}`}
      style={{
        background:
          'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
        boxShadow: '0 0 6px #22c55e44',
      }}
    />
  );
}

const MEDAL_COLORS = ['#fbbf24', '#94a3b8', '#b45309'];

/**
 * Shared leaderboard panel — CRT aesthetic, consistent across all games.
 * Pass a `LeaderboardResult` from `getLeaderboard()`, an optional title override,
 * and an optional score formatter (defaults to plain string).
 */
export function Leaderboard({
  result,
  title = 'LEADERBOARD',
  format = String,
  className,
}: {
  result: LeaderboardResult;
  title?: string;
  format?: (score: number) => string;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{ background: '#040e07', border: '1px solid #0f2a18', borderRadius: '2px' }}
    >
      <div
        className="mb-1.5 px-3 pt-2.5 font-mono text-xs tracking-[0.3em]"
        style={{ color: result.isNewBest ? '#4ade80' : '#3f9e68' }}
      >
        {result.isNewBest ? '▲ NEW BEST · ' : ''}
        {title}
      </div>
      <div className="pb-2">
        {result.entries.map((entry, i) => (
          <div
            key={i}
            className="mx-2 mb-0.5 flex items-center gap-2 rounded-sm px-2 py-0.5 font-mono text-xs"
            style={{
              background: entry.isPlayer ? '#0a2a14' : i % 2 !== 0 ? '#030c06' : 'transparent',
              border: entry.isPlayer ? '1px solid #22c55e' : '1px solid transparent',
              color: entry.isPlayer ? '#4ade80' : '#1a6632',
              fontWeight: entry.isPlayer ? 'bold' : undefined,
            }}
          >
            <span
              className="w-5 shrink-0 text-right"
              style={{ color: i < 3 ? MEDAL_COLORS[i] : '#3f9e68' }}
            >
              {i + 1}.
            </span>
            <span className="flex-1 truncate">
              {entry.isPlayer ? `▶ ${entry.name}` : entry.name}
            </span>
            <span style={{ color: entry.isPlayer ? '#4ade80' : '#3f9e68' }}>
              {format(entry.score)}
            </span>
          </div>
        ))}
      </div>
    </div>
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
