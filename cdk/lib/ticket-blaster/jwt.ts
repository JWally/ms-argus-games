/* global Buffer */
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.TB_JWT_SECRET!;

interface JwtPayload {
  sub: string; // sessionId
  iat: number;
  exp: number;
}

function base64url(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return buf.toString('base64url');
}

function sign(payload: JwtPayload): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', SECRET).update(`${header}.${body}`).digest();
  return `${header}.${body}.${base64url(signature)}`;
}

function verify(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;
  const expected = createHmac('sha256', SECRET).update(`${header}.${body}`).digest();

  let actual: Buffer;
  try {
    actual = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }

  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload;
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createJwt(sessionId: string, ttlSeconds = 300): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: sessionId, iat: now, exp: now + ttlSeconds });
}

export function verifyJwt(token: string): { sessionId: string } | null {
  const payload = verify(token);
  if (!payload) return null;
  return { sessionId: payload.sub };
}
