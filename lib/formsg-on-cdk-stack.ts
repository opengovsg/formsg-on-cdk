import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';


export class FormsgOnCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, withHttps?: boolean, props?: cdk.StackProps) {
    super(scope, id, props);

    // Input parameters
    const { valueAsString: domainName } = withHttps 
      ? new cdk.CfnParameter(this, 'domainName', {
        type: 'String',
        description: 'The fully-qualified domain name (FQDN) that identifies this service.',
      })
      : { valueAsString: '' }

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
