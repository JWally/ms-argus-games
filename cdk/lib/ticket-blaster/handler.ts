import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createSession } from './session';
import { handlePurchase } from './purchase';
import { handleSignout } from './signout';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
};

function json(result: { statusCode: number; body: string }): APIGatewayProxyResultV2 {
  return {
    statusCode: result.statusCode,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    body: result.body,
  };
}

function getClientIp(event: APIGatewayProxyEventV2): string {
  return event.requestContext.http.sourceIp || '0.0.0.0';
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
  const ip = getClientIp(event);

  switch (route) {
    case 'POST /api/ticket-blaster/session':
      return json(await createSession(ip));

    case 'POST /api/ticket-blaster/purchase':
      return json(await handlePurchase(event.headers.authorization, event.body, ip));

    case 'POST /api/ticket-blaster/signout':
      return json(await handleSignout(event.headers.authorization));

    default:
      return json({ statusCode: 404, body: JSON.stringify({ error: 'Not found' }) });
  }
}
