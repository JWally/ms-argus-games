import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

// ── Site-wide top nav ─────────────────────────────────────────────────
// One uniform bar for every page: optional library toggle, the
// ARCADES.CLICK brand (always links home), then page-specific center and
// right slots. Full-width so the left edge lines up with the library rail.

const BORDER = '1px solid #0f2a18';

export interface SiteNavProps {
  /** Page-specific middle content (game title, category filters, …). */
  center?: ReactNode;
  /** Page-specific right-side content (record, search, actions, …). */
  right?: ReactNode;
  /** Rendered below the bar inside the sticky nav (mobile dropdowns). */
  below?: ReactNode;
}

export function SiteNav({ center, right, below }: SiteNavProps) {
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
