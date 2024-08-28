import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { AllowedMethods, CachePolicy, Distribution, OriginProtocolPolicy, OriginRequestPolicy, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront'
import { LoadBalancerV2Origin } from 'aws-cdk-lib/aws-cloudfront-origins'

import { FormsgS3Buckets } from './constructs/s3'
import { FormsgEcr } from './constructs/ecr'
import defaultEnvironment from './formsg-env-vars'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { OriginVerify } from '@alma-cdk/origin-verify'
import { VirusScannerEcs } from './constructs/virus-scanner-ecs'

export class FormsgOnCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Input parameters
    const { valueAsString: googleCaptcha } = new cdk.CfnParameter(this, 'googleCaptcha', {
      noEcho: true,
      type: 'String',
      description: 'The secret key used for reCAPTCHA.',
      // Okay to hard-code the default here, since this is 
      // the key published by Google for dev testing
      // https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha.-what-should-i-do
      default: '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe',
    })

    const { valueAsString: googleCaptchaPublic } = new cdk.CfnParameter(this, 'googleCaptchaPublic', {
      type: 'String',
      description: 'The public key used for reCAPTCHA.',
      // https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha.-what-should-i-do
      default: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
    })

    const { valueAsString: email } = new cdk.CfnParameter(this, 'email', {
      type: 'String',
      description: 'OTP emails will be sent bearing this email address as the sender.',
    })
    const { valueAsString: initAgencyDomain } = new cdk.CfnParameter(this, 'initAgencyDomain', {
      type: 'String',
      description: 'The fully-qualified domain name (FQDN) of the initial agency.',
    })
    const { valueAsString: initAgencyFullName } = new cdk.CfnParameter(this, 'initAgencyFullName', {
      type: 'String',
      description: 'The full name of the initial agency.',
    })
    const { valueAsString: initAgencyShortname } = new cdk.CfnParameter(this, 'initAgencyShortname', {
      type: 'String',
      description: 'The shortname of the initial agency.',
    })


    const { valueAsString: sesHost } = new cdk.CfnParameter(this, 'sesHost', {
      type: 'String',
      default: 'email-smtp.ap-southeast-1.amazonaws.com',
      description: 'The fully-qualified domain name (FQDN) of the SMTP host, or for Simple Email Service (SES).',
    })
    const { valueAsString: sesPort } = new cdk.CfnParameter(this, 'sesPort', {
      type: 'Number',
      default: 465,
      description: 'The port for the SMTP host or Simple Email Service (SES).',
    })
    const { valueAsString: sesUser } = new cdk.CfnParameter(this, 'sesUser', {
      noEcho: true,
      type: 'String',
      description: 'The SMTP user for Simple Email Service (SES).',
    })
    const { valueAsString: sesPass } = new cdk.CfnParameter(this, 'sesPass', {
      noEcho: true,
      type: 'String',
      description: 'The SMTP password for Simple Email Service (SES).',
    })

    const vpc = new ec2.Vpc(this, 'vpc', { 
      maxAzs: 2,
      // Deliberately avoid restricting default security group,
      // so that we avoid creating the custom resource that
      // is invoked when deploying directly in CDK, but
      // does not work well as a synth'd CloudFormation
      restrictDefaultSecurityGroup: false,
    })

    // Create ECR
    const ecr = new FormsgEcr(this)

    // Create DocumentDB cluster
    const ddbPassSecret = new Secret(this, 'ddb-password', {
      secretName: 'ddb-password',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      generateSecretString: {
        excludePunctuation: true,
        excludeCharacters: "/¥'%:{}",
      },
    })

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'ddb-security-group', {
      vpc,
      description: 'Allows connection to DocumentDB',
    })

    const db = new cdk.aws_docdb.DatabaseCluster(this, 'ddb', {
      masterUser: {
        username: 'root',
        password: cdk.SecretValue.secretsManager(ddbPassSecret.secretArn),
      },
      vpc,
      // Use t3 medium instances to take advantage of the free tier,
      // providing 750 machine hours free per month
      // See https://aws.amazon.com/documentdb/free-trial/
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MEDIUM),
      instances: 2,
      engineVersion: '4.0',
      parameterGroup: new cdk.aws_docdb.ClusterParameterGroup(this, 'ddb-parameter-group', {
        dbClusterParameterGroupName: 'disabled-tls-parameter2',
        parameters: {
          tls: 'disabled',
        },
        family: 'docdb4.0',
      }),
      securityGroup: dbSecurityGroup,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const dbHostString = ecs.Secret.fromSecretsManager(
      new Secret(this, 'ddb-connstring', {
        secretName: 'ddb-connstring',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        secretStringValue: cdk.SecretValue.unsafePlainText(
          `mongodb://root:${ddbPassSecret.secretValue.unsafeUnwrap()}@${db.clusterEndpoint.socketAddress}/form?replicaSet=rs0&readPreference=primaryPreferred&retryWrites=false`
        ),
      })
    )

    const googleCaptchaSecret = ecs.Secret.fromSecretsManager(
      new Secret(this, 'google-captcha', {
        secretName: 'google-captcha',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        secretStringValue: cdk.SecretValue.unsafePlainText(googleCaptcha),
      })
    )

    const sesUserSecret = ecs.Secret.fromSecretsManager(
      new Secret(this, 'ses-user', {
        secretName: 'ses-user',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        secretStringValue: cdk.SecretValue.unsafePlainText(sesUser),
      })
    )

    const sesPassSecret = ecs.Secret.fromSecretsManager(
      new Secret(this, 'ses-pass', {
        secretName: 'ses-pass',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        secretStringValue: cdk.SecretValue.unsafePlainText(sesPass),
      })
    )

    const loadBalancer = new ApplicationLoadBalancer(this, 'alb', {
      loadBalancerName: 'form-alb',
      internetFacing: true,
      vpc,
      vpcSubnets: {
        subnets: vpc.publicSubnets,
      },
    })

    const originVerify = new OriginVerify(this, 'alb-verify', {
      origin: loadBalancer,
    })
    const origin = new LoadBalancerV2Origin(loadBalancer, {
      protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
      originShieldEnabled: true,
      customHeaders: {
        [originVerify.headerName]: originVerify.headerValue,
      },
    })
    const cloudFront = new Distribution(this, 'cloudfront-form', {
      defaultBehavior: {
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        origin,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        allowedMethods: AllowedMethods.ALLOW_ALL,
      },
    })
    cloudFront.addBehavior('api/*', origin, {
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
      allowedMethods: AllowedMethods.ALLOW_ALL,
    })

    const distributionUrl = `https://${cloudFront.distributionDomainName}`

    // Create S3 buckets
    const suffixSecret = new Secret(this, 'suffix-secret', {
      secretName: 'suffix-secret',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      generateSecretString: {
        excludePunctuation: true,
        excludeUppercase: true,
        excludeCharacters: "/¥'%:{}-_[]()",
        passwordLength: 6,
      },
    })

    const s3Suffix = suffixSecret.secretValue.unsafeUnwrap()
    const s3Buckets = new FormsgS3Buckets(this, { s3Suffix, origin: distributionUrl })

    // Create ECS Cluster
    const logGroupSuffix = s3Suffix
    const cluster = new ecs.Cluster(this, 'ecs', { vpc })

    // Hack together a virus scanner cluster in lieu of Lambda
    const virusScanner = new VirusScannerEcs(this, { cluster, logGroupSuffix, s3Buckets })

    const environment = {
      ...defaultEnvironment,
      APP_URL: distributionUrl,
      FE_APP_URL: distributionUrl,
      MAIL_FROM: email,
      MAIL_OFFICIAL: email,
      SES_HOST: sesHost,
      SES_PORT: sesPort,
      INIT_AGENCY_DOMAIN: initAgencyDomain,
      INIT_AGENCY_FULLNAME: initAgencyFullName,
      INIT_AGENCY_SHORTNAME: initAgencyShortname,
      // reCAPTCHA config
      GOOGLE_CAPTCHA_PUBLIC: googleCaptchaPublic,

      // S3 Bucket config
      ATTACHMENT_S3_BUCKET: s3Buckets.s3Attachment.bucketName,
      PAYMENT_PROOF_S3_BUCKET: s3Buckets.s3PaymentProof.bucketName,
      IMAGE_S3_BUCKET: s3Buckets.s3Image.bucketName,
      LOGO_S3_BUCKET: s3Buckets.s3Logo.bucketName,
      STATIC_ASSETS_S3_BUCKET: s3Buckets.s3StaticAssets.bucketName,
      VIRUS_SCANNER_QUARANTINE_S3_BUCKET: s3Buckets.s3VirusScannerQuarantine.bucketName,
      VIRUS_SCANNER_CLEAN_S3_BUCKET: s3Buckets.s3VirusScannerClean.bucketName,
      VIRUS_SCANNER_LAMBDA_ENDPOINT: `http://${virusScanner.hostname}`,
    }

    // Create Session Secret
    const sessionSecret = ecs.Secret.fromSecretsManager(
      new Secret(this, 'session-secret', {
        secretName: 'session-secret',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        generateSecretString: {
          excludePunctuation: true,
          excludeCharacters: "/¥'%:{}",
        },
      })
    )

    // Create Fargate Service
    const fargate = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'app', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('opengovsg/formsg-intl'),
        environment,
        secrets: {
          DB_HOST: dbHostString,
          SESSION_SECRET: sessionSecret,
          SES_USER: sesUserSecret,
          SES_PASS: sesPassSecret,
          GOOGLE_CAPTCHA: googleCaptchaSecret,
        },
        logDriver: ecs.LogDriver.awsLogs({
          logGroup: new LogGroup(this, 'cloudwatch', {
            logGroupName: `/aws/ecs/logs/form/${logGroupSuffix}`,
          }),
          streamPrefix: 'form',
        }),
        containerPort: 5000,
      },
      loadBalancer,
      healthCheckGracePeriod: cdk.Duration.seconds(0),
    })

    const scaling = fargate.service.autoScaleTaskCount({ maxCapacity: 2 })
    scaling.scaleOnCpuUtilization('scaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    })

    fargate.service.connections.securityGroups.forEach((securityGroup) => {
      dbSecurityGroup.addIngressRule(securityGroup, ec2.Port.tcp(27017))
    })

    ;[
      s3Buckets.s3Attachment,
      s3Buckets.s3Image,
      s3Buckets.s3Logo,
    ].forEach(({ bucketArn }) => 
      fargate.taskDefinition.addToTaskRolePolicy(
        new PolicyStatement({
          actions: [
            's3:PutObject',
            's3:GetObject',
            's3:DeleteObject',
            's3:PutObjectAcl',
          ],
          resources: [`${bucketArn}/*`],
        })
      )
    )

    fargate.taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:PutObject',
          's3:GetObject',
        ],
        resources: [`${s3Buckets.s3PaymentProof.bucketArn}/*`],
      })
    )

    fargate.taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:PutObject',
        ],
        resources: [`${s3Buckets.s3VirusScannerQuarantine.bucketArn}/*`],
      })
    )

    fargate.taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:GetObjectVersion',
        ],
        resources: [`${s3Buckets.s3VirusScannerClean.bucketArn}/*`],
      })
    )

    new cdk.CfnOutput(this, 'url', { value: cloudFront.distributionDomainName })
  }
}
