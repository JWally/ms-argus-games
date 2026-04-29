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

interface GamesStackProps extends cdk.StackProps {
  stage: string;
  rootDomain: string;
  subdomain?: string;
  bioApiUrl: string;
  bioApiSecret: string;
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
      bioApiUrl,
      bioApiSecret,
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

    // ── API Proxy Lambda ─────────────────────────────────────────────────
    const proxyFn = new lambda.NodejsFunction(this, 'ApiProxy', {
      entry: path.join(__dirname, 'api-proxy.ts'),
      handler: 'handler',
      runtime: lambdaRuntime.Runtime.NODEJS_22_X,
      architecture: lambdaRuntime.Architecture.ARM_64,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      environment: {
        BIO_API_URL: bioApiUrl,
        BIO_API_SECRET: bioApiSecret,
        RETURN_URL: `https://${domainName}`,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: { minify: true, sourceMap: false, target: 'node22' },
    });

    // Warmer — keep Lambda warm
    new events.Rule(this, 'WarmerRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new eventTargets.LambdaFunction(proxyFn)],
    });

    // ── Integrity Proxy Lambda ─────────────────────────────────────────
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
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        bundling: { minify: true, sourceMap: false, target: 'node22' },
      });

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

    const lambdaIntegration = new integrations.HttpLambdaIntegration('ProxyIntegration', proxyFn);

    api.addRoutes({
      path: '/api/session',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    api.addRoutes({
      path: '/api/verify',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

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

    // ── CloudFront ───────────────────────────────────────────────────────
    const s3Origin = new S3Origin(bucket, { originAccessIdentity: oai });
    const apiOrigin = new HttpOrigin(`${api.apiId}.execute-api.${this.region}.amazonaws.com`);

    const distribution = new Distribution(this, 'SiteDistribution', {
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
