import { type ReactNode } from 'react';
import { TAG_STYLE, type GameTag } from '../games/catalog';
import { SiteShell } from './SiteShell';

// ── Cabinet shell ─────────────────────────────────────────────────────
// Game-page frame on top of SiteShell: game title + tag in the nav,
// record on the right, and a centered playfield column — status above
// the bezeled board, restart button and rules below.

const BORDER = '1px solid #0f2a18';
const MUTED = '#3f9e68';

function RestartButton({
  onRestart,
  variant,
}: {
  onRestart: () => void;
  variant: 'panel' | 'inline';
}) {
  // Panel variant spans the full card width above it; inline (mobile)
  // stays a compact right-aligned button under the board.
  if (variant === 'panel') {
    return (
      <button
        onClick={onRestart}
        className="w-full font-mono text-sm tracking-widest transition-all duration-150 hover:[box-shadow:0_0_12px_#22c55e66]"
        style={{
          color: '#4ade80',
          border: '1px solid #1a6632',
          background: 'transparent',
          padding: '10px 12px',
        }}
      >
        ⟳ RESTART
      </button>
    );
  }
  return (
    <div className="flex justify-end">
      <button
        onClick={onRestart}
        className="font-mono text-[10px] tracking-widest transition-all duration-150 hover:[box-shadow:0_0_12px_#22c55e66]"
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
  );
}

function RulesCard({ rules, className = '' }: { rules: ReactNode; className?: string }) {
  return (
    <section className={className} style={{ border: BORDER, background: '#040e07' }}>
      <h2
        className="px-3 pt-2.5 font-display text-[10px] tracking-widest lg:text-xs"
        style={{ color: '#86efac' }}
      >
        HOW TO PLAY
      </h2>
      <div className="px-3 pb-3 pt-2">{rules}</div>
    </section>
  );
}

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
      {/* Desktop: board column + info panel side by side so board + chrome
          fit 100vh with no page scroll. Mobile: the classic vertical stack. */}
      <div className="px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pb-5">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4 lg:max-w-none lg:flex-row lg:items-stretch lg:justify-center lg:gap-8">
          {/* PLAYFIELD column */}
          <div className="flex w-full flex-col gap-4 lg:max-w-[680px] lg:flex-1">
            {/* Mobile-only chrome above the board */}
            <div className="flex flex-col gap-4 lg:hidden">
              {subtitle && (
                <p
                  className="text-center font-mono text-[10px] tracking-[0.3em]"
                  style={{ color: MUTED }}
                >
                  {subtitle}
                </p>
              )}
              {status}
            </div>

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

            {/* Mobile-only chrome below the board */}
            <div className="flex flex-col gap-4 lg:hidden">
              {onRestart && <RestartButton onRestart={onRestart} variant="inline" />}
              {rules && <RulesCard rules={rules} />}
              {sidebar}
            </div>
          </div>

          {/* INFO panel — desktop only; absorbs the chrome so the page
              never scrolls past the board */}
          <aside className="hidden w-[300px] shrink-0 flex-col gap-4 lg:flex">
            {subtitle && (
              <p className="font-mono text-xs tracking-[0.25em]" style={{ color: MUTED }}>
                {subtitle}
              </p>
            )}
            {status && (
              <section className="p-3" style={{ border: BORDER, background: '#040e07' }}>
                {status}
              </section>
            )}
            {onRestart && <RestartButton onRestart={onRestart} variant="panel" />}
            {/* flex-1 so the card's bottom edge lines up with the bottom of
                the playfield column */}
            {rules && <RulesCard rules={rules} className="min-h-0 lg:flex-1" />}
            {sidebar}
          </aside>
        </div>
      </div>
    </SiteShell>
  );
}
