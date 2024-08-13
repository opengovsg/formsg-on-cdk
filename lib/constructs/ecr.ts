import { Construct } from 'constructs'
import * as ecrdeploy from 'cdk-ecr-deployment'
import { Repository } from 'aws-cdk-lib/aws-ecr'
import * as ecr from 'aws-cdk-lib/aws-ecr-assets'

export interface FormsgEcrProps {
}

export class FormsgEcr extends Construct {
  readonly lambdaVirusScanner: {
    repository: Repository
  }

  constructor(
    scope: Construct, 
    props: FormsgEcrProps = {}
  ) {
    super(scope, 'ecr')
    const repository = new Repository(this, 'lambda-virus-scanner', {
      repositoryName: 'lambda-virus-scanner',
    })
    // new ecrdeploy.ECRDeployment(scope, 'ecr-deployment-lambda-virus-scanner', {
    //   src: new ecrdeploy.DockerImageName('opengovsg/lambda-virus-scanner:latest'),
    //   dest: new ecrdeploy.DockerImageName(this.lambdaVirusScanner.repositoryUriForTag('latest')),
    // })
    this.lambdaVirusScanner = {
      repository,
    }
  }

}
