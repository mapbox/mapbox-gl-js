#!/bin/bash

set -eu

if [ -z $CIRCLE_TAG ]; then
    echo '$CIRCLE_TAG must be set'
    exit 1
fi

function upload {
    aws s3 cp --acl public-read --content-type $2 dist/$1 s3://mapbox-gl-js/$CIRCLE_TAG/$1
    echo "upload: dist/$1 to s3://mapbox-gl-js/$CIRCLE_TAG/$1"
}

function cn_upload {
    aws s3 cp --region cn-north-1 --acl public-read --content-type $2 dist/$1 s3://mapbox-gl-js-cn-north-1/$CIRCLE_TAG/$1
    echo "upload: dist/$1 to s3://mapbox-gl-js-cn-north-1/$CIRCLE_TAG/$1"
}

# add python packages to $PATH
PATH=$(python -m site --user-base)/bin:${PATH}

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
