/**
 * Maps a raw integrity result into the public-facing signal list shown on
 * /scan. Keeps wording category-level (PROXY / VPN / HYPERSCALER / CORPORATE
 * SHIELD / BROWSER TAMPERING / AUTOMATION) without exposing which specific
 * checks fired — sophisticated evaders shouldn't be able to tune against
 * exact thresholds from this page alone.
 *
 * Confidence tiers (HIGH / MEDIUM / LOW) only apply to BROWSER TAMPERING and
 * AUTOMATION. Everything else is binary detection.
 *
 * Threshold calibration comes from the empirical batches in
 * memory/project_sigint_detector_findings.md.
 */

export type SignalKind =
  | 'PROXY'
  | 'HYPERSCALER'
  | 'CORPORATE SHIELD'
  | 'BROWSER TAMPERING'
  | 'AUTOMATION';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RawSignal {
  code: string;
  severity: number;
  evidence: string;
}

export interface ClassifiedSignal {
  kind: SignalKind;
  confidence?: Confidence;
  rawSignals: RawSignal[];
}

export interface IntegrityLike {
  analysis?: {
    network?: {
      /** Continuous merchant-facing score [0,1] (noisy-OR of proxy + vpn). */
      proxy_score?: number;
      signals?: RawSignal[];
    };
    ip?: {
      asn?: { category?: string; number?: string; org?: string | null };
      signals?: RawSignal[];
    };
    timezone?: { signals?: RawSignal[] };
    worker?: {
      lied?: boolean;
      divergences?: Array<{ field: string }>;
      signals?: RawSignal[];
    };
    ja4_ua?: { signals?: RawSignal[] };
  };
  vm_signals?: string[];
  device?: {
    lies?: { totalLies?: number };
    headless?: {
      webDriverIsOn?: boolean;
      likeHeadlessRating?: number;
      stealthRating?: number;
    };
  };
}

/**
 * Kinds that use the confidence bucket (HIGH/MEDIUM/LOW) instead of a
 * binary DETECTED tag. PROXY now uses confidence since the score is
 * continuous; HYPERSCALER / CORPORATE SHIELD remain binary (ASN-based
 * category lookup, no gradient).
 */
const BINARY_KINDS: readonly SignalKind[] = ['HYPERSCALER', 'CORPORATE SHIELD'];

const RED = '#f87171';
const YELLOW = '#f59e0b';
const GREEN = '#4ade80';

// --- Per-category detectors (each returns 0 or 1 ClassifiedSignal) ---

/**
 * Single PROXY detector reading the continuous, noisy-OR'd
 * `proxy_score` from the server analyzer. No more separate VPN tag —
 * the score already fuses MSS + RTT evidence. Thresholds:
 *   < 0.2 → no tag (score too low to surface)
 *   0.2–0.5 → LOW
 *   0.5–0.8 → MEDIUM
 *   >= 0.8 → HIGH
 * Thresholds are merchant-UX choices, not detection thresholds — the
 * underlying score is continuous and not exposed in this component's
 * rawSignals (no mechanic leak).
 */
function detectProxy(i: IntegrityLike): ClassifiedSignal | null {
  const score = i.analysis?.network?.proxy_score ?? 0;
  if (score < 0.2) return null;
  const confidence: Confidence = score >= 0.8 ? 'HIGH' : score >= 0.5 ? 'MEDIUM' : 'LOW';
  return { kind: 'PROXY', confidence, rawSignals: [] };
}

function detectAsnCategory(i: IntegrityLike): ClassifiedSignal | null {
  const asn = i.analysis?.ip?.asn;
  const cat = asn?.category;
  if (cat !== 'datacenter' && cat !== 'corporate_proxy') return null;
  const evidence: RawSignal = {
    code: 'asn',
    severity: 1,
    evidence: asn?.org ?? asn?.number ?? cat,
  };
  return {
    kind: cat === 'datacenter' ? 'HYPERSCALER' : 'CORPORATE SHIELD',
    rawSignals: [evidence],
  };
}

function hasJa4UaMismatch(i: IntegrityLike): boolean {
  const all = [...(i.analysis?.ja4_ua?.signals ?? []), ...(i.analysis?.worker?.signals ?? [])];
  return all.some((s) => s.code === 'JA4_UA_BROWSER_MISMATCH');
}

