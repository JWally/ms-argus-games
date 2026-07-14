import { Link } from 'react-router-dom';
import { GAME_LINKS, TAG_STYLE, type GameTag } from '../games/catalog';

// ── Game library rail ─────────────────────────────────────────────────
// Desktop sidebar listing every game by category; the current game is
// highlighted. Collapses to a slim strip — the expand/collapse control
// lives on the rail itself, not in the nav.

const MUTED = '#3f9e68';
const BORDER = '1px solid #0f2a18';

const TAG_ORDER: GameTag[] = ['Arcade', 'Strategy', 'Puzzle', 'Brain', 'Diagnostic'];

// ~1/5 of the viewport, bounded so it never crowds the playfield on small
// desktops or balloons on ultrawides.
export const RAIL_WIDTH = 'clamp(180px, 16vw, 260px)';
export const RAIL_COLLAPSED_WIDTH = '44px';

export function GameLibraryRail({
  currentPath,
  collapsed,
  onToggle,
}: {
  currentPath: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    // The whole strip is the expand control — no icon, just the label.
    return (
      <button
        onClick={onToggle}
        aria-label="Expand game library"
        aria-expanded={false}
        className="flex h-full w-full flex-col items-center pt-4 transition-colors duration-150 hover:text-[#86efac]"
        style={{ color: '#4ade80' }}
      >
        <span
          className="select-none font-display text-[13px] tracking-[0.3em]"
          style={{ writingMode: 'vertical-rl', textShadow: '0 0 8px #22c55e44' }}
        >
          MORE GAMES
        </span>
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div
        className="flex shrink-0 items-center justify-between px-4 py-1.5"
        style={{ borderBottom: BORDER }}
      >
        <span
          className="font-display text-sm leading-none tracking-[0.2em]"
          style={{ color: '#86efac' }}
        >
          GAMES
        </span>
        <button
          onClick={onToggle}
          aria-label="Collapse game library"
          aria-expanded={true}
          className="flex flex-col items-center justify-center gap-[3px] p-1 transition-colors duration-150 hover:text-[#86efac]"
          style={{ color: '#4ade80' }}
        >
          <span aria-hidden="true" className="block h-[2px] w-4 bg-current" />
          <span aria-hidden="true" className="block h-[2px] w-4 bg-current" />
          <span aria-hidden="true" className="block h-[2px] w-4 bg-current" />
          <span aria-hidden="true" className="block h-[2px] w-4 bg-current" />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-3 py-3">
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
    </div>
  );
}
