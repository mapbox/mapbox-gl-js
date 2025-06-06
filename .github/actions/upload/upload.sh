#!/bin/bash
set -e

file_name=$(basename "$FILE_PATH")
artifact_url="${ARTIFACTS_BASE_URL}/${GITHUB_REF_NAME}/${GITHUB_JOB}${SHARD:+-$SHARD}/${file_name}"

if [ -f "$FILE_PATH" ]; then
  aws s3 cp --content-type "$CONTENT_TYPE" "$FILE_PATH" "s3://$artifact_url"
else
  aws s3 cp --recursive --exclude "*.gz" "$FILE_PATH" "s3://$artifact_url"
  aws s3 cp --recursive --exclude "*" --include "*.gz" --content-type "application/gzip" --content-encoding "" "$FILE_PATH" "s3://$artifact_url"
fi

echo "artifact-url=https://$artifact_url" >> $GITHUB_OUTPUT
