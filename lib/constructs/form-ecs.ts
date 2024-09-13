import { Construct } from 'constructs'
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { FormsgS3Buckets } from './s3';
import { ApplicationLoadBalancer, ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Duration } from 'aws-cdk-lib';


export class FormEcs extends Construct {
  readonly service: ecs.FargateService
  readonly hostname: string

  constructor(
    scope: Construct, 
    { 
      cluster, 
      logGroupSuffix, 
      s3Buckets,
      environment,
      secrets,
      loadBalancer,
    } : { 
      cluster: ecs.Cluster; 
      logGroupSuffix: string;
      s3Buckets: FormsgS3Buckets;
      environment: Record<string, string>;
      secrets: Record<string, ecs.Secret>;
      loadBalancer: ApplicationLoadBalancer
    }
  ) {
    super(scope, 'form')
    const port = 5000
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'task')
    taskDefinition
      .addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('opengovsg/formsg-intl'),
        containerName: 'web',
        environment,
        secrets,
        logging: ecs.LogDriver.awsLogs({
          logGroup: new LogGroup(this, 'cloudwatch', {
            logGroupName: `/aws/ecs/logs/form/${logGroupSuffix}`,
          }),
          streamPrefix: 'form',
        }),
        portMappings: [
          { containerPort: port, hostPort: port },
        ],
      })
      taskDefinition.addToTaskRolePolicy(
        new PolicyStatement({
          actions: [
            's3:PutObject',
            's3:GetObject',
            's3:DeleteObject',
            's3:PutObjectAcl',
          ],
          resources: [
            s3Buckets.s3Attachment,
            s3Buckets.s3Image,
            s3Buckets.s3Logo,
          ].map(({ bucketArn }) => `${bucketArn}/*`),
        })
      )

    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:PutObject',
          's3:GetObject',
        ],
        resources: [`${s3Buckets.s3PaymentProof.bucketArn}/*`],
      })
    )

    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:PutObject',
        ],
        resources: [`${s3Buckets.s3VirusScannerQuarantine.bucketArn}/*`],
      })
    )

    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: [
          's3:GetObjectVersion',
        ],
        resources: [`${s3Buckets.s3VirusScannerClean.bucketArn}/*`],
      })
    )

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
      healthCheckGracePeriod: Duration.seconds(300),
    })

    const listener = loadBalancer.addListener('alb-listener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
    })

    const scaling = service.autoScaleTaskCount({ maxCapacity: 2 })
    scaling.scaleOnCpuUtilization('scaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
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
            healthyHttpCodes: ['200', '403'].join(','),
          },
        },
      ),
      newTargetGroupId: 'ecs',
    })

    this.service = service
  }
}
