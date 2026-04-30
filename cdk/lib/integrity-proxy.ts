import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const MERCHANT_API_URL = process.env.MERCHANT_API_URL!;
const MERCHANT_API_CREDENTIAL = process.env.MERCHANT_API_CREDENTIAL!;
const MERCHANT_CPI = process.env.MERCHANT_CPI!;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

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

    const { keyId, token } = splitCredential(MERCHANT_API_CREDENTIAL);
    const url = `${MERCHANT_API_URL}/v1/session/${encodeURIComponent(MERCHANT_CPI)}/${encodeURIComponent(body.sessionId)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': keyId,
        'x-argus-token': token,
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
