/**
 * Maps the merchant-safe API response into the public-facing signal list
 * shown on /scan. This is the SAME data a paying customer sees — we
 * deliberately render nothing beyond what the merchant API returns, so
 * the scan page is an honest preview of the product.
 *
 * Signal vocabulary stays category-level (PROXY / VPN / HYPERSCALER /
 * CORPORATE SHIELD / BROWSER TAMPERING / AUTOMATION / INCOGNITO) without
 * surfacing internal check names. Confidence tiers mirror the server's
 * bucketed confidence on vpn/proxy; binary detections (hyperscaler,
 * corp shield, tampering, incognito) just render DETECTED.
 */

export type SignalKind =
  | 'VPN'
  | 'PROXY'
  | 'HYPERSCALER'
  | 'CORPORATE SHIELD'
  | 'BROWSER TAMPERING'
  | 'AUTOMATION'
  | 'INCOGNITO';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ClassifiedSignal {
  kind: SignalKind;
  confidence?: Confidence;
}

/** Merchant-safe tag vocabulary — must stay in sync with server. */
export type MerchantTag =
  | 'vpn'
  | 'proxy'
  | 'hyperscaler'
  | 'corporate_shield'
  | 'browser_tampering'
  | 'automation'
  | 'incognito'
  | 'cellular'
  | 'no_webrtc';

export interface BrowserDetails {
  browserName: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  device: string | null;
  userAgent: string | null;
}

export interface MerchantIdentification {
  device_id: string | null;
  is_new_device: boolean;
  first_seen_at: number | null;
  last_seen_at: number | null;
  confidence: { score: number };
  crypto_device_id: string | null;
  crypto_verified: boolean | null;
  /** CloudFront-stamped third-party cookie id. Null on absence or fail. */
  tpc_id: string | null;
  /** Unix seconds when the cookie was minted. Null on absence or fail. */
  tpc_created: number | null;
  /** "pass" on verified match, "fail" on tamper/mismatch, null on absence. */
  tpc_verified: 'pass' | 'fail' | null;
  browserDetails: BrowserDetails;
}

export interface MerchantRequestHeaders {
  headers: Record<string, string>;
  cookie_names: string[];
}

export interface MerchantIpLocation {
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

export interface MerchantIpInfo {
  asn: {
    number: number | null;
    organization: string | null;
    category: string | null;
  };
  datacenter: { result: boolean };
}

/**
 * Canonical client-side mirror of the merchant-safe API response. Must
 * stay in sync with ms-argus-api's src/helpers/merchant-projection.ts.
 */
export interface MerchantSafeResponse {
  session_id: string;
  created_at: number | null;
  ttl: number | null;
  identification: MerchantIdentification;
  ip: string | null;
  ipLocation: MerchantIpLocation;
  ipInfo: MerchantIpInfo;
  /** Probabilistic detectors — percentage 0..100, rounded to nearest 5. */
  bot: { probability: number };
  vpn: { probability: number };
  proxy: { probability: number };
  tampering: { probability: number };
  /** Direct observation (not probabilistic). */
  incognito: { result: boolean };
  networkIntegrity: { score: number };
  /** Null when no risk model has run (integrity-only flow, unmatched session). */
  suspectScore: { result: number | null };
  tags: MerchantTag[];
  requestHeaders: MerchantRequestHeaders | null;
  policy: null;
  velocity: null;
}

const BINARY_KINDS: readonly SignalKind[] = ['HYPERSCALER', 'CORPORATE SHIELD', 'INCOGNITO'];

const RED = '#f87171';
const YELLOW = '#f59e0b';
const GREEN = '#4ade80';

function probabilityToConfidence(p: number): Confidence {
  if (p >= 80) return 'HIGH';
  if (p >= 50) return 'MEDIUM';
  return 'LOW';
}

/**
 * Derive the UI signal list directly from the merchant response. Fires
 * at probability >= 50 to match the server's tag threshold; binary
 * detectors (hyperscaler, corp shield, incognito) fire on their bool.
 */
export function classifyScan(merchant: MerchantSafeResponse): ClassifiedSignal[] {
  const signals: ClassifiedSignal[] = [];

  if (merchant.vpn.probability >= 50) {
    signals.push({ kind: 'VPN', confidence: probabilityToConfidence(merchant.vpn.probability) });
  }
  if (merchant.proxy.probability >= 50) {
    signals.push({
      kind: 'PROXY',
      confidence: probabilityToConfidence(merchant.proxy.probability),
    });
  }
  if (merchant.ipInfo.asn.category === 'datacenter') {
    signals.push({ kind: 'HYPERSCALER' });
  }
  if (merchant.ipInfo.asn.category === 'corporate_proxy') {
    signals.push({ kind: 'CORPORATE SHIELD' });
  }
  if (merchant.tampering.probability >= 50) {
    signals.push({
      kind: 'BROWSER TAMPERING',
      confidence: probabilityToConfidence(merchant.tampering.probability),
    });
  }
  if (merchant.incognito.result) {
    signals.push({ kind: 'INCOGNITO' });
  }
  if (merchant.bot.probability >= 50) {
    signals.push({
      kind: 'AUTOMATION',
      confidence: probabilityToConfidence(merchant.bot.probability),
    });
  }

  return signals;
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
