import assert from 'node:assert/strict';
import test from 'node:test';
import { createCaptchaGateHandler } from '../cdk/lib/captcha-gate';

const SECRET = 'arcade-gate-test-secret';
const CPI = 'argus_cpi_test_Example12345.fastpass';
const CHALLENGE_ID = 'challenge_1234567890abcdef';
const NOW = 1_800_000_000_000;

type GateEvent = Parameters<ReturnType<typeof createCaptchaGateHandler>>[0];

function event(method: string, path: string, body?: unknown, cookies?: string[]): GateEvent {
  return {
    requestContext: { http: { method } },
    rawPath: path,
    body: body === undefined ? undefined : JSON.stringify(body),
    cookies,
  } as GateEvent;
}

function bodyOf(response: Awaited<ReturnType<ReturnType<typeof createCaptchaGateHandler>>>) {
  return JSON.parse(String(response.body)) as Record<string, unknown>;
}

function challengeCookie(response: { cookies?: string[] }): string {
  const cookie = response.cookies?.find((value) => value.startsWith('argus_arcade_challenge='));
  assert.ok(cookie);
  return cookie.split(';', 1)[0];
}

function setup(pairPassed = true) {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        valid: true,
        passed: pairPassed,
        cpi: CPI,
        challengeId: CHALLENGE_ID,
        verdict: pairPassed ? 'paired' : 'failed',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  return createCaptchaGateHandler({
    secret: SECRET,
    cpi: CPI,
    pairVerifyUrl: 'https://captcha.example/api/verify',
    fetchImpl,
    now: () => NOW,
    randomChallenge: () => CHALLENGE_ID,
  });
}

test('issues a server-bound challenge in an HttpOnly cookie', async () => {
  const response = await setup()(event('POST', '/api/captcha/challenge'));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(bodyOf(response), { challengeId: CHALLENGE_ID, cpi: CPI });
  assert.match(challengeCookie(response), /^argus_arcade_challenge=/);
  assert.match(response.cookies?.[0] ?? '', /HttpOnly; Secure; SameSite=Lax/);
});

test('rejects verification without the server-issued challenge cookie', async () => {
  const response = await setup()(
    event('POST', '/api/captcha/verify', { challengeId: CHALLENGE_ID, token: 'signed-token' })
  );
  assert.equal(response.statusCode, 401);
  assert.deepEqual(bodyOf(response), { error: 'challenge_missing_or_expired' });
});

test('rejects a challenge substitution before calling Pair', async () => {
  const handler = setup();
  const issued = await handler(event('POST', '/api/captcha/challenge'));
  const response = await handler(
    event(
      'POST',
      '/api/captcha/verify',
      { challengeId: 'challenge_fedcba0987654321', token: 'signed-token' },
      [challengeCookie(issued)]
    )
  );
  assert.equal(response.statusCode, 409);
  assert.deepEqual(bodyOf(response), { error: 'challenge_mismatch' });
});

test('issues an HttpOnly arcade grant only after an exact passed Pair verdict', async () => {
  const handler = setup();
  const issued = await handler(event('POST', '/api/captcha/challenge'));
  const response = await handler(
    event('POST', '/api/captcha/verify', { challengeId: CHALLENGE_ID, token: 'signed-token' }, [
      challengeCookie(issued),
    ])
  );
  assert.equal(response.statusCode, 200);
  assert.deepEqual(bodyOf(response), { passed: true });
  assert.match(response.cookies?.join('\n') ?? '', /argus_arcade_grant=.*HttpOnly/);
});

test('does not grant access for an authentic failed verdict', async () => {
  const handler = setup(false);
  const issued = await handler(event('POST', '/api/captcha/challenge'));
  const response = await handler(
    event('POST', '/api/captcha/verify', { challengeId: CHALLENGE_ID, token: 'signed-token' }, [
      challengeCookie(issued),
    ])
  );
  assert.equal(response.statusCode, 422);
  assert.deepEqual(bodyOf(response), { error: 'captcha_failed' });
  assert.doesNotMatch(response.cookies?.join('\n') ?? '', /argus_arcade_grant=/);
});

test('status accepts the signed grant and rejects an absent grant', async () => {
  const handler = setup();
  const issued = await handler(event('POST', '/api/captcha/challenge'));
  const verified = await handler(
    event('POST', '/api/captcha/verify', { challengeId: CHALLENGE_ID, token: 'signed-token' }, [
      challengeCookie(issued),
    ])
  );
  const grant = verified.cookies?.find((value) => value.startsWith('argus_arcade_grant='));
  assert.ok(grant);
  const accepted = await handler(
    event('GET', '/api/captcha/status', undefined, [grant.split(';', 1)[0]])
  );
  assert.equal(accepted.statusCode, 200);
  assert.deepEqual(bodyOf(accepted), { passed: true });

  const rejected = await handler(event('GET', '/api/captcha/status'));
  assert.equal(rejected.statusCode, 401);
});
