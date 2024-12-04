
import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Code, Function, Handler, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { FormsgS3Buckets } from './s3'
import { FormsgEcr } from './ecr'

export interface FormsgLambdasProps {
  s3Buckets: FormsgS3Buckets
  ecr: FormsgEcr
}

export class FormsgLambdas extends Construct {
  readonly virusScanner: Function
  constructor(
    scope: Construct, 
    { 
      s3Buckets: { 
        s3VirusScannerClean, 
        s3VirusScannerQuarantine,
      },
      ecr: {
        lambdaVirusScanner,
        deployment,
      }
    }: FormsgLambdasProps
  ) {
    super(scope, 'lambdas')
    const virusScanner = new Function(this, 'virus-scanner', {
      functionName: 'virus-scanner',
      timeout: Duration.seconds(300),
      memorySize: 1536,
      runtime: Runtime.FROM_IMAGE,
      handler: Handler.FROM_IMAGE,
      code: Code.fromEcrImage(lambdaVirusScanner.repository),
      environment: {
        VIRUS_SCANNER_QUARANTINE_S3_BUCKET: s3VirusScannerQuarantine.bucketName,
        VIRUS_SCANNER_CLEAN_S3_BUCKET: s3VirusScannerClean.bucketName,
      }
    })
    virusScanner.role?.attachInlinePolicy(new Policy(this, 'manage-quarantine', {
      statements: [
        new PolicyStatement({
          actions: [
            's3:GetObject',
            's3:GetObjectTagging',
            's3:GetObjectVersion',
            's3:DeleteObject',
            's3:DeleteObjectVersion',
          ],
          resources: [`${s3VirusScannerQuarantine.bucketArn}/*`],
        }),
      ],
    }))
    virusScanner.role?.attachInlinePolicy(new Policy(this, 'put-clean', {
      statements: [
        new PolicyStatement({
          actions: [
            's3:PutObject',
            's3:PutObjectTagging',
          ],
          resources: [`${s3VirusScannerClean.bucketArn}/*`],
        }),
      ],
    }))
    virusScanner.node.addDependency(deployment.customResource)
    this.virusScanner = virusScanner


    // Trigger the virus scanner once every 3 minutes to keep it warm
    const eventRule = new Rule(this, 'keep-warm-trigger', {
      schedule: Schedule.rate(Duration.minutes(3)), 
    })
    eventRule.applyRemovalPolicy(RemovalPolicy.DESTROY)
    eventRule.addTarget(new LambdaFunction(this.virusScanner))
  }

}
