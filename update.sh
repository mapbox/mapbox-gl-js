#!/bin/bash

set -e

TAG=$1

if [ -z $TAG ]; then
    echo "Usage: update.sh <tag>"
    exit
fi

aws s3 cp s3://mapbox/mapbox-gl-js/$TAG/ s3://mapbox/mapbox-gl-js/$TAG/ --recursive \
  --exclude "*" --include "*.js" --metadata-directive REPLACE \
  --acl public-read --cache-control max-age=2592000 --content-encoding gzip --content-type application/javascript

aws s3 cp s3://mapbox/mapbox-gl-js/$TAG/ s3://mapbox/mapbox-gl-js/$TAG/ --recursive \
  --exclude "*" --include "*.css" --metadata-directive REPLACE \
  --acl public-read --cache-control max-age=2592000 --content-encoding gzip --content-type text/css

aws s3 cp s3://mapbox/mapbox-gl-js/$TAG/ s3://mapbox/mapbox-gl-js/$TAG/ --recursive \
  --exclude "*" --include "*.map" --metadata-directive REPLACE \
  --acl public-read --cache-control max-age=2592000 --content-encoding gzip --content-type application/octet-stream

aws s3 cp s3://mapbox/mapbox-gl-js/$TAG/font/ s3://mapbox/mapbox-gl-js/$TAG/font/ --recursive \
  --metadata-directive REPLACE \
  --acl public-read --cache-control max-age=2592000
