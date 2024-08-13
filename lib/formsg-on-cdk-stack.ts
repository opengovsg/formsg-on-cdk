import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { customAlphabet } from 'nanoid'

import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

import { FormsgS3Buckets } from './constructs/s3'
import { FormsgEcr } from './constructs/ecr'
import defaultEnvironment from './formsg-env-vars'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'

export class FormsgOnCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, withHttps?: boolean, props?: cdk.StackProps) {
    super(scope, id, props)

    // Input parameters
    const { valueAsString: domainName } = withHttps 
      ? new cdk.CfnParameter(this, 'domainName', {
        type: 'String',
        description: 'The fully-qualified domain name (FQDN) that identifies this service.',
      })
      : { valueAsString: '' }

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
    const ddbPassSecret = new Secret(this, 'DocumentDB Password', {
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
      // vpcSubnets: {
      //   subnets: vpc.availabilityZones.map((availabilityZone, index) => {
      //     return new ec2.PrivateSubnet(this, `ddb-subnet-${index}`, {
      //       availabilityZone,
      //       vpcId: vpc.vpcId,
      //       cidrBlock: `10.0.${37 + index}.0/24`,
      //     })
      //   })
      // },
      // Use t3 medium instances to take advantage of the free tier,
      // providing 750 machine hours free per month
      // See https://aws.amazon.com/documentdb/free-trial/
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MEDIUM),
      instances: 2,
      engineVersion: '4.0',
      parameterGroup: new cdk.aws_docdb.ClusterParameterGroup(this, 'DDB_Parameter', {
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
      new Secret(this, 'DocumentDB Connection String', {
        secretName: 'ddb-connstring',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        secretStringValue: cdk.SecretValue.unsafePlainText(
          `mongodb://root:${ddbPassSecret.secretValue.unsafeUnwrap()}@${db.clusterEndpoint.socketAddress}/form?replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`
        ),
      })
    )

    const loadBalancer = new ApplicationLoadBalancer(this, 'alb', {
      vpc,
      vpcSubnets: {
        subnets: vpc.publicSubnets,
      },
      internetFacing: true,
    })
    const environment = domainName
      ? {
        ...defaultEnvironment,
        APP_URL: `https://${domainName}`,
        FE_APP_URL: `https://${domainName}`,
      }
      : {
        ...defaultEnvironment,
        APP_URL: `http://${loadBalancer.loadBalancerDnsName}`,
        FE_APP_URL: `http://${loadBalancer.loadBalancerDnsName}`,
      }

    // Create ECS Cluster and Fargate Service
    const cluster = new ecs.Cluster(this, 'ecs', { vpc })
    const fargate = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'app', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        environment,
        secrets: {
          DB_HOST: dbHostString,
        }
      },
      loadBalancer,
      publicLoadBalancer: true,
      ...(withHttps 
        ? {
          redirectHTTP: true,
          protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
          domainName,
          domainZone: new cdk.aws_route53.HostedZone(this, 'hosted-zone', {
            zoneName: domainName,
          }),
        } 
        : {}
      ),
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

    new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: fargate.loadBalancer.loadBalancerDnsName })
  }
}
