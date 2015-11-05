#!/bin/bash

set -e

TAG=$CIRCLE_TAG

if [ -z $TAG ]; then
    echo '$CIRCLE_TAG must be set'
    exit 1
fi

function gzipped_cp {
    gzip --stdout dist/$1 | aws s3 cp --acl public-read --cache-control max-age=2592000 --content-encoding gzip --content-type $2 - s3://mapbox/mapbox-gl-js/$TAG/$1
    echo "upload: dist/$1 to s3://mapbox/mapbox-gl-js/$TAG/$1 (gzipped)"
}

gzipped_cp mapbox-gl.js     application/javascript
gzipped_cp mapbox-gl.js.map application/octet-stream
gzipped_cp mapbox-gl-dev.js application/javascript
gzipped_cp mapbox-gl.css    text/css
