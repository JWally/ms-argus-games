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
  | 'PRIVACY RELAY'
  | 'HOSTING PROXY'
  | 'LOCATION MISMATCH'
  | 'LANGUAGE MISMATCH'
  | 'BROWSER TAMPERING'
  | 'AUTOMATION'
  | 'INCOGNITO'
  | 'DEV TOOLS'
  | 'BRAVE iOS'
  | 'APPLE ATTESTED';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ClassifiedSignal {
  kind: SignalKind;
  confidence?: Confidence;
}

/** Merchant-safe tag vocabulary — must stay in sync with server's
 *  MerchantTag union (ms-argus-api/src/helpers/merchant-projection.ts). */
export type MerchantTag =
  | 'vpn'
  | 'proxy'
  | 'hyperscaler'
  | 'corporate_shield'
  | 'privacy_relay'
  | 'browser_tampering'
  | 'automation'
  | 'incognito'
  | 'cellular'
  | 'location_mismatch'
  | 'language_mismatch'
  | 'no_webrtc'
  | 'apple_attested'
  | 'apple_attestation_missing'
  | 'brave_ios';

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

export interface MerchantAsnMetadata {
  /** RDAP-discovered registrant operator on a sub-allocated block
   *  (e.g. ARIN parent on a customer-allocated range). */
  parent_org?: string;
  /** RDAP-discovered customer organization for sub-allocated blocks
   *  (e.g. "BrowserStack" sitting inside an upstream parent's ASN). */
  customer_org?: string;
  /** PeeringDB operator-self-declared type (cable/dsl, hosting, etc.).
   *  Operator-self-declared and may shift between weekly rebuilds —
   *  treat as a hint, not a contract. */
  pdb_type?: string;
  /** PeeringDB internet-exchange presence count for the operator. */
  ix_count?: number;
}

export interface MerchantIpInfo {
  asn: {
    number: number | null;
    organization: string | null;
    /**
     * Legacy 5-value categorization (datacenter / vpn_proxy / corporate_proxy
     * / privacy_relay / mobile). Kept for backwards-compat with pre-existing
     * integrations. Prefer `network_class` (12-value taxonomy) + the booleans
     * below for new rendering.
     */
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
    /** RDAP auto-overlay + PeeringDB enrichment when at least one field is
     *  known for this session's IP/ASN. Sparse coverage by design. */
    metadata: MerchantAsnMetadata | null;
  };
  /** Convenience booleans — all derived from `asn.network_class`. */
  datacenter: { result: boolean };
  mobile: { result: boolean };
  residential: { result: boolean };
  /** True when network_class is vpn_proxy (declared VPN provider). */
  vpn: { result: boolean };
  /** True when network_class is hosting_proxy (residential proxy networks
   *  resold by Bright Data, SOAX, etc. — not the same as `vpn`). */
  hosting: { result: boolean };
  /** True when network_class is privacy_relay (Apple iCloud Private Relay). */
  privacy_relay: { result: boolean };
  /** True when network_class is security_filter (Cisco Umbrella, Zscaler,
   *  Cloudflare Access — corporate cloud-egress shields). */
  corporate_shield: { result: boolean };
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

/** Binary signals — always red `DETECTED` without a confidence tier. */
const BINARY_RED: readonly SignalKind[] = [
  'HYPERSCALER',
  'CORPORATE SHIELD',
  'HOSTING PROXY',
  'INCOGNITO',
  'DEV TOOLS',
  'LOCATION MISMATCH',
  'LANGUAGE MISMATCH',
];
/** Binary signals — yellow / informational, not adversarial. */
const BINARY_YELLOW: readonly SignalKind[] = ['PRIVACY RELAY'];
/** Binary signals — green / positive (privacy browser, Apple attested). */
const BINARY_GREEN: readonly SignalKind[] = ['BRAVE iOS', 'APPLE ATTESTED'];

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
  const ip = merchant.ipInfo;

  // ── Network-layer signals ──
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
  // network_class === 'hosting_proxy' = SOAX / Bright Data residential-resale.
  // Surfaced separately from 'proxy' tag because they're a distinct threat
  // class (declared residential IP being resold as a proxy node).
  if (ip.hosting.result) signals.push({ kind: 'HOSTING PROXY' });
  if (ip.datacenter.result || ip.asn.category === 'datacenter') {
    signals.push({ kind: 'HYPERSCALER' });
  }
  if (ip.corporate_shield.result || ip.asn.category === 'corporate_proxy') {
    signals.push({ kind: 'CORPORATE SHIELD' });
  }
  // Apple iCloud Private Relay — neither adversarial nor positive.
  // Informational so merchants can opt into rules.
  if (ip.privacy_relay.result || tags.has('privacy_relay')) {
    signals.push({ kind: 'PRIVACY RELAY' });
  }

  // ── Geographic / locale mismatches ──
  if (tags.has('location_mismatch')) {
    signals.push({ kind: 'LOCATION MISMATCH' });
  }
  if (tags.has('language_mismatch')) {
    signals.push({ kind: 'LANGUAGE MISMATCH' });
  }

  // ── Device / browser signals ──
  if (tags.has('browser_tampering')) {
    signals.push({
      kind: 'BROWSER TAMPERING',
      confidence: probabilityToConfidence(merchant.device_tampering),
    });
  }
  if (merchant.incognito.result || tags.has('incognito')) {
    signals.push({ kind: 'INCOGNITO' });
  }
  if (merchant.developer_tools.result) {
    signals.push({ kind: 'DEV TOOLS' });
  }
  if (tags.has('automation')) {
    signals.push({
      kind: 'AUTOMATION',
      confidence: probabilityToConfidence(merchant.automation),
    });
  }

  // ── Positive / informational identifications ──
  if (tags.has('brave_ios')) signals.push({ kind: 'BRAVE iOS' });
  if (tags.has('apple_attested')) signals.push({ kind: 'APPLE ATTESTED' });

  return signals;
}

export function confidenceColor(sig: ClassifiedSignal): typeof RED | typeof YELLOW | typeof GREEN {
  if (BINARY_GREEN.includes(sig.kind)) return GREEN;
  if (BINARY_YELLOW.includes(sig.kind)) return YELLOW;
  if (BINARY_RED.includes(sig.kind)) return RED;
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
  if (BINARY_GREEN.includes(sig.kind)) return 'CONFIRMED';
  if (BINARY_YELLOW.includes(sig.kind) || BINARY_RED.includes(sig.kind)) return 'DETECTED';
  return sig.confidence ?? 'LOW';
}
