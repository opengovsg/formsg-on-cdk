import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';


export class FormsgOnCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ECS cluster
    const vpc = new ec2.Vpc(this, 'vpc', { maxAzs: 2 });

    const cluster = new ecs.Cluster(this, 'ecs', { vpc });

    // Create Fargate Service
    const fargate = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'app', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample')
      },
      publicLoadBalancer: true,
      redirectHTTP: true,
      protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
    });

    const scaling = fargate.service.autoScaleTaskCount({ maxCapacity: 2 });
    scaling.scaleOnCpuUtilization('scaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: fargate.loadBalancer.loadBalancerDnsName });
  }
}
