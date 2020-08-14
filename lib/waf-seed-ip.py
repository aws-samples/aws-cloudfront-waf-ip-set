# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

def lambda_handler(event, context):
    import logging
    import boto3
    import json
    import cfnresponse
    
    logging.getLogger().setLevel(logging.INFO)

    resource_id = 'Seed-WAF-IPSet'

    try:
        logging.info('Input event: %s', event)

        # Check if this is a Create and we're failing Creates
        if event['RequestType'] == 'Create' and event['ResourceProperties'].get('FailCreate', False):
            raise RuntimeError('Create failure requested')

        if event['RequestType'] == 'Create':
            client = boto3.client('lambda')
            lambdaEvent = """{
            "Records": [
                {
                "EventVersion": "1.0",
                "EventSubscriptionArn": "arn:aws:sns:EXAMPLE",
                "EventSource": "aws:sns",
                "Sns": {
                    "SignatureVersion": "1",
                    "Timestamp": "1970-01-01T00:00:00.000Z",
                    "Signature": "EXAMPLE",
                    "SigningCertUrl": "EXAMPLE",
                    "MessageId": "95df01b4-ee98-5cb9-9903-4c221d41eb5e",
                    "Type": "Notification",
                    "UnsubscribeUrl": "EXAMPLE",
                    "TopicArn": "arn:aws:sns:EXAMPLE",
                    "Subject": "TestInvoke"
                }
                }
            ]
            }"""

            payload = json.loads(lambdaEvent)
            payload['Records'][0]['Sns']['Message'] = '{\"create-time\": \"Intial Seed\", \"synctoken\": \"0123456789\", \"md5\": \"seed\", \"url\": \"https://ip-ranges.amazonaws.com/ip-ranges.json\"}'

            response = client.invoke(
                FunctionName=event['ResourceProperties']['LambdaARN'],
                InvocationType='Event',
                Payload=json.dumps(payload).encode()
            )
            logging.info(response)
        
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {}, resource_id)
    except Exception as e:
        logging.exception(e)
        # cfnresponse's error message is always "see CloudWatch"
        cfnresponse.send(event, context, cfnresponse.FAILED, {}, resource_id)