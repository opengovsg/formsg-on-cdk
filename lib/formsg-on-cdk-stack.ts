import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { customAlphabet } from 'nanoid'

import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { ApplicationLoadBalancer, ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { AllowedMethods, CacheCookieBehavior, CacheHeaderBehavior, CachePolicy, CacheQueryStringBehavior, Distribution, OriginProtocolPolicy, OriginRequestPolicy } from 'aws-cdk-lib/aws-cloudfront'
import { LoadBalancerV2Origin } from 'aws-cdk-lib/aws-cloudfront-origins'

import { FormsgS3Buckets } from './constructs/s3'
import { FormsgEcr } from './constructs/ecr'
import defaultEnvironment from './formsg-env-vars'

export class FormsgOnCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, withHttps?: boolean, props?: cdk.StackProps) {
    super(scope, id, props)

    // Input parameters
    // const { valueAsString: domainName } = withHttps 
    //   ? new cdk.CfnParameter(this, 'domainName', {
    //     type: 'String',
    //     description: 'The fully-qualified domain name (FQDN) that identifies this service.',
    //   })
    //   : { valueAsString: '' }

    const { valueAsString: email } = new cdk.CfnParameter(this, 'email', {
      type: 'String',
      description: 'Your email address. OTP emails will be sent bearing this email address.',
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

    // Create S3 buckets
    const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)
    const s3Suffix = nanoid()
    const s3Buckets = new FormsgS3Buckets(this, s3Suffix)

    // Do not create Lambda Virus Scanner for now, until we figure out
    // how to load the ECR image for this deployment
    // const lambdas = new FormsgLambdas(this, { s3Buckets, ecr })

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
          `mongodb://root:${ddbPassSecret.secretValue.unsafeUnwrap()}@${db.clusterEndpoint.socketAddress}/form?replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`
        ),
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

    const origin = new LoadBalancerV2Origin(loadBalancer, {
      protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
    })
    const cloudFront = new Distribution(this, 'cloudfront-form', {
      defaultBehavior: {
        origin,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        allowedMethods: AllowedMethods.ALLOW_ALL,
      },
    })
    cloudFront.addBehavior('api/*', origin, {
      cachePolicy: CachePolicy.CACHING_DISABLED,
      originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
      allowedMethods: AllowedMethods.ALLOW_ALL,
    })

    // TODO: Add secrets, parameters for initial agency domain/name
    const environment = {
      ...defaultEnvironment,
      APP_URL: `https://${cloudFront.distributionDomainName}`,
      FE_APP_URL: `https://${cloudFront.distributionDomainName}`,
      MAIL_FROM: email,
      MAIL_OFFICIAL: email,
      SES_HOST: sesHost,
      INIT_AGENCY_DOMAIN: initAgencyDomain,
      INIT_AGENCY_FULLNAME: initAgencyFullName,
      INIT_AGENCY_SHORTNAME: initAgencyShortname,
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

    // Create ECS Cluster and Fargate Service
    const cluster = new ecs.Cluster(this, 'ecs', { vpc })
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
        },
        containerPort: 5000,
      },
      loadBalancer,
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
          resources: [bucketArn],
        })
      )
    )

    fargate.taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:PutObject',
          's3:GetObject',
        ],
        resources: [s3Buckets.s3PaymentProof.bucketArn],
      })
    )

    fargate.taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:PutObject',
        ],
        resources: [s3Buckets.s3VirusScannerQuarantine.bucketArn],
      })
    )

    fargate.taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:GetObjectVersion',
        ],
        resources: [s3Buckets.s3VirusScannerClean.bucketArn],
      })
    )

    new cdk.CfnOutput(this, 'url', { value: cloudFront.distributionDomainName })
  }
}
