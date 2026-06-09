import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScan, type BotBusterReason } from '../hooks/useScan';
import { classifyScan, type MerchantSafeResponse } from '../utils/classifyScan';
import { SignalList } from './scan/SignalList';
import { CheckoutForm, type CheckoutPayload } from './scan/CheckoutForm';

const BORDER = '1px solid #0f2a18';

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

// Tag → color triage.
//   GREEN  = positive identification (helpful for risk decisions, not adversarial)
//   YELLOW = neutral / informational / privacy-relay traffic
//   RED    = adversarial signal
function tagColor(tag: string): string {
  // Positive / informational classifications
  if (tag === 'cellular' || tag === 'apple_attested' || tag === 'brave_ios') {
    return GREEN;
  }
  // Neutral / merchant-correlation hints
  if (
    tag === 'no_webrtc' ||
    tag === 'privacy_relay' ||
    tag === 'apple_attestation_missing'
  ) {
    return YELLOW;
  }
  // Everything else (vpn/proxy/hyperscaler/corporate_shield/browser_tampering/
  // automation/incognito/location_mismatch/language_mismatch) is adversarial.
  return RED;
}

/**
 * Color a network_class value by its risk profile. Datacenter, vpn_proxy,
 * hosting_proxy, privacy_relay are real adversarial signals → red.
 * Mobile, residential, satellite, business, education, government, security_filter
 * are benign categorizations → green. Unknown is muted.
 */
function networkClassColor(cls: string | null): string {
  if (cls === null) return MUTED;
  if (cls === 'datacenter' || cls === 'vpn_proxy' || cls === 'hosting_proxy') return RED;
  if (cls === 'privacy_relay') return YELLOW;
  return GREEN;
}

/**
 * Color a network_id_source by its trust tier. Category-residential is the
 * highest-confidence ID we derive from network signals; ASN-fallback is
 * usable but lower trust; "none" means no IP-based ID was derivable for
 * this population (mobile / proxy / etc. — by design).
 */
