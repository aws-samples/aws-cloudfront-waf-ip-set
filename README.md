# CloudFront WAF IP Set

This project creates a WAF and IP Set that are scoped to the CloudFront IP Ranges.
Customers can then use this WAF to only allow traffic to an Application load balancer or API gateway from a CloudFront Distribution.

## Components
This stack deploys the following components

- WAF: an AWS Web application firewall
- IP Set: an IP Set scopped to the CloudFront ranges
- Lambda: AWS lambda is used to parse the IP-Ranges.json file and update the IP set with the CloudFront ranges. This lambda is subscriped to an SNS topic that will trigger these changes automatically as AWS publishes new ranges. 

## Deployment
To deploy this solution run the below script from the root of the project.

    npm install
    cdk bootstrap
    cdk deploy

Once the CDK project is finished deploying, you must manually associate the AWS Resources with your newly created WAF for them to be protected. 

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

