import { useLocation } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { GameLibraryRail, RAIL_WIDTH } from './GameLibraryRail';
import { CrtOverlay } from './GameShell';
import { SiteNav, type SiteNavProps } from './SiteNav';

// ── Site shell ────────────────────────────────────────────────────────
// The one frame every page lives in: uniform SiteNav on top and the
// collapsible game-library rail hugging the left screen edge (desktop
// only, state shared across pages via localStorage). Pages provide their
// nav slots and content.

const BORDER = '1px solid #0f2a18';

const RAIL_PREF_KEY = 'cabinet-library-open';

export function SiteShell({
  center,
  right,
  below,
  children,
}: Pick<SiteNavProps, 'center' | 'right' | 'below'> & { children: ReactNode }) {
  const { pathname } = useLocation();
  const [libraryOpen, setLibraryOpen] = useState(
    () => localStorage.getItem(RAIL_PREF_KEY) !== 'closed'
  );

  const toggleLibrary = () => {
    setLibraryOpen((open) => {
      localStorage.setItem(RAIL_PREF_KEY, open ? 'closed' : 'open');
      return !open;
    });
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />

      <SiteNav
        menuToggle={{ open: libraryOpen, onToggle: toggleLibrary }}
        center={center}
        right={right}
        below={below}
      />

      {/* Library rail hugs the screen edge; page content fills the rest */}
      <div className="flex w-full flex-1">
        <aside
          className="hidden shrink-0 overflow-hidden transition-[width] duration-200 lg:block"
          style={{
            width: libraryOpen ? RAIL_WIDTH : 0,
            borderRight: libraryOpen ? BORDER : 'none',
          }}
        >
          <div
            className="sticky top-12 h-[calc(100vh-3rem)] lg:top-14 lg:h-[calc(100vh-3.5rem)]"
            style={{ width: RAIL_WIDTH }}
          >
            <GameLibraryRail currentPath={pathname} />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
