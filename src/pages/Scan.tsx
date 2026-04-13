import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScan } from '../hooks/useScan';
import { classifyScan, type IntegrityLike } from '../utils/classifyScan';
import { SignalList } from './scan/SignalList';

const BORDER = '1px solid #0f2a18';
const PROMPT_TEXT = 'Would you like to play a game...?';

/** Animate dots for transient loading states (ANALYZING...). */
function useLoadingDots() {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'));
    }, 250);
    return () => clearInterval(id);
  }, []);
  return dots;
}

/**
 * Picks fields out of the server-stored integrity record at the paths
 * where ms-argus-api's sigint hydration writes them. Best-effort — any
 * missing piece just renders as "—".
 */
function getObserved(integrity: unknown): {
  ip: string;
  asn: string;
  location: string;
  coords: string;
  timezone: string;
} {
  const rec = (integrity ?? {}) as Record<string, unknown>;
  const sigint = (rec.sigint ?? {}) as Record<string, unknown>;
  const cfRaw = (sigint.aws_cf ?? {}) as Record<string, unknown>;
  // Two shapes appear in storage depending on codepath:
  //   1) Post-hydration: sigint.aws_cf.{ip, city, country, lat, lon, tz}
  //   2) Client-fetch passthrough: sigint.aws_cf.data.{...}, plus
  //      {error, durationMs} siblings
  // Prefer the unwrapped form if present, fall back to nested .data.
  const cfData = (cfRaw.data ?? {}) as Record<string, unknown>;
  const pick = (key: string): string | undefined =>
    (cfRaw[key] as string | undefined) ?? (cfData[key] as string | undefined);
  const analysis = (rec.analysis ?? {}) as Record<string, unknown>;
  const ip = (analysis.ip ?? {}) as { asn?: { number?: string; org?: string | null } };

  const ipStr = pick('ip') ?? '—';
  const asnNum = ip.asn?.number ?? pick('asn');
  const asnOrg = ip.asn?.org;
  const asn = asnNum ? `AS${asnNum}${asnOrg ? ` · ${asnOrg}` : ''}` : '—';
  const city = pick('city');
  const country = pick('country');
  const location = [city, country].filter(Boolean).join(', ') || '—';
  const lat = pick('lat');
  const lon = pick('lon');
  const coords = lat && lon ? `${lat}, ${lon}` : '—';
  const timezone = pick('tz') ?? '—';

  return { ip: ipStr, asn, location, coords, timezone };
}

