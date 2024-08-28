import { RemovalPolicy } from 'aws-cdk-lib'
import { BlockPublicAccess, Bucket, BucketAccessControl, HttpMethods, ObjectOwnership } from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import envVars from '../formsg-env-vars'
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { FormsgS3Buckets } from './s3';
import { ApplicationLoadBalancer, ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';

export class VirusScannerEcs extends Construct {
  readonly service: ecs.FargateService
  readonly hostname: string

  constructor(
    scope: Construct, 
    { 
      cluster, 
      logGroupSuffix, 
      s3Buckets,
    } : { 
      cluster: ecs.Cluster; 
      logGroupSuffix: string; 
      s3Buckets: FormsgS3Buckets 
    }
  ) {
    super(scope, 'virus-scanner')
    const { vpc } = cluster

    // Hack together a virus scanner cluster in lieu of Lambda
    const port = 8080
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'task', {
      memoryLimitMiB: 2048,
      cpu: 1024,
    })
    taskDefinition
      .addContainer('task-container', {
        image: ecs.ContainerImage.fromRegistry('opengovsg/lambda-virus-scanner:latest-ecs'),
        containerName: 'web',
        environment: {
          NODE_ENV: 'production',
          VIRUS_SCANNER_QUARANTINE_S3_BUCKET: s3Buckets.s3VirusScannerQuarantine.bucketName,
          VIRUS_SCANNER_CLEAN_S3_BUCKET: s3Buckets.s3VirusScannerClean.bucketName,
        },
        logging: ecs.LogDriver.awsLogs({
          logGroup: new LogGroup(this, 'cloudwatch', {
            logGroupName: `/aws/ecs/logs/virus-scanner/${logGroupSuffix}`,
          }),
          streamPrefix: 'virus-scanner',
        }),
        portMappings: [
          { containerPort: port, hostPort: port },
        ],
      })
    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:GetObject',
          's3:GetObjectTagging',
          's3:GetObjectVersion',
          's3:DeleteObject',
          's3:DeleteObjectVersion',
        ],
        resources: [`${s3Buckets.s3VirusScannerQuarantine.bucketArn}/*`],
      })
    )
    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:PutObject',
          's3:PutObjectTagging',
        ],
        resources: [`${s3Buckets.s3VirusScannerClean.bucketArn}/*`],
      })
    )

    const service = new ecs.FargateService(this, 'service', {
      cluster,
      taskDefinition,
    })

    const loadBalancer = new ApplicationLoadBalancer(this, 'alb', {
      loadBalancerName: 'alb',
      internetFacing: false,
      vpc,
      vpcSubnets: {
        subnets: vpc.privateSubnets,
      },
    })
    const listener = loadBalancer.addListener('alb-listener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
    })

    service.registerLoadBalancerTargets({
      containerName: 'web',
      containerPort: port,
      listener: ecs.ListenerConfig.applicationListener(
        listener, 
        { 
          protocol: ApplicationProtocol.HTTP,
          port,
          healthCheck: {
            healthyHttpCodes: ['200', '404'].join(',')
          }
        },
      ),
      newTargetGroupId: 'ecs',
    })

    this.service = service
    this.hostname = loadBalancer.loadBalancerDnsName
  }
}
