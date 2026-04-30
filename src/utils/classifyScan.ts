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
  crypto_device_id: string | null;
  crypto_verified: boolean | null;
  /** Three-store client UUID (IDB + localStorage + first-party cookie),
   *  respawned across stores so it survives any single-store clear.
   *  Null when every store failed. */
  client_uuid: string | null;
  /** CloudFront-stamped third-party cookie id. Null on absence or fail. */
  tpc_id: string | null;
  /** Unix seconds when the cookie was minted. Null on absence or fail. */
  tpc_created: number | null;
  /** "pass" on verified match, "fail" on tamper/mismatch, null on absence. */
  tpc_verified: 'pass' | 'fail' | null;
  /**
   * Network-derived stable ID. Backup identifier for fraud prevention when
   * crypto_device_id and tpc_id aren't available. 16-hex characters when
   * derivable; null on mobile/proxy/datacenter populations where IP+UA
   * hashing collapses too many strangers together. */
  network_id: string | null;
  /**
   * Provenance for `network_id`:
   *   - "category_residential": hash(category|ip_/24|ua) — high trust
   *   - "asn_fallback": hash(asn|ip_/24|ua) for unrecognized ASN — lower trust
   *   - "none": no usable ID derivable from network signals
   */
  network_id_source: 'category_residential' | 'asn_fallback' | 'none';
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
    /**
     * Granular network class derived from the IPtoASN dataset + CIDR overlay
     * (mobile / residential / datacenter / vpn_proxy / hosting_proxy / cdn /
     * satellite / privacy_relay / security_filter / business / education /
     * government). Disambiguates within mixed-use ASNs (notably AT&T 7018:
     * mobility cellular vs U-Verse residential). Null when the ASN isn't in
     * the dataset and no CIDR overlay matches.
     */
    network_class: string | null;
  };
  datacenter: { result: boolean };
  /** Convenience boolean — true when network_class === "mobile". */
  mobile: { result: boolean };
}

export type Verdict = 'clean' | 'suspect' | 'block';

/**
 * Canonical client-side mirror of the merchant-safe API response. Must
 * stay in sync with ms-argus-api's src/helpers/merchant-projection.ts.
 *
 * Three threat axes — all 0–100, lower-is-better:
 *   - automation        — automation framework detected (headless, CDP)
 *   - device_tampering  — device lying about itself (lies, CH-UA / JA4 / H2)
 *   - network_tampering — network path being masked (VPN, proxy, geo)
 */
export interface MerchantSafeResponse {
  session_id: string;
  created_at: number | null;
  ttl: number | null;
  automation: number;
  device_tampering: number;
  network_tampering: number;
  verdict: Verdict;
  identification: MerchantIdentification;
  ip: string | null;
  ipLocation: MerchantIpLocation;
  ipInfo: MerchantIpInfo;
  incognito: { result: boolean };
  developer_tools: { result: boolean };
  tags: MerchantTag[];
  requestHeaders: MerchantRequestHeaders | null;
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
 * Derive the UI signal list from the merchant response. Drives off the
 * server's tags array (already category-level) for VPN / PROXY / browser-
 * tampering / automation, with confidence read from the matching axis
 * score. ASN-category and incognito stay as direct boolean checks.
 */
export function classifyScan(merchant: MerchantSafeResponse): ClassifiedSignal[] {
  const signals: ClassifiedSignal[] = [];
  const tags = new Set(merchant.tags);

  if (tags.has('vpn')) {
    signals.push({
      kind: 'VPN',
      confidence: probabilityToConfidence(merchant.network_tampering),
    });
  }
  if (tags.has('proxy')) {
    signals.push({
      kind: 'PROXY',
      confidence: probabilityToConfidence(merchant.network_tampering),
    });
  }
  if (merchant.ipInfo.asn.category === 'datacenter') {
    signals.push({ kind: 'HYPERSCALER' });
  }
  if (merchant.ipInfo.asn.category === 'corporate_proxy') {
    signals.push({ kind: 'CORPORATE SHIELD' });
  }
  if (tags.has('browser_tampering')) {
    signals.push({
      kind: 'BROWSER TAMPERING',
      confidence: probabilityToConfidence(merchant.device_tampering),
    });
  }
  if (merchant.incognito.result) {
    signals.push({ kind: 'INCOGNITO' });
  }
  if (tags.has('automation')) {
    signals.push({
      kind: 'AUTOMATION',
      confidence: probabilityToConfidence(merchant.automation),
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
