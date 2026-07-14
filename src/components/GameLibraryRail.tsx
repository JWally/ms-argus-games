import { Link } from 'react-router-dom';
import { GAME_LINKS, TAG_STYLE, type GameTag } from '../games/catalog';

// ── Game library rail ─────────────────────────────────────────────────
// Desktop sidebar listing every game by category; the current game is
// highlighted. Rendered by GameCabinet inside a collapsible <aside>.

const MUTED = '#3f9e68';

const TAG_ORDER: GameTag[] = ['Arcade', 'Strategy', 'Puzzle', 'Brain', 'Diagnostic'];

// ~1/5 of the viewport, bounded so it never crowds the playfield on small
// desktops or balloons on ultrawides.
export const RAIL_WIDTH = 'clamp(180px, 16vw, 260px)';

export function GameLibraryRail({ currentPath }: { currentPath: string }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4">
      {TAG_ORDER.map((tag) => {
        const entries = GAME_LINKS.filter((g) => g.tag === tag);
        if (entries.length === 0) return null;
        const style = TAG_STYLE[tag];
        return (
          <section key={tag}>
            <h2
              className="px-2 pb-2 font-display text-[10px] tracking-[0.2em]"
              style={{ color: style.color }}
            >
              {tag.toUpperCase()}
            </h2>
            <div className="flex flex-col">
              {entries.map((g) => {
                const active = g.path === currentPath;
                return (
                  <Link
                    key={g.id}
                    to={g.path}
                    aria-current={active ? 'page' : undefined}
                    className="truncate px-2 py-2 font-mono text-sm tracking-wider transition-colors duration-150 hover:text-[#86efac]"
                    style={{
                      color: active ? '#4ade80' : MUTED,
                      background: active ? '#071a0e' : 'transparent',
                      borderLeft: active ? '2px solid #22c55e' : '2px solid transparent',
                    }}
                  >
                    {g.name.toUpperCase()}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
