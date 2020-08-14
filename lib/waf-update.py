# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import urllib.parse
import urllib.error
import urllib.request
import os
import logging
import json
import hashlib
import boto3


def lambda_handler(event, context):
    # Set up logging
    if len(logging.getLogger().handlers) > 0:
        logging.getLogger().setLevel(logging.ERROR)
    else:
        logging.basicConfig(level=logging.DEBUG)

    # Set the environment variable DEBUG to 'true' if you want verbose debug details in CloudWatch Logs.
    try:
        if os.environ['DEBUG'] == 'true':
            logging.getLogger().setLevel(logging.INFO)
    except KeyError:
        pass

    try:
        # If you want a different service, set the SERVICE environment variable.
        # It defaults to CLOUDFRONT. Using 'jq' and 'curl' get the list of possible
        # services like this:
        # curl -s 'https://ip-ranges.amazonaws.com/ip-ranges.json' | jq -r '.prefixes[] | .service' ip-ranges.json | sort -u
        SERVICE = os.getenv('SERVICE', "CLOUDFRONT")

        message = json.loads(event['Records'][0]['Sns']['Message'])

        # Load the ip ranges from the url
        ip_ranges = json.loads(get_ip_groups_json(message['url'], message['md5']))

        # Extract the service ranges
        # global_cf_ranges = get_ranges_for_service(ip_ranges, SERVICE, "GLOBAL")
        # region_cf_ranges = get_ranges_for_service(ip_ranges, SERVICE, "REGION")
        all_cf_ranges = get_ranges_for_service(ip_ranges, SERVICE)

        # Update the IP set
        result = update_ip_set(SERVICE, message['create-time'], all_cf_ranges)

        return result

    except Exception as e:
        logging.exception(e)
        raise e
    


def get_ip_groups_json(url, expected_hash):

    logging.debug("Updating from " + url)

    response = urllib.request.urlopen(url)
    ip_json = response.read()

    if expected_hash == 'seed':
        logging.info('hash set to seed, bypassing md5 check')
        return ip_json

    m = hashlib.md5()
    m.update(ip_json)
    hash = m.hexdigest()

    if hash != expected_hash:
        raise Exception('MD5 Mismatch: got ' + hash +
                        ' expected ' + expected_hash)

    return ip_json


def get_ranges_for_service(ranges, service):

    service_ranges = list()
    for prefix in ranges['prefixes']:
        if prefix['service'] == service:
            logging.info(('Found ' + service + ' region: ' +
                          prefix['region'] + ' range: ' + prefix['ip_prefix']))
            service_ranges.append(prefix['ip_prefix'])

    return service_ranges


def update_ip_set(service, time, ranges):
    client = boto3.client('wafv2')

    ip_set_list = client.list_ip_sets(
        Scope='REGIONAL'
    )

    ip_set_name = os.environ['IPSET_NAME']
    ip_set_description = 'IP Address ranges for service ' + service + ' as of ' + time

    for ipset in ip_set_list['IPSets']:
        if ipset['Name'] != ip_set_name:
            continue
        ipset_id = ipset['Id']
        ipset_lock = ipset['LockToken']
        break

    response = client.update_ip_set(
        Name=ip_set_name,
        Scope='REGIONAL',
        Id=ipset_id,
        Description=ip_set_description,
        Addresses=ranges,
        LockToken=ipset_lock
    )
    return response