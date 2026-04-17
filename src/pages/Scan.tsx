import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScan } from '../hooks/useScan';
import { classifyScan, type MerchantSafeResponse } from '../utils/classifyScan';
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

const DASH = '—';
const GREEN = '#4ade80';
const RED = '#f87171';
const YELLOW = '#f59e0b';
const MUTED = '#1a6632';

function fmt(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') return DASH;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function fmtEpoch(ms: number | null): string {
  if (ms === null) return DASH;
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function fmtTtl(seconds: number | null): string {
  if (seconds === null) return DASH;
  return new Date(seconds * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// Tag → color. `cellular` is a positive classification (mobile user, not a
// threat). `no_webrtc` is neutral/warning (merchant should correlate).
// Everything else is an adversarial signal.
function tagColor(tag: string): string {
  if (tag === 'cellular') return GREEN;
  if (tag === 'no_webrtc') return YELLOW;
  return RED;
}

function resultColor(result: boolean): string {
  return result ? RED : GREEN;
}

function probabilityColor(p: number): string {
  if (p >= 80) return RED;
  if (p >= 50) return YELLOW;
  if (p > 0) return '#86efac';
  return GREEN;
}

function integrityColor(score: number): string {
  return score >= 0.9 ? GREEN : score >= 0.5 ? YELLOW : RED;
}

// 0 is treated as a suspicious "perfectly clean" reading from an active
// risk model. Null (model didn't run) is handled at the call-site — this
// function never sees null.
function riskColor(score: number): string {
  if (score === 0) return RED;
  return score >= 0.7 ? RED : score >= 0.4 ? YELLOW : GREEN;
}

function pctStr(p: number): string {
  return `${p}%`;
}

/**
 * Renders a label/value row. Stacks label above value on narrow viewports;
 * switches to two-column layout at `sm` breakpoint where the label's fixed
 * 11rem width leaves meaningful room for the value. `colorOverride` drives
 * the value color; unset defaults to GREEN.
 *
 * `value` accepts a ReactNode so callers can append a verification badge
 * (e.g. a green check after the id); when it's a plain string the row
 * renders it as text with word-wrap.
 */
function Row({
  label,
  value,
  colorOverride,
  indent = 0,
}: {
  label: string;
  value: string | ReactElement;
  colorOverride?: string;
  indent?: number;
}): ReactElement {
  return (
    <div
      className="flex flex-col gap-0 sm:flex-row sm:gap-2"
      style={{ paddingLeft: `${indent}rem` }}
    >
      <span className="shrink-0 sm:min-w-[11rem]" style={{ color: MUTED }}>
        {label}
      </span>
      <span
        className="break-words"
        style={{ color: colorOverride ?? GREEN, overflowWrap: 'anywhere' }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Verification badge — appended after an id value to indicate whether the
 * server cryptographically verified it.
 *   pass  → green ✓
 *   fail  → red   ✗
 *   null  → yellow ? (check didn't run, e.g. no sigint token available)
 */
function VerifyBadge({ status }: { status: 'pass' | 'fail' | null }): ReactElement {
  let glyph = '?';
  let color = YELLOW;
  let label = 'not verified';
  if (status === 'pass') {
    glyph = '✓';
    color = GREEN;
    label = 'verified';
  } else if (status === 'fail') {
    glyph = '✗';
    color = RED;
    label = 'verification failed';
  }
  return (
    <span
      aria-label={label}
      title={label}
      style={{ color, marginLeft: '0.5rem', fontWeight: 'bold' }}
    >
      {glyph}
    </span>
  );
}

function SectionHeader({ label }: { label: string }): ReactElement {
  return (
    <div className="mt-4 mb-1" style={{ color: '#94a3b8' }}>
      {label}
    </div>
  );
}

/**
 * Collapsible raw-dump row. Used for the captured request headers so the
 * identification grid stays readable on first glance but the per-header
 * detail is still inspectable on demand.
 */
function HeadersAccordion({
  headers,
  cookieNames,
}: {
  headers: Record<string, string>;
  cookieNames: string[];
}): ReactElement {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(headers);
  const count = entries.length + (cookieNames.length > 0 ? 1 : 0);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-xs tracking-widest focus:outline-none"
        style={{
          color: '#94a3b8',
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
        }}
      >
        {open ? '[-]' : '[+]'} request_headers ({count})
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {entries.map(([name, value]) => (
            <Row key={name} label={name} value={value} indent={1} />
          ))}
          {cookieNames.length > 0 && (
            <Row label="cookies (names only)" value={cookieNames.join(', ')} indent={1} />
          )}
          {entries.length === 0 && cookieNames.length === 0 && (
            <div className="ml-4 font-mono text-xs tracking-widest" style={{ color: MUTED }}>
              {DASH}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders every field of the merchant-safe API response. This is the
 * full, verbatim shape a paying customer sees — identical data, identical
 * field names, no internal extras.
 */
function MerchantView({ merchant }: { merchant: MerchantSafeResponse }): ReactElement {
  const id = merchant.identification;
  const b = id.browserDetails;
  const loc = merchant.ipLocation;
  const asn = merchant.ipInfo.asn;
  const coords =
    loc.latitude !== null && loc.longitude !== null ? `${loc.latitude}, ${loc.longitude}` : DASH;
  const asnStr =
    asn.number === null
      ? DASH
      : `AS${asn.number}${asn.organization ? ` · ${asn.organization}` : ''}`;
  const netIntegrity = merchant.networkIntegrity.score;

  return (
    <div className="mt-6 font-mono text-xs tracking-widest">
      <div style={{ color: '#94a3b8' }}>MERCHANT API RESPONSE:</div>
      <div className="mt-2 space-y-0.5">
        <Row label="session_id" value={fmt(merchant.session_id)} />
        <Row label="created_at" value={fmtEpoch(merchant.created_at)} />
        <Row label="ttl" value={fmtTtl(merchant.ttl)} />

        <SectionHeader label="identification" />
        <Row label="device_id" value={fmt(id.device_id)} indent={1} />
        <Row label="is_new_device" value={fmt(id.is_new_device)} indent={1} />
        <Row label="first_seen_at" value={fmtEpoch(id.first_seen_at)} indent={1} />
        <Row label="last_seen_at" value={fmtEpoch(id.last_seen_at)} indent={1} />
        <Row label="confidence.score" value={id.confidence.score.toFixed(2)} indent={1} />
        <Row
          label="crypto_device_id"
          value={
            <>
              {fmt(id.crypto_device_id)}
              <VerifyBadge
                status={id.crypto_verified === null ? null : id.crypto_verified ? 'pass' : 'fail'}
              />
            </>
          }
          indent={1}
        />
        <Row
          label="tpc_id"
          value={
            <>
              {fmt(id.tpc_id)}
              <VerifyBadge status={id.tpc_verified} />
            </>
          }
          indent={1}
        />
        <Row
          label="tpc_created"
          value={id.tpc_created === null ? DASH : fmtEpoch(id.tpc_created * 1000)}
          indent={1}
        />

        <SectionHeader label="identification.browserDetails" />
        <Row label="browserName" value={fmt(b.browserName)} indent={1} />
        <Row label="browserVersion" value={fmt(b.browserVersion)} indent={1} />
        <Row label="os" value={fmt(b.os)} indent={1} />
        <Row label="osVersion" value={fmt(b.osVersion)} indent={1} />
        <Row label="device" value={fmt(b.device)} indent={1} />
        <Row label="userAgent" value={fmt(b.userAgent)} indent={1} />

        <SectionHeader label="network" />
        <Row label="ip" value={fmt(merchant.ip)} />
        <Row label="ipLocation.city" value={fmt(loc.city)} indent={1} />
        <Row label="ipLocation.country" value={fmt(loc.country)} indent={1} />
        <Row label="ipLocation.coords" value={coords} indent={1} />
        <Row label="ipLocation.timezone" value={fmt(loc.timezone)} indent={1} />
        <Row label="ipInfo.asn" value={asnStr} indent={1} />
        <Row label="ipInfo.asn.category" value={fmt(asn.category)} indent={1} />
        <Row
          label="ipInfo.datacenter"
          value={fmt(merchant.ipInfo.datacenter.result)}
          colorOverride={resultColor(merchant.ipInfo.datacenter.result)}
          indent={1}
        />
        <Row
          label="networkIntegrity.score"
          value={netIntegrity.toFixed(2)}
          colorOverride={integrityColor(netIntegrity)}
          indent={1}
        />

        <SectionHeader label="detectors" />
        <Row
          label="bot.probability"
          value={pctStr(merchant.bot.probability)}
          colorOverride={probabilityColor(merchant.bot.probability)}
          indent={1}
        />
        <Row
          label="vpn.probability"
          value={pctStr(merchant.vpn.probability)}
          colorOverride={probabilityColor(merchant.vpn.probability)}
          indent={1}
        />
        <Row
          label="proxy.probability"
          value={pctStr(merchant.proxy.probability)}
          colorOverride={probabilityColor(merchant.proxy.probability)}
          indent={1}
        />
        <Row
          label="tampering.probability"
          value={pctStr(merchant.tampering.probability)}
          colorOverride={probabilityColor(merchant.tampering.probability)}
          indent={1}
        />
        <Row
          label="incognito.result"
          value={fmt(merchant.incognito.result)}
          colorOverride={resultColor(merchant.incognito.result)}
          indent={1}
        />
        <Row
          label="suspectScore.result"
          value={
            merchant.suspectScore.result === null ? DASH : merchant.suspectScore.result.toFixed(2)
          }
          colorOverride={
            merchant.suspectScore.result === null ? MUTED : riskColor(merchant.suspectScore.result)
          }
          indent={1}
        />

        <SectionHeader label="tags" />
        <div className="flex flex-col gap-0 sm:flex-row sm:gap-2">
          <span className="shrink-0 sm:min-w-[11rem]" style={{ color: MUTED }}>
            tags
          </span>
          <span className="break-words" style={{ overflowWrap: 'anywhere' }}>
            {merchant.tags.length === 0 ? (
              <span style={{ color: GREEN }}>[]</span>
            ) : (
              merchant.tags.map((t, i) => (
                <span key={t}>
                  {i > 0 ? ' ' : ''}
                  <span style={{ color: tagColor(t) }}>[{t}]</span>
                </span>
              ))
            )}
          </span>
        </div>

        {merchant.requestHeaders && (
          <HeadersAccordion
            headers={merchant.requestHeaders.headers}
            cookieNames={merchant.requestHeaders.cookie_names}
          />
        )}

        <SectionHeader label="forward-compat" />
        <Row
          label="policy"
          value={merchant.policy === null ? `${DASH} (pending)` : String(merchant.policy)}
          indent={1}
        />
        <Row
          label="velocity"
          value={merchant.velocity === null ? `${DASH} (pending)` : 'present'}
          indent={1}
        />
      </div>
      <div className="mt-3 text-[0.65rem]" style={{ color: MUTED, lineHeight: 1.5 }}>
        ↑ every field above is what a paying API consumer receives —
        <br />
        no raw signal names, no component scores, no hamming distances.
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

  const signals = useMemo(() => (result ? classifyScan(result.merchant) : []), [result]);

  const scannedAt = result
    ? new Date(result.scannedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : '';

  // Post-answer status line — only shown after user engages.
  let statusLabel = '';
  let statusColor: string = GREEN;
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
        statusColor = RED;
        break;
      default:
        statusLabel = '';
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: '#030c06', color: GREEN }}>
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
              color: GREEN,
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
              color: GREEN,
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
                  color: GREEN,
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
                    background: GREEN,
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
                    color: GREEN,
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
                  <span style={{ color: MUTED }}>STATUS:&nbsp;&nbsp;</span>
                  <span style={{ color: statusColor }}>{statusLabel}</span>
                </div>
                {state === 'revealed' && (
                  <div>
                    <span style={{ color: MUTED }}>SCANNED: </span>
                    <span>{scannedAt}</span>
                  </div>
                )}
                {state === 'error' && error && <div style={{ color: RED }}>ERROR: {error}</div>}
              </div>

              {state === 'revealed' && result && (
                <>
                  <div className="mt-6 font-mono text-xs tracking-widest" style={{ color: MUTED }}>
                    DETECTED:
                  </div>
                  <SignalList signals={signals} />
                  <MerchantView merchant={result.merchant} />
                </>
              )}

              {(state === 'revealed' || state === 'error') && (
                <div className="mt-7 flex flex-wrap gap-2">
                  <Link
                    to="/"
                    className="font-mono text-xs tracking-widest"
                    style={{
                      color: GREEN,
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
