import { Construct } from 'constructs'
import * as ecrdeploy from './cdk-ecr-deployment'
import { Repository } from 'aws-cdk-lib/aws-ecr'
import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import { Code } from 'aws-cdk-lib/aws-lambda'
import { Bucket } from 'aws-cdk-lib/aws-s3'

export interface FormsgEcrProps {
}

export class FormsgEcr extends Construct {
  readonly lambdaVirusScanner: {
    repository: Repository
  }
  readonly form: {
    repository: Repository
  }

  readonly deployment: ecrdeploy.ECRDeployment

  constructor(
    scope: Construct, 
    props: FormsgEcrProps = {}
  ) {
    super(scope, 'ecr')
    const repositoryLambdaVirusScanner = new Repository(this, 'lambda-virus-scanner', {
      repositoryName: 'lambda-virus-scanner',
      removalPolicy: RemovalPolicy.DESTROY,
    })
    this.deployment = new ecrdeploy.ECRDeployment(scope, 'ecr-deployment-lambda-virus-scanner', {
      code: Code.fromBucket(Bucket.fromBucketAttributes(this, 'cdk-ecr-deployment', {
        bucketArn: 'arn:aws:s3:::formsg-on-cdk',
        bucketRegionalDomainName: `formsg-on-cdk.s3.ap-southeast-1.${Stack.of(this).urlSuffix}`
      }), 'cdk-ecr-deployment/bootstrap.zip'),
      src: new ecrdeploy.DockerImageName('opengovsg/lambda-virus-scanner:latest'),
      dest: new ecrdeploy.DockerImageName(repositoryLambdaVirusScanner.repositoryUriForTag('latest')),
    })
    this.lambdaVirusScanner = {
      repository: repositoryLambdaVirusScanner,
    }


    const repositoryForm = new Repository(this, 'form', {
      repositoryName: 'form',
      removalPolicy: RemovalPolicy.DESTROY,
    })
    this.form = {
      repository: repositoryForm,
    }
  }

}
