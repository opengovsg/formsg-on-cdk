# FormSG on CDK

This repository contains templates to roll out FormSG onto an AWS account.

It is written using AWS' Cloud Development Kit (CDK).

## Usage

This repository's most significant artifact is a CloudFormation template,
accessible via this project's 
[releases](https://github.com/opengovsg/formsg-on-cdk/releases), 
and via the Go.gov.sg link found on the GitHub page.

More information about using the CloudFormation template can be found on the
[wiki](https://github.com/opengovsg/formsg-on-cdk/wiki).

## Project details

The `cdk.json` file tells the CDK Toolkit how to execute your app.

### Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
