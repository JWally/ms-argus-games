import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Distribution,
  ViewerProtocolPolicy,
  SecurityPolicyProtocol,
  HttpVersion,
  PriceClass,
  Function as CfFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Bucket, BlockPublicAccess, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { HostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';

interface RedirectStackProps extends cdk.StackProps {
  fromDomain: string;
  fromRootDomain: string;
  targetUrl: string;
}

export class RedirectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RedirectStackProps) {
    super(scope, id, props);

    const { fromDomain, fromRootDomain, targetUrl } = props;

    // Dummy origin — CloudFront requires one but the function intercepts all requests
    const bucket = new Bucket(this, 'DummyBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const zone = HostedZone.fromLookup(this, 'HostedZone', { domainName: fromRootDomain });

    const certificate = new Certificate(this, 'Certificate', {
      domainName: fromDomain,
      validation: CertificateValidation.fromDns(zone),
    });

    const redirectFn = new CfFunction(this, 'RedirectFunction', {
      code: FunctionCode.fromInline(
        `
function handler(event) {
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: '${targetUrl}' + event.request.uri },
    },
  };
}
      `.trim()
      ),
      runtime: FunctionRuntime.JS_2_0,
    });

    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          { function: redirectFn, eventType: FunctionEventType.VIEWER_REQUEST },
        ],
      },
      domainNames: [fromDomain],
      certificate,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: HttpVersion.HTTP2,
      priceClass: PriceClass.PRICE_CLASS_100,
    });

    new ARecord(this, 'AliasRecord', {
      zone,
      recordName: fromDomain,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    new cdk.CfnOutput(this, 'RedirectFrom', { value: `https://${fromDomain}` });
    new cdk.CfnOutput(this, 'RedirectTo', { value: targetUrl });
  }
}
