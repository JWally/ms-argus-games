import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const CHALLENGE_COOKIE = 'argus_arcade_challenge';
const GRANT_COOKIE = 'argus_arcade_grant';
const CHALLENGE_TTL_SECONDS = 300;
const GRANT_TTL_SECONDS = 3600;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface GateClaims {
  kind: 'challenge' | 'grant';
  exp: number;
  challengeId?: string;
  returnPath?: string;
}

interface GateDependencies {
  secret: string;
  cpi: string;
  pairVerifyUrl: string;
  pairSsoExchangeUrl: string;
  merchantSsoReturnUrl: string;
  fetchImpl?: FetchLike;
  now?: () => number;
  randomChallenge?: () => string;
}

const response = (
  statusCode: number,
  body: Record<string, unknown>,
  cookies?: string[]
): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
  ...(cookies ? { cookies } : {}),
});

function mac(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function signClaims(secret: string, claims: GateClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${mac(secret, payload)}`;
}

function verifyClaims(secret: string, value: string | null, nowSeconds: number): GateClaims | null {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot < 1 || dot === value.length - 1) return null;
  const payload = value.slice(0, dot);
  const actual = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(mac(secret, payload));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GateClaims;
    if (
      (claims.kind !== 'challenge' && claims.kind !== 'grant') ||
      typeof claims.exp !== 'number' ||
      claims.exp < nowSeconds
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

function cookieValue(event: APIGatewayProxyEventV2, name: string): string | null {
  const values = event.cookies ?? (event.headers?.cookie ? event.headers.cookie.split(';') : []);
  for (const raw of values) {
    const [key, ...rest] = raw.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

function secureCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> | null {
  try {
    const body = JSON.parse(event.body || '{}');
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.includes('\\')) return '/';
  try {
    const parsed = new URL(value, 'https://arcades.invalid');
    return parsed.origin === 'https://arcades.invalid' ? `${parsed.pathname}${parsed.search}` : '/';
  } catch {
    return '/';
  }
}

const redirect = (location: string, cookies: string[]): APIGatewayProxyResultV2 => ({
  statusCode: 302,
  headers: { location, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  cookies,
  body: '',
});

async function handleSsoReturn(
  event: APIGatewayProxyEventV2,
  deps: GateDependencies,
  fetchImpl: FetchLike,
  nowSeconds: number
): Promise<APIGatewayProxyResultV2> {
  const query = event.queryStringParameters ?? {};
  const { session: sessionId, code, cpi, challengeId } = query;
  if (!sessionId || !code || !cpi || !challengeId) {
    return response(400, { error: 'sso_return_binding_required' });
  }
  const challenge = verifyClaims(deps.secret, cookieValue(event, CHALLENGE_COOKIE), nowSeconds);
  if (challenge?.kind !== 'challenge' || !challenge.challengeId) {
    return response(401, { error: 'challenge_missing_or_expired' });
  }
  if (challenge.challengeId !== challengeId || cpi !== deps.cpi) {
    return response(409, { error: 'challenge_mismatch' });
  }
  let pairResponse: Response;
  try {
    pairResponse = await fetchImpl(deps.pairSsoExchangeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, code, cpi: deps.cpi, challengeId }),
    });
  } catch {
    return response(502, { error: 'sso_exchange_unavailable' });
  }
  const verdict = (await pairResponse.json().catch(() => ({}))) as Record<string, unknown>;
  const exactContext = verdict.cpi === deps.cpi && verdict.challengeId === challengeId;
  if (!pairResponse.ok || verdict.valid !== true || verdict.passed !== true || !exactContext) {
    return response(403, { error: 'sso_exchange_rejected' });
  }
  const grant = signClaims(deps.secret, {
    kind: 'grant',
    exp: nowSeconds + GRANT_TTL_SECONDS,
  });
  return redirect(challenge.returnPath ?? '/', [
    secureCookie(GRANT_COOKIE, grant, GRANT_TTL_SECONDS),
    secureCookie(CHALLENGE_COOKIE, '', 0),
  ]);
}

export function createCaptchaGateHandler(deps: GateDependencies) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const randomChallenge = deps.randomChallenge ?? (() => randomBytes(24).toString('base64url'));

  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const route = `${event.requestContext.http.method} ${event.rawPath}`;
    const nowSeconds = Math.floor(now() / 1000);

    if (route === 'POST /api/captcha/challenge') {
      const body = parseBody(event);
      if (!body) return response(400, { error: 'invalid_body' });
      const challengeId = randomChallenge();
      const returnPath = safeReturnPath(body.returnPath);
      const value = signClaims(deps.secret, {
        kind: 'challenge',
        challengeId,
        returnPath,
        exp: nowSeconds + CHALLENGE_TTL_SECONDS,
      });
      return response(
        200,
        { challengeId, cpi: deps.cpi, ssoReturnUrl: deps.merchantSsoReturnUrl },
        [secureCookie(CHALLENGE_COOKIE, value, CHALLENGE_TTL_SECONDS)]
      );
    }

    if (route === 'GET /api/captcha/status') {
      const claims = verifyClaims(deps.secret, cookieValue(event, GRANT_COOKIE), nowSeconds);
      return claims?.kind === 'grant'
        ? response(200, { passed: true })
        : response(401, { passed: false });
    }

    if (route === 'GET /api/captcha/sso-return') {
      return handleSsoReturn(event, deps, fetchImpl, nowSeconds);
    }

    if (route !== 'POST /api/captcha/verify') {
      return response(400, { error: 'not_found' });
    }

    const body = parseBody(event);
    if (!body) return response(400, { error: 'invalid_body' });
    const challengeId = body.challengeId;
    const token = body.token;
    if (typeof challengeId !== 'string' || typeof token !== 'string') {
      return response(400, { error: 'token_and_challenge_required' });
    }
    const challenge = verifyClaims(deps.secret, cookieValue(event, CHALLENGE_COOKIE), nowSeconds);
    if (challenge?.kind !== 'challenge' || !challenge.challengeId) {
      return response(401, { error: 'challenge_missing_or_expired' });
    }
    if (challenge.challengeId !== challengeId) {
      return response(409, { error: 'challenge_mismatch' });
    }

    let pairResponse: Response;
    try {
      pairResponse = await fetchImpl(deps.pairVerifyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, cpi: deps.cpi, challengeId }),
      });
    } catch {
      return response(502, { error: 'captcha_verification_unavailable' });
    }
    const verdict = (await pairResponse.json().catch(() => ({}))) as Record<string, unknown>;
    const exactContext = verdict.cpi === deps.cpi && verdict.challengeId === challengeId;
    if (!pairResponse.ok || verdict.valid !== true || !exactContext) {
      return response(502, { error: 'captcha_verification_invalid' });
    }
    if (verdict.passed !== true) return response(422, { error: 'captcha_failed' });

    const grant = signClaims(deps.secret, {
      kind: 'grant',
      exp: nowSeconds + GRANT_TTL_SECONDS,
    });
    return response(200, { passed: true }, [
      secureCookie(GRANT_COOKIE, grant, GRANT_TTL_SECONDS),
      secureCookie(CHALLENGE_COOKIE, '', 0),
    ]);
  };
}

const secrets = new SecretsManagerClient({});
let cachedSecret: string | null = null;

async function gateSecret(): Promise<string | null> {
  if (cachedSecret) return cachedSecret;
  const arn = process.env.CAPTCHA_GATE_SECRET_ARN;
  if (!arn) return null;
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
  cachedSecret = result.SecretString ?? null;
  return cachedSecret;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const secret = await gateSecret();
  const cpi = process.env.CAPTCHA_CPI;
  const pairVerifyUrl = process.env.PAIR_VERIFY_URL;
  const pairSsoExchangeUrl = process.env.PAIR_SSO_EXCHANGE_URL;
  const merchantSsoReturnUrl = process.env.MERCHANT_SSO_RETURN_URL;
  if (!secret || !cpi || !pairVerifyUrl || !pairSsoExchangeUrl || !merchantSsoReturnUrl) {
    return response(503, { error: 'captcha_gate_unconfigured' });
  }
  return createCaptchaGateHandler({
    secret,
    cpi,
    pairVerifyUrl,
    pairSsoExchangeUrl,
    merchantSsoReturnUrl,
  })(event);
}
