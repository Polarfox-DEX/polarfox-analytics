#!/bin/bash

S3_BUCKET_NAME=$1
CF_ID=$2

# Build app
yarn install --force
yarn build

# Sync all files except for service-worker and index
echo "Uploading files to $S3_BUCKET_NAME..."
aws s3 sync build s3://$S3_BUCKET_NAME/ \
  --exclude service-worker.js \
  --exclude index.html

# Upload service-worker.js with directive to not cache it
echo "Uploading service-worker.js"
aws s3 cp build/service-worker.js s3://$S3_BUCKET_NAME/service-worker.js \
  --metadata-directive REPLACE \
  --cache-control max-age=0,no-cache,no-store,must-revalidate \
  --content-type application/javascript

# Upload index.html
echo "Uploading index.html"
aws s3 cp build/index.html s3://$S3_BUCKET_NAME/index.html \
  --metadata-directive REPLACE \
  --cache-control max-age=0,no-cache,no-store,must-revalidate \
  --content-type text/html

# Purge the cloudfront cache
echo "Purging the cache for CloudFront (BE PATIENT!)"
aws cloudfront create-invalidation \
  --distribution-id $CF_ID \
  --paths / |
  jq ".Invalidation.Id" -r |
  aws cloudfront wait invalidation-completed \
    --distribution-id $CF_ID \
    --id "$(cat)"
