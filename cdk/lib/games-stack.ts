import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BucketEncryption, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import {
  Distribution,
  ViewerProtocolPolicy,
  SecurityPolicyProtocol,
  HttpVersion,
  PriceClass,
  AllowedMethods,
  CachePolicy,
  CacheHeaderBehavior,
  CacheCookieBehavior,
  CacheQueryStringBehavior,
  OriginAccessIdentity,
  OriginRequestPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin, HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { PolicyStatement, CanonicalUserPrincipal } from 'aws-cdk-lib/aws-iam';
import { BucketDeployment, Source, CacheControl } from 'aws-cdk-lib/aws-s3-deployment';
import { HostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaRuntime from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventTargets from 'aws-cdk-lib/aws-events-targets';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface GamesStackProps extends cdk.StackProps {
  stage: string;
  rootDomain: string;
  subdomain?: string;
  /**
   * Merchant-facing REST API base URL (e.g. https://merchant-dev-jw.argus.pw).
   * Combined with merchantCpi to call GET /v1/session/{cpi}/{session_id}.
   */
  merchantApiUrl?: string;
  /**
   * Combined dual-key credential issued by ms-argus-platform — shape
   * `<keyId>.<base64-claims>.<base64-signature>`. Lambda splits at the
   * first dot before forwarding as x-api-key + x-argus-token.
   */
  merchantApiCredential?: string;
  /**
   * Public client id for this site (e.g. `argus_cpi_test_…`). Public-safe
   * — also baked into the Vite build so the browser SDK can forward it
   * on integrity-collect via the `x-argus-cpi` header.
   */
  merchantCpi?: string;
  fpjsServerApiKey?: string;
}

export class GamesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GamesStackProps) {
    super(scope, id, props);

    const {
      stage,
      rootDomain,
      subdomain,
      merchantApiUrl,
      merchantApiCredential,
      merchantCpi,
      fpjsServerApiKey,
    } = props;
    const domainName = subdomain ? `${subdomain}.${rootDomain}` : rootDomain;

    // ── S3 bucket ────────────────────────────────────────────────────────
    const bucket = new Bucket(this, 'SiteBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const oai = new OriginAccessIdentity(this, 'SiteOAI');
    bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [bucket.arnForObjects('*')],
        principals: [
          new CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId),
        ],
      })
    );

    // ── DNS & Certificate ────────────────────────────────────────────────
    const zone = HostedZone.fromLookup(this, 'HostedZone', { domainName: rootDomain });

    const certificate = new Certificate(this, 'SiteCertificate', {
      domainName,
      validation: CertificateValidation.fromDns(zone),
    });

    // ── Integrity Proxy Lambda ─────────────────────────────────────────
    // ── Bot-Buster entries table ──────────────────────────────────────────
    // Stores every /bot-buster submission, keyed by (cpi, created_at).
    // GSIs let the leaderboard-entry Lambda do O(1) duplicate lookups on
    // each of the four identity columns. See cdk/lib/integrity-proxy.ts
    // and src/utils/classifyScan.ts for the rules.
    const botBusterTable = new ddb.Table(this, 'BotBusterEntries', {
      tableName: `${props.stackName ?? id}-bot-buster-entries`,
      partitionKey: { name: 'cpi', type: ddb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: ddb.AttributeType.NUMBER },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    // Cryptographic-grade identifiers — match against any prior SUCCESS forever.
    botBusterTable.addGlobalSecondaryIndex({
      indexName: 'crypto-index',
      partitionKey: { name: 'crypto_device_id', type: ddb.AttributeType.STRING },
      projectionType: ddb.ProjectionType.ALL,
    });
    botBusterTable.addGlobalSecondaryIndex({
      indexName: 'tpc-index',
      partitionKey: { name: 'tpc_id', type: ddb.AttributeType.STRING },
      projectionType: ddb.ProjectionType.ALL,
    });
    botBusterTable.addGlobalSecondaryIndex({
      indexName: 'uuid-index',
      partitionKey: { name: 'client_uuid', type: ddb.AttributeType.STRING },
      projectionType: ddb.ProjectionType.ALL,
    });
    // Custom network_id (sha256 of viewer_ip + server-parsed UA). Composite
    // key so the duplicate-check query can range-filter on created_at to
    // implement the 1hr rolling window without DDB TTL race conditions.
    botBusterTable.addGlobalSecondaryIndex({
      indexName: 'network-index',
      partitionKey: { name: 'custom_network_id', type: ddb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: ddb.AttributeType.NUMBER },
      projectionType: ddb.ProjectionType.ALL,
    });
    // Attribution index for the public leaderboard view (top successful
    // entries per handle). Range on created_at for "most recent first".
    botBusterTable.addGlobalSecondaryIndex({
      indexName: 'attribution-index',
      partitionKey: { name: 'attribution', type: ddb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: ddb.AttributeType.NUMBER },
      projectionType: ddb.ProjectionType.ALL,
    });

    let integrityFn: lambda.NodejsFunction | undefined;
    if (merchantApiUrl && merchantApiCredential && merchantCpi) {
      integrityFn = new lambda.NodejsFunction(this, 'IntegrityProxy', {
        entry: path.join(__dirname, 'integrity-proxy.ts'),
        handler: 'handler',
        runtime: lambdaRuntime.Runtime.NODEJS_22_X,
        architecture: lambdaRuntime.Architecture.ARM_64,
        memorySize: 512,
        timeout: cdk.Duration.seconds(10),
        environment: {
          MERCHANT_API_URL: merchantApiUrl,
          MERCHANT_API_CREDENTIAL: merchantApiCredential,
          MERCHANT_CPI: merchantCpi,
          BOT_BUSTER_TABLE_NAME: botBusterTable.tableName,
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        bundling: { minify: true, sourceMap: false, target: 'node22' },
      });
      botBusterTable.grantReadWriteData(integrityFn);

      new events.Rule(this, 'IntegrityWarmerRule', {
        schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
        targets: [new eventTargets.LambdaFunction(integrityFn)],
      });
    }

    // ── FPJS Proxy Lambda ─────────────────────────────────────────────
    let fpjsFn: lambda.NodejsFunction | undefined;
    if (fpjsServerApiKey) {
      fpjsFn = new lambda.NodejsFunction(this, 'FpjsProxy', {
        entry: path.join(__dirname, 'fpjs-proxy.ts'),
        handler: 'handler',
        runtime: lambdaRuntime.Runtime.NODEJS_22_X,
        architecture: lambdaRuntime.Architecture.ARM_64,
        memorySize: 512,
        timeout: cdk.Duration.seconds(10),
        environment: {
          FPJS_SERVER_API_KEY: fpjsServerApiKey,
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        bundling: { minify: true, sourceMap: false, target: 'node22' },
      });
    }

    // ── API Gateway ──────────────────────────────────────────────────────
    const api = new apigatewayv2.HttpApi(this, 'Api', {
      corsPreflight: {
        allowOrigins: [`https://${domainName}`],
        allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST],
        allowHeaders: ['content-type', 'authorization'],
      },
    });
    const apiAccessLogs = new logs.LogGroup(this, 'GamesApiAccessLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const apiStage = api.defaultStage?.node.defaultChild as apigatewayv2.CfnStage | undefined;
    if (!apiStage) throw new Error('Games HTTP API default stage was not created');
    apiStage.accessLogSettings = {
      destinationArn: apiAccessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        routeKey: '$context.routeKey',
        status: '$context.status',
        integrationStatus: '$context.integrationStatus',
        integrationError: '$context.integrationErrorMessage',
        responseLength: '$context.responseLength',
      }),
    };

    // ── Arcade captcha gate ─────────────────────────────────────────────
    // A server-issued challenge is verified against Pair, then exchanged for
    // a signed HttpOnly one-hour arcade grant. The cookie is stateless: no
    // session table or redemption database sits on the game-entry path.
    if (merchantCpi) {
      const captchaCpi = /\.(?:fastpass|stepup|forceauth)$/.test(merchantCpi)
        ? merchantCpi
        : `${merchantCpi}.fastpass`;
      const gateSecret = new secretsmanager.Secret(this, 'CaptchaGateSecret', {
        description: 'HMAC key for short-lived Argus Arcade access grants',
        generateSecretString: { passwordLength: 64, excludePunctuation: true },
      });
      const gateFn = new lambda.NodejsFunction(this, 'CaptchaGate', {
        entry: path.join(__dirname, 'captcha-gate.ts'),
        handler: 'handler',
        runtime: lambdaRuntime.Runtime.NODEJS_22_X,
        architecture: lambdaRuntime.Architecture.ARM_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          CAPTCHA_GATE_SECRET_ARN: gateSecret.secretArn,
          CAPTCHA_CPI: captchaCpi,
          PAIR_VERIFY_URL: 'https://captcha-dev-jw.argus.pw/api/verify',
          PAIR_SSO_EXCHANGE_URL: 'https://captcha-dev-jw.argus.pw/api/sso/approval/exchange',
          MERCHANT_SSO_RETURN_URL: `https://${domainName}/api/captcha/sso-return`,
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        bundling: { minify: true, sourceMap: false, target: 'node22' },
      });
      gateSecret.grantRead(gateFn);
      const gateIntegration = new integrations.HttpLambdaIntegration(
        'CaptchaGateIntegration',
        gateFn
      );
      api.addRoutes({
        path: '/api/captcha/challenge',
        methods: [apigatewayv2.HttpMethod.POST],
        integration: gateIntegration,
      });
      api.addRoutes({
        path: '/api/captcha/verify',
        methods: [apigatewayv2.HttpMethod.POST],
        integration: gateIntegration,
      });
      api.addRoutes({
        path: '/api/captcha/status',
        methods: [apigatewayv2.HttpMethod.GET],
        integration: gateIntegration,
      });
      api.addRoutes({
        path: '/api/captcha/sso-return',
        methods: [apigatewayv2.HttpMethod.GET],
        integration: gateIntegration,
      });
    }

    // Integrity proxy route
    if (integrityFn) {
      const integrityIntegration = new integrations.HttpLambdaIntegration(
        'IntegrityIntegration',
        integrityFn
      );
      api.addRoutes({
        path: '/api/integrity/check',
        methods: [apigatewayv2.HttpMethod.POST],
        integration: integrityIntegration,
      });
      // Same handler also serves /api/leaderboard-entry — logs the
      // (session, attribution) pair to CloudWatch for the bot-buster
      // bounty leaderboard. See integrity-proxy.ts:leaderboardEntry.
      api.addRoutes({
        path: '/api/leaderboard-entry',
        methods: [apigatewayv2.HttpMethod.POST],
        integration: integrityIntegration,
      });
    }

    if (fpjsFn) {
      const fpjsIntegration = new integrations.HttpLambdaIntegration('FpjsIntegration', fpjsFn);
      api.addRoutes({
        path: '/api/fpjs/event',
        methods: [apigatewayv2.HttpMethod.POST],
        integration: fpjsIntegration,
      });
    }

    // ── Cache policies ───────────────────────────────────────────────────
    const staticCachePolicy = new CachePolicy(this, 'StaticAssetsCachePolicy', {
      cachePolicyName: `${stage}-games-static-assets`,
      defaultTtl: cdk.Duration.days(30),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
      headerBehavior: CacheHeaderBehavior.none(),
      cookieBehavior: CacheCookieBehavior.none(),
      queryStringBehavior: CacheQueryStringBehavior.none(),
    });

    const htmlCachePolicy = new CachePolicy(this, 'HtmlCachePolicy', {
      cachePolicyName: `${stage}-games-html-no-cache`,
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(86400),
      minTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
      headerBehavior: CacheHeaderBehavior.none(),
      cookieBehavior: CacheCookieBehavior.none(),
      queryStringBehavior: CacheQueryStringBehavior.none(),
    });

    // ── WAF ──────────────────────────────────────────────────────────────
    // CLOUDFRONT-scoped WAF (must live in us-east-1, which this stack is).
    // Rate-based rule scoped to /api/leaderboard-entry — 60 requests per IP
    // per 5-minute sliding window. Anything above that is treated as bot
    // abuse and 403'd at the CF edge before reaching the Lambda.
    //
    // Also: AWS managed KnownBadInputs ruleset, free and catches generic
    // injection probes (Log4Shell, SQL injection probes, etc.).
    const webAcl = new wafv2.CfnWebACL(this, 'BotBusterWebAcl', {
      defaultAction: { allow: {} },
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'BotBusterWebAcl',
        sampledRequestsEnabled: true,
      },
      rules: [
        // 1. Rate-limit per IP on the submit endpoint only.
        {
          name: 'LeaderboardEntryRateLimit',
          priority: 0,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 60, // 60 requests per IP per 5-min sliding window
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: { uriPath: {} },
                  positionalConstraint: 'STARTS_WITH',
                  searchString: '/api/leaderboard-entry',
                  textTransformations: [{ priority: 0, type: 'NONE' }],
                },
              },
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'LeaderboardEntryRateLimit',
            sampledRequestsEnabled: true,
          },
        },
        // 2. AWS Managed: KnownBadInputs.
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputs',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // ── CloudFront ───────────────────────────────────────────────────────
    const s3Origin = new S3Origin(bucket, { originAccessIdentity: oai });
    const apiOrigin = new HttpOrigin(`${api.apiId}.execute-api.${this.region}.amazonaws.com`);

    const distribution = new Distribution(this, 'SiteDistribution', {
      webAclId: webAcl.attrArn,
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: htmlCachePolicy,
      },
      additionalBehaviors: {
        // API proxy — no caching, forward all
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        // Static assets — long cache
        ...Object.fromEntries(
          ['*.js', '*.css', '*.woff*', '*.png', '*.jpg', '*.svg'].map((pattern) => [
            pattern,
            {
              origin: s3Origin,
              cachePolicy: staticCachePolicy,
              viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
          ])
        ),
      },
      domainNames: [domainName],
      certificate,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: HttpVersion.HTTP2,
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    // ── DNS ──────────────────────────────────────────────────────────────
    new ARecord(this, 'AliasRecord', {
      zone,
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    // ── Deploy site ──────────────────────────────────────────────────────
    const distPath = path.join(__dirname, '../../dist');
    new BucketDeployment(this, 'DeploySite', {
      sources: [Source.asset(distPath)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
      memoryLimit: 2096,
      cacheControl: [CacheControl.fromString('public, max-age=0, must-revalidate')],
    });

    // ── Outputs ──────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'SiteURL', {
      value: `https://${domainName}`,
      description: 'Argus Arcade URL',
    });
  }
}
