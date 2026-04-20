import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const FPJS_SERVER_API_KEY = process.env.FPJS_SERVER_API_KEY!;
const FPJS_API_BASE = process.env.FPJS_API_BASE || 'https://api.fpjs.io';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (!(event as unknown as Record<string, unknown>).requestContext) {
    return { statusCode: 200, body: 'warm' };
  }

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const route = `${event.requestContext.http.method} ${event.rawPath}`;
  if (route === 'POST /api/fpjs/event') {
    return fetchEvent(event);
  }

  return {
    statusCode: 400,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify({ error: 'Not found' }),
  };
}

// CloudFront's SPA error responses intercept 403/404 globally — remap to 400
function safeStatus(status: number): number {
  return status === 403 || status === 404 ? 400 : status;
}

async function fetchEvent(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = JSON.parse(event.body || '{}');
    const id: unknown = body.eventId ?? body.event_id ?? body.requestId;
    if (typeof id !== 'string' || !id) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'eventId required' }),
      };
    }

    // fpjs events propagate asynchronously — the Server API can 404 for
    // up to ~1s after the client call resolves. Retry on 404 with short
    // backoff instead of pushing polling onto the browser.
    const delays = [0, 250, 500, 1000];
    let lastRes: globalThis.Response | null = null;
    let lastText = '';
    for (const d of delays) {
      if (d > 0) await new Promise((r) => globalThis.setTimeout(r, d));
      lastRes = await fetch(`${FPJS_API_BASE}/events/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: { 'Auth-API-Key': FPJS_SERVER_API_KEY },
      });
      lastText = await lastRes.text();
      if (lastRes.status !== 404) break;
    }

    return {
      statusCode: safeStatus(lastRes!.status),
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: lastText,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream failed', detail: String(e) }),
    };
  }
}