function ObservedMetadata({ integrity }: { integrity: unknown }) {
  const { ip, asn, location, coords, timezone } = getObserved(integrity);
  const rows: [string, string][] = [
    ['IP', ip],
    ['ASN', asn],
    ['LOCATION', location],
    ['COORDS', coords],
    ['TIMEZONE', timezone],
  ];
  return (
    <div className="mt-6 font-mono text-xs tracking-widest">
      <div style={{ color: '#1a6632' }}>OBSERVED:</div>
      <div className="mt-2 space-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <span
              style={{
                color: '#1a6632',
                minWidth: '5.5rem',
                display: 'inline-block',
              }}
            >
              {label}
            </span>
            <span style={{ color: '#4ade80' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Typewriter: reveals `text` one character at a time. Returns the
 * current substring and a `done` flag. `startDelay` gives users a
 * moment to register the cursor before characters start appearing.
 */
function useTypewriter(text: string, speed = 55, startDelay = 350) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    setTyped('');
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startId = setTimeout(() => {
      let i = 0;
      intervalId = setInterval(() => {
        i++;
        setTyped(text.slice(0, i));
        if (i >= text.length && intervalId !== null) {
          clearInterval(intervalId);
        }
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(startId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);
  return { typed, done: typed.length >= text.length };
}

export default function Scan(): ReactElement {
  const navigate = useNavigate();
  const { state, result, error, reveal } = useScan();
  const dots = useLoadingDots();
  const { typed, done: typingDone } = useTypewriter(PROMPT_TEXT);

  // Intro screen visibility. Flips once the user clicks YES (or NO).
  // scanAgain() deliberately does NOT reset this — the intro is a
  // first-visit moment; re-running from within results is a direct
  // re-profile + re-reveal without the theatrical prompt.
  const [answered, setAnswered] = useState(false);

  const yesRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the YES button once typing completes so Enter triggers it.
  useEffect(() => {
    if (typingDone && !answered) yesRef.current?.focus();
  }, [typingDone, answered]);

  const handleYes = () => {
    setAnswered(true);
    reveal();
  };

  const handleNo = () => {
    navigate('/');
  };

  const signals = useMemo(
    () => (result ? classifyScan(result.integrity as IntegrityLike) : []),
    [result]
  );

  const scannedAt = result
    ? new Date(result.scannedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : '';

  // Post-answer status line — only shown after user engages.
  let statusLabel = '';
  let statusColor = '#4ade80';
  if (answered) {
    switch (state) {
      case 'profiling':
      case 'revealing':
        statusLabel = `ANALYZING${dots}`;
        break;
      case 'revealed':
        statusLabel = 'COMPLETE';
        break;
      case 'error':
        statusLabel = 'DIAGNOSTIC OFFLINE';
        statusColor = '#f87171';
        break;
      default:
        statusLabel = '';
    }
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      {/* CRT scanlines overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.18) 3px, rgba(0,10,0,0.18) 4px)',
          opacity: 0.55,
        }}
      />

      {/* Nav */}
      <nav
        className="sticky top-0 z-40"
        style={{
          background: '#030c06f0',
          borderBottom: BORDER,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 16px #000c',
        }}
      >
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="font-display text-base tracking-[0.2em] sm:text-lg"
            style={{
              color: '#4ade80',
              textShadow: '0 0 8px #22c55e, 0 0 20px #22c55e44',
            }}
          >
            ARCADES.CLICK
          </Link>
          <span className="ml-auto font-mono text-xs tracking-widest" style={{ color: '#94a3b8' }}>
            / BOT-BUSTER
          </span>
        </div>
      </nav>

      {/* Main */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div
          className="rounded-[3px] p-5 sm:p-7"
          style={{
            border: BORDER,
            background: '#040e07',
            boxShadow: 'inset 0 0 20px #00000040',
          }}
        >
          <h1
            className="font-display text-lg tracking-[0.25em] sm:text-xl"
            style={{
              color: '#4ade80',
              textShadow: '0 0 8px #22c55e44',
            }}
          >
            &gt; BOT-BUSTER
          </h1>

          {/* ───── INTRO (typed prompt + YES/NO) ───── */}
          {!answered && (
            <div className="mt-10 mb-4 flex flex-col items-center">
              <div
                className="font-mono text-center tracking-wide"
                style={{
                  color: '#4ade80',
                  textShadow: '0 0 6px #22c55e88, 0 0 18px #22c55e33',
                  fontSize: 'clamp(1.25rem, 3.5vw, 2rem)',
                  minHeight: '3rem',
                  lineHeight: 1.4,
                }}
              >
                {typed}
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    marginLeft: '0.15ch',
                    width: '0.6ch',
                    animation: 'argusCursorBlink 1s steps(1) infinite',
                  }}
                >
                  █
                </span>
              </div>

              <style>{`
                @keyframes argusCursorBlink {
                  50% { opacity: 0; }
                }
              `}</style>

              {/* Buttons fade in once typing is done. */}
              <div
                className="mt-10 flex w-full max-w-xs flex-col items-stretch gap-3"
                style={{
                  opacity: typingDone ? 1 : 0,
                  transition: 'opacity 0.4s ease-in',
                  pointerEvents: typingDone ? 'auto' : 'none',
                }}
              >
                <button
                  ref={yesRef}
                  onClick={handleYes}
                  className="font-display tracking-[0.3em] focus:outline-none"
                  style={{
                    color: '#030c06',
                    background: '#4ade80',
                    border: '2px solid #22c55e',
                    padding: '0.9rem 1.25rem',
                    fontSize: '1.5rem',
                    borderRadius: '3px',
                    boxShadow: '0 0 14px #22c55eaa, 0 0 32px #22c55e44, inset 0 0 8px #00000022',
                    cursor: 'pointer',
                  }}
                >
                  [ YES ]
                </button>
                <button
                  onClick={handleNo}
                  className="font-display tracking-[0.3em] focus:outline-none"
                  style={{
                    color: '#4ade80',
                    background: 'transparent',
                    border: '2px solid #1a6632',
                    padding: '0.9rem 1.25rem',
                    fontSize: '1.5rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  [ NO ]
                </button>
              </div>
            </div>
          )}

          {/* ───── POST-ANSWER (reveal / results / error) ───── */}
          {answered && (
            <>
              <div className="mt-5 space-y-1 font-mono text-xs tracking-widest">
                <div>
                  <span style={{ color: '#1a6632' }}>STATUS:&nbsp;&nbsp;</span>
                  <span style={{ color: statusColor }}>{statusLabel}</span>
                </div>
                {state === 'revealed' && (
                  <div>
                    <span style={{ color: '#1a6632' }}>SCANNED: </span>
                    <span>{scannedAt}</span>
                  </div>
                )}
                {state === 'error' && error && (
                  <div style={{ color: '#f87171' }}>ERROR: {error}</div>
                )}
              </div>

              {state === 'revealed' && result && (
                <>
                  <ObservedMetadata integrity={result.integrity} />
                  <div
                    className="mt-6 font-mono text-xs tracking-widest"
                    style={{ color: '#1a6632' }}
                  >
                    DETECTED:
                  </div>
                  <SignalList signals={signals} />
                </>
              )}

              {(state === 'revealed' || state === 'error') && (
                <div className="mt-7 flex flex-wrap gap-2">
                  <Link
                    to="/"
                    className="font-mono text-xs tracking-widest"
                    style={{
                      color: '#4ade80',
                      border: '1px solid #1a6632',
                      background: 'transparent',
                      padding: '0.55rem 1rem',
                      borderRadius: '2px',
                      textDecoration: 'none',
                    }}
                  >
                    [ BACK ]
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
