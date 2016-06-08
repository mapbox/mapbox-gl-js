#!/bin/bash

set -eu

TAG=$CIRCLE_TAG

if [ -z $TAG ]; then
    echo '$CIRCLE_TAG must be set'
    exit 1
fi

function upload {
    aws s3 cp --acl public-read --content-type $2 dist/$1 s3://mapbox-gl-js/$TAG/$1
    echo "upload: dist/$1 to s3://mapbox-gl-js/$TAG/$1"
}

npm run build-dev
npm run build-min

upload mapbox-gl.js     application/javascript
upload mapbox-gl.js.map application/octet-stream
upload mapbox-gl-dev.js application/javascript
upload mapbox-gl.css    text/css
