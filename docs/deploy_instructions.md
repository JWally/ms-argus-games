# Deploy Instructions — ms-argus-games

Arcade site deployed to **https://arcades.click** plus a redirect from **https://games.wolcott.io**.

## Prerequisites

- Node 22.x (the project uses Vite 6; any Node ≥ 20.19 works, but 22 is the verified version)
- AWS credentials loaded in the shell — run `aws sts get-caller-identity` and confirm account `263318538229`, region `us-east-1`
- Bash available (the `deploy` script uses `source`, which does not exist in `sh`)
- `.env` at the repo root with the three required secrets:

  ```
  BIO_API_SECRET=<bio api shared secret>
  INTEGRITY_API_URL=https://api-dev-jw.argus.pw
  INTEGRITY_API_KEY=<integrity api key>
  ```

  The values can be pulled from AWS Secrets Manager (`argus/dev-jw/bio-api-secret`, etc.) or from your team's password manager. `.env` is gitignored — never commit it.

## Deploy

Standard deploy:

```bash
npm run deploy
```

This runs `npm run build && source .env && npx cdk deploy --all -c bioApiSecret=$BIO_API_SECRET -c integrityApiUrl=$INTEGRITY_API_URL -c integrityApiKey=$INTEGRITY_API_KEY --require-approval never`.

If your default shell is `sh` (not bash) — for example inside some CI runners — `source .env` errors with `source: not found`. Fall back to:

```bash
bash -c 'source .env && npm run deploy'
```

…or invoke the underlying commands manually:

```bash
npm run build
set -a; source .env; set +a
npx cdk deploy --all \
  -c bioApiSecret="$BIO_API_SECRET" \
  -c integrityApiUrl="$INTEGRITY_API_URL" \
  -c integrityApiKey="$INTEGRITY_API_KEY" \
  --require-approval never
```

## What gets deployed

Two CDK stacks — both must deploy (that's why `--all` is required):

| Stack                     | Purpose                                                                                | Output                              |
| ------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------- |
| `ms-argus-games-dev-jw`   | CloudFront + S3 bucket with the built `dist/` assets, Lambda@Edge for `/api/*` proxies | `SiteURL = https://arcades.click`   |
| `ms-argus-games-redirect` | Redirects `games.wolcott.io` → `arcades.click`                                         | `RedirectFrom`/`RedirectTo` outputs |

Typical timing: **~65 seconds** for the main stack, redirect stack usually has no changes.

After deploy, CloudFront cache usually propagates within ~60 seconds. If you hit stale content, hard-refresh (Ctrl/Cmd-Shift-R) or append `?v=<timestamp>` to bust the URL cache.

## Pre-deploy hooks

`lefthook` runs automatically on `git push`:

- `build` — full prod build must succeed before push
- `duplication` — jscpd
- `dead-code` — knip

On commit:

- `format` (prettier), `lint` (eslint), `typecheck` (tsc)

If a push is rejected, the failing hook's output tells you what broke. **Never** use `--no-verify` to bypass — fix the underlying issue.

## Smoke test after deploy

- https://arcades.click — hub should render 20 tiles (19 games + SCAN)
- Filter by `DIA` — SCAN tile should appear
- https://arcades.click/scan — runs the integrity diagnostic without CAPTCHA
- https://games.wolcott.io — should 301 → https://arcades.click

## Troubleshooting

**`source: not found`** — shell isn't bash. Use the `bash -c` wrapper shown above.

**CDK bootstrap errors** — run `npx cdk bootstrap aws://263318538229/us-east-1` once per account/region (only needed on first deploy to a fresh account).

**CloudFront 403 / stale JS** — cache invalidation can take up to ~60 seconds after deploy. The deploy script invalidates via the `DeploySite` construct; verify in AWS Console → CloudFront → Invalidations.

**Redirect stack unchanged** — normal. `ms-argus-games-redirect` rarely changes; only the main stack picks up new code on each deploy.
