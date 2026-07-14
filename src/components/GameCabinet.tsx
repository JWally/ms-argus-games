import { type ReactNode } from 'react';
import { TAG_STYLE, type GameTag } from '../games/catalog';
import { SiteShell } from './SiteShell';

// ── Cabinet shell ─────────────────────────────────────────────────────
// Game-page frame on top of SiteShell: game title + tag in the nav,
// record on the right, and a centered playfield column — status above
// the bezeled board, restart button and rules below.

const BORDER = '1px solid #0f2a18';
const MUTED = '#3f9e68';

export interface GameCabinetProps {
  title: string;
  /** Short flavor line shown above the status block. */
  subtitle?: string;
  tag?: GameTag;
  /** e.g. "12W – 3L" or "BEST 1240" — shown right of the nav. */
  record?: string;
  onRestart?: () => void;
  /** HOW TO PLAY content — card below the playfield. */
  rules?: ReactNode;
  /** Live status (turn, score) — above the playfield. */
  status?: ReactNode;
  /** Extra cards below the rules (leaderboard, records, …). */
  sidebar?: ReactNode;
  /** The playfield. */
  children: ReactNode;
}

export function GameCabinet({
  title,
  subtitle,
  tag,
  record,
  onRestart,
  rules,
  status,
  sidebar,
  children,
}: GameCabinetProps) {
  const tagStyle = tag ? TAG_STYLE[tag] : null;

  return (
    <SiteShell
      center={
        <>
          <span
            className="truncate font-display text-sm tracking-[0.25em] lg:text-lg"
            style={{ color: '#4ade80', textShadow: '0 0 8px #22c55e88, 0 0 24px #22c55e33' }}
          >
            {title}
          </span>
          {tagStyle && tag && (
            <span
              className="hidden shrink-0 font-mono text-[9px] font-bold tracking-widest px-1 py-px sm:inline"
              style={{
                color: tagStyle.color,
                border: `1px solid ${tagStyle.border}`,
                background: tagStyle.bg,
              }}
            >
              {tag.toUpperCase()}
            </span>
          )}
        </>
      }
      right={
        record ? (
          <span
            className="hidden font-mono text-[10px] tracking-widest md:inline lg:text-xs"
            style={{ color: MUTED }}
          >
            {record}
          </span>
        ) : undefined
      }
    >
      <div className="px-4 pb-10 pt-5 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4 lg:max-w-[680px]">
          {subtitle && (
            <p
              className="text-center font-mono text-[10px] tracking-[0.3em] lg:text-xs"
              style={{ color: MUTED }}
            >
              {subtitle}
            </p>
          )}

          {status}

          <div
            className="relative overflow-hidden p-3 sm:p-6"
            style={{ border: BORDER, background: '#040e07' }}
          >
            <div
              aria-hidden="true"
              className="crt-console-lines pointer-events-none absolute inset-0 opacity-50"
            />
            <div className="relative flex flex-col items-center">{children}</div>
          </div>

          {onRestart && (
            <div className="flex justify-end">
              <button
                onClick={onRestart}
                className="font-mono text-[10px] tracking-widest transition-all duration-150 hover:[box-shadow:0_0_12px_#22c55e66] lg:text-xs"
                style={{
                  color: '#4ade80',
                  border: '1px solid #1a6632',
                  background: 'transparent',
                  padding: '6px 12px',
                }}
              >
                ⟳ RESTART
              </button>
            </div>
          )}

          {rules && (
            <section style={{ border: BORDER, background: '#040e07' }}>
              <h2
                className="px-3 pt-2.5 font-display text-[10px] tracking-widest lg:text-xs"
                style={{ color: '#86efac' }}
              >
                HOW TO PLAY
              </h2>
              <div className="px-3 pb-3 pt-2">{rules}</div>
            </section>
          )}

          {sidebar}
        </div>
      </div>
    </SiteShell>
  );
}