function networkIdSourceColor(src: string | null): string {
  if (src === 'category_residential') return GREEN;
  if (src === 'asn_fallback') return YELLOW;
  return MUTED;
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

function verdictColor(v: 'clean' | 'suspect' | 'block'): string {
  if (v === 'block') return RED;
  if (v === 'suspect') return YELLOW;
  return GREEN;
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
      className="flex flex-col gap-0 border-b border-[#0f2a18] py-[0.2rem] last:border-b-0 sm:flex-row sm:gap-2"
      style={{ paddingLeft: `${indent}rem` }}
    >
      <span className="shrink-0 sm:min-w-[11rem]" style={{ color: MUTED }}>
        {label}
      </span>
      <span
        className="break-words sm:flex-1 sm:text-right"
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

/**
 * Collapsible section. Default closed per the Bot-Buster review — the
 * at-a-glance signals (SignalList above MerchantView) are the money shot;
 * this full-payload view is reference detail the user opens on demand.
 * `count` appears next to the label when set (used for request_headers).
 */
function Section({
  label,
  count,
  children,
  defaultOpen = true,
}: {
  label: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-5">
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
        {open ? '[-]' : '[+]'} {label}
        {count !== undefined ? ` (${count})` : ''}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

/**
 * RDAP + PeeringDB ASN enrichment rendered as compact green rows. Each
 * field is sparse — present only when the lookup found something for the
 * IP/ASN — so the function bails early when the bag is empty.
 */
function AsnMetadataRows({
  metadata,
}: {
  metadata: MerchantSafeResponse['ipInfo']['asn']['metadata'];
}): ReactElement | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  const rows: Array<[string, string | number]> = [];
  if (metadata.parent_org !== undefined) rows.push(['asn.parent_org', metadata.parent_org]);
  if (metadata.customer_org !== undefined) rows.push(['asn.customer_org', metadata.customer_org]);
  if (metadata.pdb_type !== undefined) rows.push(['asn.pdb_type', metadata.pdb_type]);
  if (metadata.ix_count !== undefined) rows.push(['asn.ix_count', metadata.ix_count]);
  return (
    <>
      {rows.map(([label, value]) => (
        <Row key={label} label={label} value={fmt(value)} colorOverride="#86efac" indent={1} />
      ))}
    </>
  );
}

/** Compact "Nm ago" / "Nh ago" / "Nd ago" formatter from a delta in ms. */
function ago(deltaMs: number): string {
  const s = Math.max(1, Math.round(deltaMs / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d ago`;
  const mo = Math.round(d / 30);
  return `${mo}mo ago`;
}

/**
 * Format a BotBusterReason into a human-readable sub-line for the
 * SUCCESS/BLOCKED header. Tampering reasons include the actual score
 * vs threshold; duplicate reasons include "seen N ago" when the prior
 * timestamp is available.
 */
function formatReason(
  reason: BotBusterReason,
  merchant: MerchantSafeResponse | undefined,
  duplicateAt: number | null,
): string {
  if (!reason) return '';
  const T = 20; // matches integrity-proxy TAMPER_THRESHOLD
  const seenAge = duplicateAt ? ` — seen ${ago(Date.now() - duplicateAt)}` : '';
  switch (reason) {
    case 'TAMPERING_AUTOMATION':
      return `automation = ${merchant?.automation ?? '?'}% > ${T}% threshold`;
    case 'TAMPERING_DEVICE':
      return `device_tampering = ${merchant?.device_tampering ?? '?'}% > ${T}% threshold`;
    case 'TAMPERING_NETWORK':
      return `network_tampering = ${merchant?.network_tampering ?? '?'}% > ${T}% threshold`;
    case 'INCOGNITO':
      return `incognito / private-mode session — storage is sandboxed, no purchase eligibility`;
    case 'DUPLICATE_CRYPTO':
      return `crypto_device_id matches a prior successful submission${seenAge}`;
    case 'DUPLICATE_TPC':
      return `tpc_id (3rd-party cookie) matches a prior successful submission${seenAge}`;
    case 'DUPLICATE_UUID':
      return `client_uuid (3-store evercookie) matches a prior successful submission${seenAge}`;
    case 'DUPLICATE_NETWORK_1H':
      return `same IP + browser submitted within the last hour${seenAge}`;
  }
}

/**
 * Big-letter page header that swaps based on bot-buster verdict.
 *   pre-submit: > BOT-BUSTER (green)
 *   scanning:   > BOT-BUSTER (green, current — verdict not in yet)
 *   SUCCESS:    > SUCCESS! (large green glow)
 *   BLOCKED:    > BLOCKED! (large red glow + reason sub-line)
 */
function PageHeader({
  outcome,
  reason,
  merchant,
  duplicateAt,
}: {
  outcome: 'SUCCESS' | 'BLOCKED' | null;
  reason: BotBusterReason;
  merchant: MerchantSafeResponse | undefined;
  duplicateAt: number | null;
}): ReactElement {
  if (outcome === 'SUCCESS') {
    return (
      <h1
        className="font-display tracking-[0.25em]"
        style={{
          color: GREEN,
          textShadow: '0 0 16px #22c55eaa, 0 0 36px #22c55e66',
          fontSize: 'clamp(1.75rem, 5vw, 3rem)',
        }}
      >
        &gt; SUCCESS!
      </h1>
    );
  }
  if (outcome === 'BLOCKED') {
    return (
      <>
        <h1
          className="font-display tracking-[0.25em]"
          style={{
            color: RED,
            textShadow: '0 0 16px #f87171aa, 0 0 36px #f8717166',
            fontSize: 'clamp(1.75rem, 5vw, 3rem)',
          }}
        >
          &gt; BLOCKED!
        </h1>
        {reason && (
          <div
            className="mt-2 font-mono text-xs tracking-widest"
            style={{ color: '#fca5a5' }}
          >
            reason: {reason} — {formatReason(reason, merchant, duplicateAt)}
          </div>
        )}
      </>
    );
  }
  return (
    <h1
      className="font-display text-lg tracking-[0.25em] sm:text-xl"
      style={{ color: GREEN, textShadow: '0 0 8px #22c55e44' }}
    >
      &gt; BOT-BUSTER
    </h1>
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

  const headerEntries = merchant.requestHeaders
    ? Object.entries(merchant.requestHeaders.headers)
    : [];
  const cookieNames = merchant.requestHeaders?.cookie_names ?? [];
  const headersCount = headerEntries.length + (cookieNames.length > 0 ? 1 : 0);

  return (
    <div className="mt-6 font-mono text-xs tracking-widest">
      <div style={{ color: '#94a3b8' }}>API RESPONSE:</div>

      <Section label="session">
        <Row label="session_id" value={fmt(merchant.session_id)} indent={1} />
        <Row label="created_at" value={fmtEpoch(merchant.created_at)} indent={1} />
        <Row label="ttl" value={fmtTtl(merchant.ttl)} indent={1} />
      </Section>

      <Section label="network">
        <Row label="ip" value={fmt(merchant.ip)} indent={1} />
        <Row label="city" value={fmt(loc.city)} indent={1} />
        <Row label="country" value={fmt(loc.country)} indent={1} />
        <Row label="coords" value={coords} indent={1} />
        <Row label="timezone" value={fmt(loc.timezone)} indent={1} />
        <Row label="asn" value={asnStr} indent={1} />
        <Row label="category" value={fmt(asn.category)} indent={1} />
        <Row
          label="network_class"
          value={fmt(asn.network_class)}
          colorOverride={networkClassColor(asn.network_class)}
          indent={1}
        />
        <AsnMetadataRows metadata={asn.metadata} />
        <div style={{ borderTop: BORDER, margin: '6px 0' }} />
        <Row
          label="mobile"
          value={fmt(merchant.ipInfo.mobile.result)}
          colorOverride={merchant.ipInfo.mobile.result ? GREEN : MUTED}
          indent={1}
        />
        <Row
          label="residential"
          value={fmt(merchant.ipInfo.residential.result)}
          colorOverride={merchant.ipInfo.residential.result ? GREEN : MUTED}
          indent={1}
        />
        <Row
          label="datacenter"
          value={fmt(merchant.ipInfo.datacenter.result)}
          colorOverride={resultColor(merchant.ipInfo.datacenter.result)}
          indent={1}
        />
        <Row
          label="vpn"
          value={fmt(merchant.ipInfo.vpn.result)}
          colorOverride={resultColor(merchant.ipInfo.vpn.result)}
          indent={1}
        />
        <Row
          label="hosting (resi-resale)"
          value={fmt(merchant.ipInfo.hosting.result)}
          colorOverride={resultColor(merchant.ipInfo.hosting.result)}
          indent={1}
        />
        <Row
          label="privacy_relay"
          value={fmt(merchant.ipInfo.privacy_relay.result)}
          colorOverride={merchant.ipInfo.privacy_relay.result ? YELLOW : MUTED}
          indent={1}
        />
        <Row
          label="corporate_shield"
          value={fmt(merchant.ipInfo.corporate_shield.result)}
          colorOverride={
            merchant.ipInfo.corporate_shield.result ? YELLOW : MUTED
          }
          indent={1}
        />
        <div style={{ borderTop: BORDER, margin: '6px 0' }} />
        <Row
          label="network_tampering"
          value={pctStr(merchant.network_tampering)}
          colorOverride={probabilityColor(merchant.network_tampering)}
          indent={1}
        />
      </Section>

      <Section label="identification">
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
        <Row label="client_uuid" value={fmt(id.client_uuid)} indent={1} />
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
        <Row
          label="network_id"
          value={fmt(id.network_id)}
          colorOverride={id.network_id ? GREEN : MUTED}
          indent={1}
        />
        <Row
          label="network_id_source"
          value={fmt(id.network_id_source)}
          colorOverride={networkIdSourceColor(id.network_id_source)}
          indent={1}
        />
      </Section>

      <Section label="identification.browserDetails">
        <Row label="browserName" value={fmt(b.browserName)} indent={1} />
        <Row label="browserVersion" value={fmt(b.browserVersion)} indent={1} />
        <Row label="os" value={fmt(b.os)} indent={1} />
        <Row label="osVersion" value={fmt(b.osVersion)} indent={1} />
        <Row label="device" value={fmt(b.device)} indent={1} />
        <Row label="userAgent" value={fmt(b.userAgent)} indent={1} />
        <Row
          label="device_tampering"
          value={pctStr(merchant.device_tampering)}
          colorOverride={probabilityColor(merchant.device_tampering)}
          indent={1}
        />
        <Row
          label="incognito"
          value={fmt(merchant.incognito.result)}
          colorOverride={resultColor(merchant.incognito.result)}
          indent={1}
        />
        <Row
          label="developer_tools"
          value={fmt(merchant.developer_tools.result)}
          colorOverride={resultColor(merchant.developer_tools.result)}
          indent={1}
        />
      </Section>

      <Section label="detectors">
        <Row
          label="automation"
          value={pctStr(merchant.automation)}
          colorOverride={probabilityColor(merchant.automation)}
          indent={1}
        />
        <Row
          label="verdict"
          value={merchant.verdict.toUpperCase()}
          colorOverride={verdictColor(merchant.verdict)}
          indent={1}
        />
      </Section>

      <Section label="tags">
        <div
          className="flex flex-col gap-0 border-b border-[#0f2a18] py-[0.2rem] last:border-b-0 sm:flex-row sm:gap-2"
          style={{ paddingLeft: '1rem' }}
        >
          <span className="shrink-0 sm:min-w-[11rem]" style={{ color: MUTED }}>
            tags
          </span>
          <span
            className="break-words sm:flex-1 sm:text-right"
            style={{ overflowWrap: 'anywhere' }}
          >
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
      </Section>

      {merchant.requestHeaders && (
        <Section label="request_headers" count={headersCount} defaultOpen={false}>
          {headerEntries.map(([name, value]) => (
            <Row key={name} label={name} value={value} indent={1} />
          ))}
          {cookieNames.length > 0 && (
            <Row label="cookies (names only)" value={cookieNames.join(', ')} indent={1} />
          )}
          {headerEntries.length === 0 && cookieNames.length === 0 && (
            <div className="ml-4 font-mono text-xs tracking-widest" style={{ color: MUTED }}>
              {DASH}
            </div>
          )}
        </Section>
      )}

      <div className="mt-6 text-[0.65rem]" style={{ color: MUTED, lineHeight: 1.5 }}>
        ↑ every field above is what a paying API consumer receives —
        <br />
        no raw signal names, no component scores, no hamming distances.
      </div>
    </div>
  );
}

export default function Scan(): ReactElement {
  // Note: useNavigate kept for any future cancel-flow buttons; current
  // checkout UI doesn't offer a NO path.
  useNavigate();
  const { state, result, error, reveal } = useScan();
  const dots = useLoadingDots();

  // Intro screen visibility. Flips once the user submits the checkout
  // form. scanAgain() deliberately does NOT reset this — the form is
  // a first-visit moment; re-running from within results is a direct
  // re-profile + re-reveal without the theatrical prompt.
  const [answered, setAnswered] = useState(false);

  // Attribution handle the user entered on the checkout form (email,
  // handle, BTC addr, anything). Empty when they opted out. Rendered
  // on the verdict screen so they can confirm what we stored.
  const [attribution, setAttribution] = useState<string>('');

  const handleCheckoutSubmit = (payload: CheckoutPayload) => {
    setAnswered(true);
    setAttribution(payload.attribution);
    // reveal() now POSTs /api/leaderboard-entry with the attribution,
    // which internally fetches the merchant projection, runs duplicate
    // detection + tampering thresholds, persists to DDB, and returns
    // both the verdict and the projection. No second call needed.
    reveal(payload.attribution);
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
          <PageHeader
            outcome={state === 'revealed' ? result?.verdict.outcome ?? null : null}
            reason={result?.verdict.reason ?? null}
            merchant={result?.merchant}
            duplicateAt={result?.verdict.duplicateAt ?? null}
          />

          {/* ───── INTRO (fake-checkout form) ───── */}
          {!answered && (
            <>
              <div
                className="mt-3 font-mono text-xs tracking-widest"
                style={{ color: '#94a3b8', lineHeight: 1.6 }}
              >
                Working on bot &amp; proxy detection. If you have a scraper or bot
                and want to see if it gets caught &mdash; without burning the IP &mdash;
                fill out the (free, fake) checkout below. Submitting reveals
                your scorecard.
                <br />
                <span style={{ color: MUTED }}>
                  First verified all-five-pass bypass wins the bounty. Leaderboard
                  handle below.
                </span>
              </div>
              <CheckoutForm onSubmit={handleCheckoutSubmit} />
            </>
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
                  {attribution ? (
                    <div
                      className="mt-4 font-mono text-xs tracking-widest"
                      style={{ color: '#86efac', lineHeight: 1.5 }}
                    >
                      <span style={{ color: MUTED }}>ENTERED AS: </span>
                      <span style={{ overflowWrap: 'anywhere' }}>{attribution}</span>
                      <div style={{ color: MUTED, marginTop: '0.25rem' }}>
                        If you crack all five detectors, we&apos;ll reach you here.
                      </div>
                    </div>
                  ) : (
                    <div
                      className="mt-4 font-mono text-xs tracking-widest"
                      style={{ color: MUTED, lineHeight: 1.5 }}
                    >
                      no leaderboard handle entered &mdash; score won&apos;t be associated with a contact
                    </div>
                  )}
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