function countRelevantDivergences(i: IntegrityLike): number {
  return (i.analysis?.worker?.divergences ?? []).filter((d) =>
    /navigator|css|screen/i.test(d.field)
  ).length;
}

function tamperConfidence(
  lies: number,
  ja4Mismatch: boolean,
  divergences: number
): Confidence | null {
  if (lies >= 20 || ja4Mismatch || divergences >= 3) return 'HIGH';
  if (lies >= 5 || divergences >= 1) return 'MEDIUM';
  if (lies >= 1) return 'LOW';
  return null;
}

function buildTamperRawSignals(
  lies: number,
  ja4Mismatch: boolean,
  divergences: number
): RawSignal[] {
  const raw: RawSignal[] = [];
  if (lies > 0) {
    raw.push({
      code: 'lies.totalLies',
      severity: Math.min(lies / 20, 1),
      evidence: `${lies} prototype/API lies`,
    });
  }
  if (ja4Mismatch) {
    raw.push({
      code: 'JA4_UA_BROWSER_MISMATCH',
      severity: 0.95,
      evidence: 'TLS fingerprint inconsistent with claimed UA',
    });
  }
  if (divergences > 0) {
    raw.push({
      code: 'worker.divergences',
      severity: 0.5,
      evidence: `${divergences} fields differ between scopes`,
    });
  }
  return raw;
}

function detectTampering(i: IntegrityLike): ClassifiedSignal | null {
  const lies = i.device?.lies?.totalLies ?? 0;
  const ja4 = hasJa4UaMismatch(i);
  const divergences = countRelevantDivergences(i);
  const confidence = tamperConfidence(lies, ja4, divergences);
  if (!confidence) return null;
  return {
    kind: 'BROWSER TAMPERING',
    confidence,
    rawSignals: buildTamperRawSignals(lies, ja4, divergences),
  };
}

function automationConfidence(
  webdriver: boolean,
  likeH: number,
  stealth: number,
  vmSigCount: number
): Confidence | null {
  if (webdriver || likeH >= 50) return 'HIGH';
  if (likeH >= 20 || stealth > 0 || vmSigCount >= 2) return 'MEDIUM';
  if (vmSigCount >= 1 || likeH > 0) return 'LOW';
  return null;
}

function detectAutomation(i: IntegrityLike): ClassifiedSignal | null {
  const h = i.device?.headless ?? {};
  const webdriver = h.webDriverIsOn === true;
  const likeH = h.likeHeadlessRating ?? 0;
  const stealth = h.stealthRating ?? 0;
  const vmSigs = (i.vm_signals ?? []).filter((s) =>
    /worker_lied|no_taskbar|webdriver|no_chrome/.test(s)
  );
  const confidence = automationConfidence(webdriver, likeH, stealth, vmSigs.length);
  if (!confidence) return null;
  const raw: RawSignal[] = [];
  if (likeH > 0 || webdriver) {
    raw.push({
      code: 'headless',
      severity: likeH / 100,
      evidence: `rating=${likeH}${webdriver ? ', webdriver=on' : ''}`,
    });
  }
  for (const s of vmSigs) {
    raw.push({ code: s, severity: 0.4, evidence: s });
  }
  return { kind: 'AUTOMATION', confidence, rawSignals: raw };
}

export function classifyScan(integrity: IntegrityLike): ClassifiedSignal[] {
  const detectors = [detectProxy, detectAsnCategory, detectTampering, detectAutomation];
  return detectors.map((fn) => fn(integrity)).filter((s): s is ClassifiedSignal => s !== null);
}

export function confidenceColor(sig: ClassifiedSignal): typeof RED | typeof YELLOW | typeof GREEN {
  if (BINARY_KINDS.includes(sig.kind)) return RED;
  switch (sig.confidence) {
    case 'HIGH':
      return RED;
    case 'MEDIUM':
      return YELLOW;
    case 'LOW':
    default:
      return GREEN;
  }
}

export function confidenceLabel(sig: ClassifiedSignal): string {
  if (BINARY_KINDS.includes(sig.kind)) return 'DETECTED';
  return sig.confidence ?? 'LOW';
}
