import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const INTEGRITY_API_URL = process.env.INTEGRITY_API_URL!;
const INTEGRITY_API_KEY = process.env.INTEGRITY_API_KEY!;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

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

/**
 * POST /api/integrity/check
 * Body: { sessionId: string }
 *
 * Proxies to argus-api GET /v1/session/{sessionId} with the merchant API key.
 * Returns the integrity results to the frontend.
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

    const res = await fetch(`${INTEGRITY_API_URL}/v1/integrity-session/${body.sessionId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': INTEGRITY_API_KEY,
      },
    });

    const data = await res.json();
    return {
      statusCode: safeStatus(res.status),
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
