// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import cfn = require('@aws-cdk/aws-cloudformation');
import lambda = require('@aws-cdk/aws-lambda');
import iam = require('@aws-cdk/aws-iam')
import cdk = require('@aws-cdk/core');
import fs = require('fs');

export interface WafIPSetSeederProps {
  /**
   * ARN of Lambda to trigger
   */
  LambdaARN: string;
}

export class WafIPSetSeeder extends cdk.Construct {
  public readonly response: string;

  constructor(scope: cdk.Construct, id: string, props: WafIPSetSeederProps) {
    super(scope, id);

    const ipSeederRole = new iam.Role(this,'ipseederRole',{
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })
    
    ipSeederRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this,
      'AWSLambdaBasicExecutionRole',
      'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'))
    
    const ipSeederLambdaInvokeStatement = new iam.PolicyStatement({
      actions: [
        "lambda:InvokeFunction"
      ],
      effect: iam.Effect.ALLOW,
      resources: [props.LambdaARN]
    })
    ipSeederRole.addToPrincipalPolicy(ipSeederLambdaInvokeStatement)

    const resource = new cfn.CustomResource(this, 'WafIpSeederCustomLambdaResource', {
      provider: cfn.CustomResourceProvider.lambda(new lambda.SingletonFunction(this, 'Singleton', {
        uuid: '1fb3e13d-d78c-490f-b286-d74bd5d89289',
        code: new lambda.InlineCode(fs.readFileSync('lib/waf-seed-ip.py', { encoding: 'utf-8' })),
        handler: 'index.lambda_handler',
        description: "This lambda function is used to seed the intial IP set for CloudFront",
        timeout: cdk.Duration.seconds(30),
        runtime: lambda.Runtime.PYTHON_3_7,
        role: ipSeederRole
      })),
      properties: props
    });

    this.response = resource.getAtt('Response').toString();

    

  }
}