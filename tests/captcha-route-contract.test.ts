import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('every game advertised by the lobby is behind the shared captcha gate', async () => {
  const [app, hub] = await Promise.all([read('src/App.tsx'), read('src/pages/Hub.tsx')]);
  const gamePaths = [...hub.matchAll(/path: '(\/[^']+)'/g)].map((match) => match[1]);
  assert.ok(gamePaths.length > 0);
  for (const path of gamePaths) assert.match(app, new RegExp(`'${path}'`));
  assert.match(app, /GAME_ROUTES\.has\(pathname\).*<CaptchaGate>/s);
});

test('the browser and CDK contracts carry the same server-bound challenge', async () => {
  const [component, stack] = await Promise.all([
    read('src/components/CaptchaGate.tsx'),
    read('cdk/lib/games-stack.ts'),
  ]);
  assert.match(component, /challengeId: challenge\.challengeId/);
  assert.match(component, /startMobileSso/);
  assert.match(component, /returnUrl: challenge\.ssoReturnUrl/);
  assert.match(component, />\s*MOBILE SSO\s*</);
  assert.match(component, /max-w-md flex-col items-center/);
  assert.match(component, /'flex w-full justify-center'/);
  assert.doesNotMatch(component, /render\(slot, \{[\s\S]*ssoReturnUrl: challenge\.ssoReturnUrl/);
  assert.match(component, /returnPath: window\.location/);
  assert.match(component, /https:\/\/qr\.arcades\.click/);
  for (const route of ['challenge', 'verify', 'status']) {
    assert.match(stack, new RegExp(`/api/captcha/${route}`));
  }
  assert.match(stack, /\/api\/captcha\/sso-return/);
  assert.match(stack, /PAIR_SSO_EXCHANGE_URL/);
  assert.match(stack, /CAPTCHA_CPI: captchaCpi/);
});
