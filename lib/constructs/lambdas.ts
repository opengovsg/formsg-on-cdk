
import { Duration } from 'aws-cdk-lib'
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
      }
    }: FormsgLambdasProps
  ) {
    super(scope, 'lambdas')
    const virusScanner = new Function(scope, 'virus-scanner', {
      functionName: 'virus-scanner',
      timeout: Duration.seconds(300),
      memorySize: 2048,
      runtime: Runtime.FROM_IMAGE,
      handler: Handler.FROM_IMAGE,
      code: Code.fromEcrImage(lambdaVirusScanner),
    })
    virusScanner.role?.attachInlinePolicy(new Policy(scope, 'manage-quarantine', {
      statements: [
        new PolicyStatement({
          actions: [
            's3:GetObject',
            's3:GetObjectTagging',
            's3:GetObjectVersion',
            's3:DeleteObject',
            's3:DeleteObjectVersion',
          ],
          resources: [s3VirusScannerQuarantine.bucketArn],
        }),
      ],
    }))
    virusScanner.role?.attachInlinePolicy(new Policy(scope, 'put-clean', {
      statements: [
        new PolicyStatement({
          actions: [
            's3:PutObject',
            's3:PutObjectTagging',
          ],
          resources: [s3VirusScannerClean.bucketArn],
        }),
      ],
    }))
    this.virusScanner = virusScanner
  }

}
