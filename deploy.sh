#!/bin/bash

set -e

TAG=$1

if [ -z $TAG ]; then
    echo "Usage: deploy.sh <tag>"
    exit
fi

function gzipped_cp {
    gzip --stdout dist/$1 | aws s3 cp --acl public-read --content-encoding gzip --content-type $2 - s3://mapbox/mapbox-gl-js/$TAG/$1
    echo "upload: dist/$1 to s3://mapbox/mapbox-gl-js/$TAG/$1 (gzipped)"
}

gzipped_cp mapbox-gl.js     application/javascript
gzipped_cp mapbox-gl.js.map application/octet-stream
gzipped_cp mapbox-gl-dev.js application/javascript
gzipped_cp mapbox-gl.css    text/css

aws s3 cp --recursive --acl public-read dist/images/ s3://mapbox/mapbox-gl-js/$1/images/
