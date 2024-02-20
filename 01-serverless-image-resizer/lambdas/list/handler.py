import json
import os
import typing

import boto3

if typing.TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client
    from mypy_boto3_ssm import SSMClient

endpoint_url = os.getenv("AWS_ENDPOINT_URL")

s3: "S3Client" = boto3.client("s3", endpoint_url=endpoint_url)
ssm: "SSMClient" = boto3.client("ssm", endpoint_url=endpoint_url)


def get_bucket_name_images() -> str:
    parameter = ssm.get_parameter(Name="/localstack-thumbnail-app/buckets/images")
    return parameter["Parameter"]["Value"]


def get_bucket_name_resized() -> str:
    parameter = ssm.get_parameter(Name="/localstack-thumbnail-app/buckets/resized")
    return parameter["Parameter"]["Value"]


def handler(event, context):
    images_bucket = get_bucket_name_images()
    images = s3.list_objects(Bucket=images_bucket)

    result = {}
    # collect the original images
    for obj in images.get("Contents", []):
        result[obj["Key"]] = {
            "Name": obj["Key"],
            "Timestamp": obj["LastModified"].isoformat(),
            "Original": {
                "Size": obj["Size"],
                "URL": s3.generate_presigned_url(
                    ClientMethod="get_object",
                    Params={"Bucket": images_bucket, "Key": obj["Key"]},
                    ExpiresIn=3600,
                ),
            },
        }

    # collect the associated resized images
    resized_bucket = get_bucket_name_resized()
    images = s3.list_objects(Bucket=resized_bucket)
    for obj in images.get("Contents", []):
        if obj["Key"] not in result:
            continue
        result[obj["Key"]]["Resized"] = {
            "Size": obj["Size"],
            "URL": s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": resized_bucket, "Key": obj["Key"]},
                ExpiresIn=3600,
            ),
        }

    result = list(sorted(result.values(), key=lambda k: k["Timestamp"], reverse=True))

    if "routeKey" in event:
        # looks like an API Gateway event -> convert to JSON string
        result = json.dumps(result)

    # Note: modify result here, to test Lambda hot reloading. For example, uncomment the following code:
    # result = []
    # result.append({"Name": "Test Entry", "Original": {}, "Resized": {"URL":"https://localstack.cloud/images/header-logo-new.svg"}})

    return result


if __name__ == "__main__":
    print(handler(None, None))
