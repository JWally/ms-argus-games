import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

// ── Site-wide top nav ─────────────────────────────────────────────────
// One uniform bar for every page: optional library toggle, the
// ARCADES.CLICK brand (always links home), then page-specific center and
// right slots. Full-width so the left edge lines up with the library rail.

const BORDER = '1px solid #0f2a18';
const MUTED = '#3f9e68';

export interface SiteNavProps {
  /** Renders the ☰ GAMES toggle (desktop only) when provided. */
  menuToggle?: { open: boolean; onToggle: () => void };
  /** Page-specific middle content (game title, category filters, …). */
  center?: ReactNode;
  /** Page-specific right-side content (record, search, actions, …). */
  right?: ReactNode;
  /** Rendered below the bar inside the sticky nav (mobile dropdowns). */
  below?: ReactNode;
}

export function SiteNav({ menuToggle, center, right, below }: SiteNavProps) {
  return (
    <nav
      className="sticky top-0 z-40"
      style={{
        background: '#030c06f0',
        borderBottom: BORDER,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 16px #000c',
      }}
    >
      <div className="flex h-12 w-full items-center gap-3 px-4 sm:px-6 lg:h-14 lg:gap-5">
        {menuToggle && (
          <button
            onClick={menuToggle.onToggle}
            aria-label={menuToggle.open ? 'Hide game library' : 'Show game library'}
            aria-expanded={menuToggle.open}
            className="hidden shrink-0 items-center gap-1.5 font-mono text-xs tracking-widest transition-colors duration-150 hover:text-[#86efac] lg:flex"
            style={{ color: menuToggle.open ? '#4ade80' : MUTED }}
          >
            <span aria-hidden="true">☰</span> GAMES
          </button>
        )}

        <Link
          to="/"
          className="shrink-0 font-display text-sm tracking-[0.2em] sm:text-base lg:text-lg"
          style={{
            color: '#4ade80',
            textShadow: '0 0 8px #22c55e, 0 0 20px #22c55e44',
          }}
        >
          ARCADES.CLICK
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">{center}</div>

        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>

      {below}
    </nav>
  );
}
