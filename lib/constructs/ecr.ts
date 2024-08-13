import { Construct } from 'constructs'
import * as ecrdeploy from 'cdk-ecr-deployment'
import { Repository } from 'aws-cdk-lib/aws-ecr'
import * as ecr from 'aws-cdk-lib/aws-ecr-assets'
import { RemovalPolicy } from 'aws-cdk-lib'

export interface FormsgEcrProps {
}

export class FormsgEcr extends Construct {
  readonly lambdaVirusScanner: {
    repository: Repository
  }
  readonly form: {
    repository: Repository
  }

  constructor(
    scope: Construct, 
    props: FormsgEcrProps = {}
  ) {
    super(scope, 'ecr')
    const repositoryLambdaVirusScanner = new Repository(this, 'lambda-virus-scanner', {
      repositoryName: 'lambda-virus-scanner',
      removalPolicy: RemovalPolicy.DESTROY,
    })
    // new ecrdeploy.ECRDeployment(scope, 'ecr-deployment-lambda-virus-scanner', {
    //   src: new ecrdeploy.DockerImageName('opengovsg/lambda-virus-scanner:latest'),
    //   dest: new ecrdeploy.DockerImageName(this.lambdaVirusScanner.repositoryUriForTag('latest')),
    // })
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
