#!/bin/bash

set -eu

TAG=$CIRCLE_TAG

# put awscli on PATH
PATH=$(python -m site --user-base)/bin:${PATH}

if [ -z $TAG ]; then
    echo '$CIRCLE_TAG must be set'
    exit 1
fi

function upload {
  aws s3 cp --acl public-read --content-type $2 ../dist/$1 s3://mapbox-gl-js/$TAG/$1
  echo "upload: dist/$1 to s3://mapbox-gl-js/$TAG/$1"
}

cnregions="
cn-north-1
"

function cn_upload {
  for region in cnregions; do
    aws s3 cp --region $region --acl public-read --content-type $2 ../dist/$1 s3://mapbox-gl-js-$region/$TAG/$1
    echo "upload: dist/$1 to s3://mapbox-gl-js-$region/$TAG/$1"
  done
}

pip install --user --upgrade awscli

npm run build-dev
npm run build-min

upload mapbox-gl.js     application/javascript
upload mapbox-gl.js.map application/octet-stream
upload mapbox-gl-dev.js application/javascript
upload mapbox-gl.css    text/css

export AWS_ACCESS_KEY_ID=$AWSCN_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$AWSCN_SECRET_ACCESS_KEY
cn_upload mapbox-gl.js     application/javascript
cn_upload mapbox-gl.js.map application/octet-stream
cn_upload mapbox-gl-dev.js application/javascript
cn_upload mapbox-gl.css    text/css
