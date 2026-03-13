#!/usr/bin/env npx tsx
import { App, CliCredentialsStackSynthesizer } from 'aws-cdk-lib';
import { GamesStack } from '../lib/games-stack';
import { RedirectStack } from '../lib/redirect-stack';

const app = new App();

const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID || '';
const bioApiSecret = app.node.tryGetContext('bioApiSecret') as string;
const tbJwtSecret = app.node.tryGetContext('tbJwtSecret') as string;

if (!bioApiSecret) {
  throw new Error(
    'Missing bioApiSecret context. Deploy with: npx cdk deploy -c bioApiSecret=ak_live_...'
  );
}

if (!tbJwtSecret) {
  throw new Error(
    'Missing tbJwtSecret context. Deploy with: npx cdk deploy -c tbJwtSecret=<64-char-hex>'
  );
}

new GamesStack(app, 'ms-argus-games-dev-jw', {
  env: { account, region: 'us-east-1' },
  stackName: 'ms-argus-games-dev-jw',
  stage: 'dev-jw',
  rootDomain: 'arcades.click',
  bioApiUrl: 'https://api-bio-dev-jw.argus.pw',
  bioApiSecret,
  tbJwtSecret,
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
