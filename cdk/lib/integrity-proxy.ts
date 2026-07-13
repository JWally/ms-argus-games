import { createHash } from 'node:crypto';
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const MERCHANT_API_URL = process.env.MERCHANT_API_URL!;
const MERCHANT_API_CREDENTIAL = process.env.MERCHANT_API_CREDENTIAL!;
const MERCHANT_CPI = process.env.MERCHANT_CPI!;
const BOT_BUSTER_TABLE_NAME = process.env.BOT_BUSTER_TABLE_NAME!;

// Bot-buster game thresholds. Any axis above this triggers BLOCKED with
// the corresponding tampering reason. Strict by design — the bounty is
// "find a configuration that passes". 30 would match the API's existing
// SUSPECT threshold; 20 makes the bounty harder.
const TAMPER_THRESHOLD = 20;

// Custom network-id duplicate-detection window. Rolling sliding window.
const NETWORK_ID_TTL_MS = 60 * 60 * 1000; // 1 hour

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const ddb = new DynamoDBClient({});

// Split the merchant credential into its two halves once at cold start.
//   <keyId>.<base64-claims>.<base64-signature>
// First segment goes to APIGW (`x-api-key`); the rest goes to the verifier
// Lambda (`x-argus-token`). Argus issues this combined string in the
// dashboard's "Create New Key" dialog.
function splitCredential(credential: string): { keyId: string; token: string } {
  const idx = credential.indexOf('.');
  if (idx <= 0) throw new Error('credential malformed: missing keyId.token separator');
  return {
    keyId: credential.slice(0, idx),
    token: credential.slice(idx + 1),
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  // Warmer ping
  if (!(event as unknown as Record<string, unknown>).requestContext) {
    return { statusCode: 200, body: 'warm' };
  }

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const route = `${event.requestContext.http.method} ${event.rawPath}`;

  if (route === 'POST /api/integrity/check') {
    return checkIntegrity(event);
  }
  if (route === 'POST /api/leaderboard-entry') {
    return leaderboardEntry(event);
  }

  return {
    statusCode: 400,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify({ error: 'Not found' }),
  };
}

// CloudFront's SPA error responses intercept 403/404 globally — remap to 400.
function safeStatus(status: number): number {
  return status === 403 || status === 404 ? 400 : status;
}

/**
 * Fetch the merchant-safe projection for a session_id from argus. Pure
 * helper — used by both /api/integrity/check (just proxies the result)
 * and /api/leaderboard-entry (consumes the projection to make a verdict).
 */
async function fetchMerchantSession(
  sessionId: string
): Promise<{ status: number; data: Record<string, unknown> }> {
  const { keyId, token } = splitCredential(MERCHANT_API_CREDENTIAL);
  const url = `${MERCHANT_API_URL}/v1/session/${encodeURIComponent(MERCHANT_CPI)}/${encodeURIComponent(sessionId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-api-key': keyId, 'x-argus-token': token },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

/**
 * POST /api/integrity/check
 * Body: { sessionId: string }
 *
 * Proxies to the merchant REST API:
 *   GET ${MERCHANT_API_URL}/v1/session/${MERCHANT_CPI}/${sessionId}
 *
 * The merchant credential lives only here (Lambda env), never in the
 * browser. The browser-side SDK still embeds MERCHANT_CPI (it's public),
 * which it forwards to the integrity-collect endpoint via `x-argus-cpi`.
 * That makes the eventual record retrievable at this composite key.
 *
 * Kept for back-compat. New consumers should prefer /api/leaderboard-entry
 * which does the merchant fetch + bot-buster rules + persistence in one.
 */
async function checkIntegrity(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.sessionId) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'sessionId required' }),
      };
    }
    const { status, data } = await fetchMerchantSession(body.sessionId);
    return {
      statusCode: safeStatus(status),
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch {
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Integrity check failed' }),
    };
  }
}

// ─── Bot-buster leaderboard-entry: the full game flow ──────────────────

interface MerchantProjection {
  session_id?: string;
  automation?: number;
  device_tampering?: number;
  network_tampering?: number;
  verdict?: string;
  identification?: {
    crypto_device_id?: string | null;
    tpc_id?: string | null;
    client_uuid?: string | null;
    browserDetails?: {
      userAgent?: string | null;
      browserName?: string | null;
      os?: string | null;
      device?: string | null;
    };
  };
  incognito?: { result?: boolean };
  tags?: string[];
  ip?: string | null;
}

type Outcome = 'SUCCESS' | 'BLOCKED';
type BlockReason =
  | 'TAMPERING_AUTOMATION'
  | 'TAMPERING_DEVICE'
  | 'TAMPERING_NETWORK'
  | 'INCOGNITO'
  | 'DUPLICATE_CRYPTO'
  | 'DUPLICATE_TPC'
  | 'DUPLICATE_UUID'
  | 'DUPLICATE_NETWORK_1H'
  | null;

/**
 * Pull the viewer's real IP from CloudFront-Viewer-Address. Format is
 * `ip:port` (CF docs); strip the port. Falls back to API Gateway's
 * sourceIp which is the CF edge IP if the header is missing.
 */
function getViewerIp(event: APIGatewayProxyEventV2): string {
  const headers = event.headers || {};
  // Header name is case-insensitive but API Gateway normalizes to lowercase.
  const raw = headers['cloudfront-viewer-address'];
  if (typeof raw === 'string' && raw.length > 0) {
    // IPv4: "1.2.3.4:12345" — strip after last colon
    // IPv6: "[2001:db8::1]:12345" — strip bracket + after final :
    if (raw.startsWith('[')) {
      const close = raw.indexOf(']');
      if (close > 0) return raw.slice(1, close);
    }
    const lastColon = raw.lastIndexOf(':');
    if (lastColon > 0) return raw.slice(0, lastColon);
    return raw;
  }
  return event.requestContext.http.sourceIp || '';
}

/**
 * Hash the viewer IP + server-parsed UA. Server-parsed UA (from
 * `merchant.identification.browserDetails.userAgent`) is the one argus
 * extracted from the HTTP request header — harder to spoof than the
 * SDK-supplied `navigator.userAgent`.
 *
 * Truncated to 32 hex chars (128 bits). Stable across submissions from
 * the same household-with-this-browser within the 1-hour TTL window.
 */
function computeCustomNetworkId(ip: string, ua: string): string {
  return createHash('sha256').update(`${ip}\n${ua}`).digest('hex').slice(0, 32);
}

/**
 * Query a GSI for ANY prior SUCCESS row matching `value` on the
 * indexed key. Returns the matched row's session_id (the first one
 * found) or null. Sparse indexes — null values aren't stored in the
 * index, so we can skip the query if `value` is null.
 */
interface PriorMatch {
  /** session_id of the prior SUCCESS row that matched */
  session_id: string;
  /** Epoch ms when that prior submission was recorded — surfaced to the
   *  user so blocked-as-duplicate messages can say "seen 12 days ago". */
  created_at: number;
}

async function findPriorSuccess(
  indexName: string,
  keyName: string,
  value: string | null,
  rangeFilter?: { fromMs: number }
): Promise<PriorMatch | null> {
  if (!value) return null;
  const expr: Record<string, string> = { '#k': keyName, '#outcome': 'outcome' };
  const vals: Record<string, unknown> = { ':v': value, ':success': 'SUCCESS' };
  let keyCond = '#k = :v';
  if (rangeFilter) {
    expr['#created'] = 'created_at';
    vals[':from'] = rangeFilter.fromMs;
    keyCond += ' AND #created >= :from';
  }
  // CRITICAL: do NOT set Limit here. DDB applies Limit BEFORE
  // FilterExpression, so `Limit:1 + Filter:outcome=SUCCESS` reads only
  // the first row matching the KeyCondition (which may be BLOCKED) and
  // then filters it out, returning null even when matching SUCCESS rows
  // exist further down the partition. We let DDB return up to 1MB per
  // query — per-ID partitions stay small in practice (one row per
  // submission against this ID), so the read is cheap. We then find the
  // most-recent SUCCESS in code.
  const out = await ddb.send(
    new QueryCommand({
      TableName: BOT_BUSTER_TABLE_NAME,
      IndexName: indexName,
      KeyConditionExpression: keyCond,
      ExpressionAttributeNames: expr,
      ExpressionAttributeValues: marshall(vals),
      FilterExpression: '#outcome = :success',
      ScanIndexForward: false,
    })
  );
  if (!out.Items || out.Items.length === 0) return null;
  // Items already filtered to outcome=SUCCESS. Pick the most recent
  // (highest created_at). For network-index (composite key) this is
  // already first thanks to ScanIndexForward:false; for HASH-only
  // indexes there's no inherent order so we sort explicitly.
  let best: { session_id?: string; created_at?: number } | undefined;
  for (const raw of out.Items) {
    const it = unmarshall(raw) as { session_id?: string; created_at?: number };
    if (!it.session_id || typeof it.created_at !== 'number') continue;
    if (!best || (best.created_at ?? 0) < it.created_at) best = it;
  }
  if (!best || !best.session_id || typeof best.created_at !== 'number') return null;
  return { session_id: best.session_id, created_at: best.created_at };
}

/**
 * Run the four duplicate-detection queries in priority order.
 * Returns the first match found, or null+null if nothing duplicates.
 * Crypto IDs check forever; custom_network_id checks within the
 * NETWORK_ID_TTL_MS rolling window.
 */
/** Per-axis tampering thresholds. Order matches priority: automation
 *  beats device beats network when multiple axes exceed. */
function checkTamperingThresholds(m: MerchantProjection): BlockReason {
  if ((m.automation ?? 0) > TAMPER_THRESHOLD) return 'TAMPERING_AUTOMATION';
  if ((m.device_tampering ?? 0) > TAMPER_THRESHOLD) return 'TAMPERING_DEVICE';
  if ((m.network_tampering ?? 0) > TAMPER_THRESHOLD) return 'TAMPERING_NETWORK';
  return null;
}

async function checkDuplicates(
  id: NonNullable<MerchantProjection['identification']>,
  customNetworkId: string
): Promise<{ reason: BlockReason; duplicate: PriorMatch | null }> {
  const checks: Array<{
    index: string;
    key: string;
    value: string | null | undefined;
    reason: BlockReason;
    rangeFilter?: { fromMs: number };
  }> = [
    {
      index: 'crypto-index',
      key: 'crypto_device_id',
      value: id.crypto_device_id,
      reason: 'DUPLICATE_CRYPTO',
    },
    { index: 'tpc-index', key: 'tpc_id', value: id.tpc_id, reason: 'DUPLICATE_TPC' },
    { index: 'uuid-index', key: 'client_uuid', value: id.client_uuid, reason: 'DUPLICATE_UUID' },
    {
      index: 'network-index',
      key: 'custom_network_id',
      value: customNetworkId,
      reason: 'DUPLICATE_NETWORK_1H',
      rangeFilter: { fromMs: Date.now() - NETWORK_ID_TTL_MS },
    },
  ];
  for (const c of checks) {
    const hit = await findPriorSuccess(c.index, c.key, c.value ?? null, c.rangeFilter);
    if (hit) return { reason: c.reason, duplicate: hit };
  }
  return { reason: null, duplicate: null };
}

/** Build the DDB row for a bot-buster entry. Strips undefined so sparse
 *  GSIs don't get cluttered with empty values. */
function buildEntryItem(args: {
  sessionId: string;
  attribution: string;
  outcome: Outcome;
  reason: BlockReason;
  duplicateOf: string | null;
  customNetworkId: string;
  viewerIp: string;
  m: MerchantProjection;
}): Record<string, unknown> {
  const { sessionId, attribution, outcome, reason, duplicateOf, customNetworkId, viewerIp, m } =
    args;
  const id = m.identification ?? {};
  const bd = id.browserDetails ?? {};
  const safeTags = Array.isArray(m.tags)
    ? m.tags.filter((t): t is string => typeof t === 'string').slice(0, 32)
    : [];
  const item: Record<string, unknown> = {
    cpi: MERCHANT_CPI,
    created_at: Date.now(),
    session_id: sessionId,
    attribution: attribution || undefined,
    outcome,
    block_reason: reason ?? undefined,
    duplicate_of: duplicateOf ?? undefined,
    crypto_device_id: id.crypto_device_id ?? undefined,
    tpc_id: id.tpc_id ?? undefined,
    client_uuid: id.client_uuid ?? undefined,
    custom_network_id: customNetworkId,
    viewer_ip: viewerIp || undefined,
    ua_head: (bd.userAgent ?? '').slice(0, 200) || undefined,
    verdict: m.verdict ?? undefined,
    automation: m.automation ?? undefined,
    device_tampering: m.device_tampering ?? undefined,
    network_tampering: m.network_tampering ?? undefined,
    tags: safeTags.length > 0 ? safeTags : undefined,
    browser: bd.browserName ?? undefined,
    os: bd.os ?? undefined,
    device: bd.device ?? undefined,
  };
  return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined));
}

/**
 * POST /api/leaderboard-entry
 * Body: { sessionId: string, attribution?: string }
 *
 * Full bot-buster game flow:
 *   1. Fetch merchant projection from argus
 *   2. Threshold check: any tampering axis > TAMPER_THRESHOLD → BLOCKED
 *   3. Duplicate checks (4 GSI queries via checkDuplicates):
 *      a. crypto_device_id matches a prior SUCCESS (forever)
 *      b. tpc_id matches a prior SUCCESS (forever)
 *      c. client_uuid matches a prior SUCCESS (forever)
 *      d. custom_network_id = hash(viewer_ip + server_ua) within last 1hr
 *   4. Always persist the entry (SUCCESS or BLOCKED, with reason)
 *   5. Return { outcome, reason, duplicate_of, merchant } to the frontend
 *
 * The merchant projection is included in the response so the frontend
 * can render the full forensic view without a second call.
 */
async function leaderboardEntry(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = JSON.parse(event.body || '{}') as {
      sessionId?: string;
      attribution?: string;
    };
    if (typeof body.sessionId !== 'string' || body.sessionId.length === 0) {
      return jsonResponse(400, { error: 'sessionId required' });
    }
    const attribution = (typeof body.attribution === 'string' ? body.attribution.trim() : '').slice(
      0,
      256
    );

    const { status, data: merchant } = await fetchMerchantSession(body.sessionId);
    if (status !== 200 || !merchant || typeof merchant !== 'object') {
      return jsonResponse(safeStatus(status), {
        error: 'merchant session not found',
        outcome: 'BLOCKED',
        reason: 'NO_SESSION',
      });
    }
    const m = merchant as MerchantProjection;
    const id = m.identification ?? {};
    const bd = id.browserDetails ?? {};

    let reason: BlockReason = checkTamperingThresholds(m);
    let duplicate: PriorMatch | null = null;

    // Incognito / private-browsing sessions get blocked regardless of
    // duplicate state. Rationale: private mode rotates IDB / cookies /
    // localStorage per session, which is functionally the same as a
    // bot operator clearing browser state between attempts — the
    // duplicate-detection signals can't see across the partition. The
    // bot-buster game says one purchase per device; we treat "device
    // hidden behind private mode" as not-a-purchase-eligible.
    if (!reason && m.incognito?.result === true) reason = 'INCOGNITO';

    const viewerIp = getViewerIp(event);
    const customNetworkId = computeCustomNetworkId(viewerIp, bd.userAgent ?? '');

    if (!reason) {
      const dup = await checkDuplicates(id, customNetworkId);
      reason = dup.reason;
      duplicate = dup.duplicate;
    }

    const outcome: Outcome = reason ? 'BLOCKED' : 'SUCCESS';

    await ddb.send(
      new PutItemCommand({
        TableName: BOT_BUSTER_TABLE_NAME,
        Item: marshall(
          buildEntryItem({
            sessionId: body.sessionId,
            attribution,
            outcome,
            reason,
            duplicateOf: duplicate?.session_id ?? null,
            customNetworkId,
            viewerIp,
            m,
          }),
          { removeUndefinedValues: true }
        ),
      })
    );

    return jsonResponse(200, {
      outcome,
      reason,
      duplicate_of: duplicate?.session_id ?? null,
      duplicate_at: duplicate?.created_at ?? null,
      merchant,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('leaderboard-entry failed', err instanceof Error ? err.message : String(err));
    return jsonResponse(502, { error: 'leaderboard-entry failed' });
  }
}

/** Small wrapper to deduplicate the response-shape boilerplate. */
function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
