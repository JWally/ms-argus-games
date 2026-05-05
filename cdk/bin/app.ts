#!/usr/bin/env npx tsx
import { App, CliCredentialsStackSynthesizer } from 'aws-cdk-lib';
import { GamesStack } from '../lib/games-stack';
import { RedirectStack } from '../lib/redirect-stack';

const app = new App();

const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID || '';
const merchantApiUrl = app.node.tryGetContext('merchantApiUrl') as string | undefined;
const merchantApiCredential = app.node.tryGetContext('merchantApiCredential') as string | undefined;
const merchantCpi = app.node.tryGetContext('merchantCpi') as string | undefined;
const fpjsServerApiKey = app.node.tryGetContext('fpjsServerApiKey') as string | undefined;

const merchantConfigured = !!(merchantApiUrl && merchantApiCredential && merchantCpi);
const merchantPartial =
  !merchantConfigured && !!(merchantApiUrl || merchantApiCredential || merchantCpi);
if (merchantPartial) {
  throw new Error(
    'merchantApiUrl, merchantApiCredential, and merchantCpi must all be provided ' +
      'or all omitted. Deploy with: -c merchantApiUrl=https://merchant-…argus.pw ' +
      '-c merchantApiCredential=argus_sk_…<credential> -c merchantCpi=argus_cpi_…'
  );
}

new GamesStack(app, 'ms-argus-games-dev-jw', {
  env: { account, region: 'us-east-1' },
  stackName: 'ms-argus-games-dev-jw',
  stage: 'dev-jw',
  rootDomain: 'arcades.click',
  merchantApiUrl,
  merchantApiCredential,
  merchantCpi,
  fpjsServerApiKey,
  synthesizer: new CliCredentialsStackSynthesizer(),
});

new RedirectStack(app, 'ms-argus-games-redirect', {
  env: { account, region: 'us-east-1' },
  stackName: 'ms-argus-games-redirect',
  fromDomain: 'games.wolcott.io',
  fromRootDomain: 'wolcott.io',
  targetUrl: 'https://arcades.click',
  synthesizer: new CliCredentialsStackSynthesizer(),
});

app.synth();
