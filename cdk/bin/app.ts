#!/usr/bin/env npx tsx
import { App, CliCredentialsStackSynthesizer } from 'aws-cdk-lib';
import { GamesStack } from '../lib/games-stack';

const app = new App();

const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID || '';

new GamesStack(app, 'ms-argus-games-dev-jw', {
  env: { account, region: 'us-east-1' },
  stackName: 'ms-argus-games-dev-jw',
  stage: 'dev-jw',
  rootDomain: 'wolcott.io',
  subdomain: 'games',
  synthesizer: new CliCredentialsStackSynthesizer(),
});

app.synth();
