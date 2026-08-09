import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('every game advertised by the lobby is directly routable without the captcha gate', async () => {
  const [app, hub] = await Promise.all([read('src/App.tsx'), read('src/pages/Hub.tsx')]);
  const gamePaths = [...hub.matchAll(/path: '(\/[^']+)'/g)].map((match) => match[1]);
  assert.ok(gamePaths.length > 0);
  for (const path of gamePaths) assert.match(app, new RegExp(`path="${path}"`));
  assert.doesNotMatch(app, /CaptchaGate/);
  assert.doesNotMatch(app, /GAME_ROUTES/);
});

test('Proxy or Not owns its lean scan and skips the full integrity collector', async () => {
  const [app, page] = await Promise.all([read('src/App.tsx'), read('src/pages/ProxyOrNot.tsx')]);
  assert.match(app, /SELF_SCANNED_ROUTES[^;]*'\/proxy-or-not'/s);
  assert.match(app, /path="\/proxy-or-not" element={<ProxyOrNot \/>}/);
  const gatedRoutes = app.match(/const GAME_ROUTES = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
  assert.doesNotMatch(gatedRoutes, /'\/proxy-or-not'/);
  assert.match(page, /commonly associated with proxy traffic/);
  assert.match(page, /not proof of VPN use/);
  assert.doesNotMatch(page, /looks like a proxy, VPN/);
  assert.match(page, /if \(hasRun\) \{\s*window\.location\.reload\(\)/s);
  assert.match(page, /hasRun \? 'RE-TEST' : 'TEST'/);
});

test('Bot Buster stays directly routable but is hidden from public game discovery', async () => {
  const [app, hub, catalog, notFound] = await Promise.all([
    read('src/App.tsx'),
    read('src/pages/Hub.tsx'),
    read('src/games/catalog.ts'),
    read('src/pages/NotFound.tsx'),
  ]);
  assert.match(app, /path="\/bot-buster" element={<Scan \/>}/);
  assert.doesNotMatch(hub, /bot-buster|BOT-BUSTER/);
  assert.doesNotMatch(catalog, /bot-buster|BOT-BUSTER/);
  assert.doesNotMatch(notFound, /bot-buster|RUN DIAGNOSTIC/);
});

test('the dormant captcha API retains its server-bound challenge contract', async () => {
  const stack = await read('cdk/lib/games-stack.ts');
  for (const route of ['challenge', 'verify', 'status']) {
    assert.match(stack, new RegExp(`/api/captcha/${route}`));
  }
  assert.match(stack, /\/api\/captcha\/sso-return/);
  assert.match(stack, /PAIR_SSO_EXCHANGE_URL/);
  assert.match(stack, /CAPTCHA_CPI: captchaCpi/);
  assert.match(stack, /GamesApiAccessLogs/);
  assert.match(stack, /accessLogSettings/);
  assert.match(stack, /\$context\.requestId/);
  assert.match(stack, /\$context\.integrationErrorMessage/);
});
