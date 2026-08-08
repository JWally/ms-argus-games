export type ProxyTag =
  | 'vpn'
  | 'proxy'
  | 'hyperscaler'
  | 'corporate_shield'
  | 'privacy_relay'
  | 'cellular'
  | 'no_webrtc';

export interface ProxyProjection {
  schema_version: string;
  product: 'proxy_v1';
  session_id: string;
  created_at: number | null;
  ttl: number | null;
  network_tampering: number;
  verdict: 'clean' | 'suspect' | 'block';
  identification: {
    client_uuid: string | null;
    network_id: string | null;
    network_id_source: 'category_residential' | 'asn_fallback' | 'none';
  };
  ip: string | null;
  ipLocation: {
    city: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
  };
  ipInfo: {
    asn: {
      number: number | null;
      organization: string | null;
      category: string | null;
      network_class: string | null;
      metadata: Record<string, string | number> | null;
    };
    datacenter: { result: boolean };
    mobile: { result: boolean };
    residential: { result: boolean };
    vpn: { result: boolean };
    hosting: { result: boolean };
    privacy_relay: { result: boolean };
    corporate_shield: { result: boolean };
  };
  tags: ProxyTag[];
  ip_velocity_1h: {
    hits: number;
    blocked?: number;
    distinct_devices_est: number;
    block_rate?: number;
    residential_proxy_suspect: boolean;
    first_seen_ms?: number;
    last_seen_ms?: number;
  } | null;
}

const PROXY_TAGS = new Set<ProxyTag>(['vpn', 'proxy', 'corporate_shield', 'privacy_relay']);

/** "Proxy" is deliberately explicit; datacenter IP alone is not a proxy. */
export function isProxyConnection(projection: ProxyProjection): boolean {
  return (
    projection.tags.some((tag) => PROXY_TAGS.has(tag)) ||
    projection.ipInfo.vpn.result ||
    projection.ipInfo.hosting.result ||
    projection.ipInfo.privacy_relay.result ||
    projection.ipInfo.corporate_shield.result ||
    projection.ip_velocity_1h?.residential_proxy_suspect === true
  );
}

export function connectionLabel(projection: ProxyProjection): string {
  const networkClass = projection.ipInfo.asn.network_class;
  if (networkClass) return networkClass.replace(/_/g, ' ').toUpperCase();
  if (projection.tags.includes('proxy')) return 'PROXY';
  if (projection.tags.includes('vpn')) return 'VPN';
  return 'UNCLASSIFIED NETWORK';
}

const SIGNAL_LABELS: Record<ProxyTag, string> = {
  vpn: 'VPN-like routing',
  proxy: 'proxy evidence',
  hyperscaler: 'cloud-hosted ASN',
  corporate_shield: 'managed network shield',
  privacy_relay: 'privacy relay range',
  cellular: 'cellular network',
  no_webrtc: 'WebRTC unavailable',
};

export function signalLabels(projection: ProxyProjection): string[] {
  return projection.tags.map((tag) => SIGNAL_LABELS[tag]);
}

export function providerLabel(projection: ProxyProjection): string {
  const { number, organization } = projection.ipInfo.asn;
  const asn = number === null ? null : `AS${number}`;
  return [organization, asn].filter(Boolean).join(' · ') || 'Unavailable';
}

export function locationLabel(projection: ProxyProjection): string {
  const { city, country } = projection.ipLocation;
  return [city, country].filter(Boolean).join(', ') || 'Unavailable';
}

export function isProxyProjection(value: unknown): value is ProxyProjection {
  if (!value || typeof value !== 'object') return false;
  const projection = value as Partial<ProxyProjection>;
  return (
    projection.product === 'proxy_v1' &&
    typeof projection.session_id === 'string' &&
    typeof projection.network_tampering === 'number' &&
    Array.isArray(projection.tags) &&
    !!projection.ipInfo &&
    typeof projection.ipInfo === 'object'
  );
}
