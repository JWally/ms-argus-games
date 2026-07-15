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
  assert.match(component, />\s*▶ CHECK WITH YOUR PHONE\s*</);
  assert.match(component, /max-w-md flex-1 flex-col items-center/);
  assert.match(component, /'hidden min-h-\[445px\] w-full justify-center sm:flex'/);
  assert.doesNotMatch(component, /render\(slot, \{[\s\S]*ssoReturnUrl: challenge\.ssoReturnUrl/);
  assert.match(component, /returnPath: window\.location/);
  assert.match(component, /argus-check/);
  assert.match(component, /phase === 'denied'/);
  assert.match(component, />\s*SESSION NOT APPROVED\s*</);
  assert.match(component, /https:\/\/qr\.arcades\.click/);
  for (const route of ['challenge', 'verify', 'status']) {
    assert.match(stack, new RegExp(`/api/captcha/${route}`));
  }
  assert.match(stack, /\/api\/captcha\/sso-return/);
  assert.match(stack, /PAIR_SSO_EXCHANGE_URL/);
  assert.match(stack, /CAPTCHA_CPI: captchaCpi/);
});

test('the QR widget starts only after a desktop viewport and keeps a stable desktop footprint', async () => {
  const component = await read('src/components/CaptchaGate.tsx');

  assert.match(component, /const DESKTOP_MEDIA_QUERY = '\(min-width: 640px\)'/);
  assert.match(component, /function onFirstDesktop/);
  assert.match(component, /let captchaPromise: Promise<CaptchaApi> \| null = null/);
  assert.match(component, /sm:min-h-\[487px\]/);
  assert.match(component, /sm:h-\[445px\]/);
  assert.match(component, /setQrMounted\(true\)/);
  assert.match(component, /const onChange = \(\) => \{\s*if \(!media\.matches\) return;/);
});
