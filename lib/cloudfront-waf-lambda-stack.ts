// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from '@aws-cdk/core';
import lambda = require('@aws-cdk/aws-lambda');
import iam = require('@aws-cdk/aws-iam')
import waf = require('@aws-cdk/aws-wafv2')
import sns = require('@aws-cdk/aws-sns')
import snsSub = require('@aws-cdk/aws-sns-subscriptions')
import {WafIPSetSeeder} from './cloudfront-waf-ipset-seeder'
import fs = require('fs');


export class CloudfrontWafLambdaStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const IPSetName = 'CloudFront-IPs'

    // Create the Lambda and assign permission
    const lambdaFN = new lambda.Function(this, 'WafIPSetUpdaterLambda', {
      code: new lambda.InlineCode(fs.readFileSync('lib/waf-update.py', { encoding: 'utf-8' })),
      handler: 'index.lambda_handler',
      description: 'This lambda is used to update the CloudFront IP Sets in WAF',
      runtime: lambda.Runtime.PYTHON_3_7,
      environment: {
        'SERVICE': 'CLOUDFRONT',
        'IPSET_NAME': IPSetName,
        'DEBUG': 'true'
      }
    });

    const wafPolicyStatement = new iam.PolicyStatement({
      actions: [
        "waf:*",
        "waf-regional:*",
        "wafv2:*",
        "elasticloadbalancing:SetWebACL",
        "apigateway:SetWebACL"
      ],
      effect: iam.Effect.ALLOW,
      resources: ["*"]
    })
    lambdaFN.role?.addToPrincipalPolicy(wafPolicyStatement)

    // Subscripe the Lambda to the AmazonIpSpaceChanged SNS topic
    const ipSNS = sns.Topic.fromTopicArn(this,'ipSNSTopic','arn:aws:sns:us-east-1:806199016981:AmazonIpSpaceChanged')
    ipSNS.addSubscription(new snsSub.LambdaSubscription(lambdaFN))

    // Create IPSet

    const ipSet = new waf.CfnIPSet(this, 'ipset', {
      addresses: [],
      ipAddressVersion: "IPV4",
      scope: "REGIONAL",
      name: IPSetName
    })

    // Create the WAF and Associate the IP Set
    const ipSetWaf = new waf.CfnWebACL(this, 'waf', {
      name: 'CloudFront-IPSet-WAF',
      description: "This waf is configured with an IPSet to restrict access from only CloudFront.",
      defaultAction: {
        block: {}
      },
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'cloudfront-ipset-waf',
        sampledRequestsEnabled: true
      },
      rules: [
        {
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "cloudfront-waf-ipset-metrics",
            sampledRequestsEnabled: true
          },
          priority: 0,
          statement: {
            ipSetReferenceStatement: {
              arn: ipSet.attrArn
            }
          },
          name: "Restrict-CloudFront-IPs",
          action:{
            allow:{}
          }
        },
      ]
    })

    // Custom Resource to seed the IP Set
    const ipSeeder = new WafIPSetSeeder(this,'ipSeeder',{
      LambdaARN: lambdaFN.functionArn
    })
  }
}
