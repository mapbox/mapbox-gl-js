#!/bin/bash
# This file uploads the necessary build files to s3
# which enables them to be served by our CDN.
# To run locally, you must be logged into AWS,
# have built the needed files and pass the tag.
# To build files:
# yarn run build-prod-min && yarn run build-prod && yarn run build-csp && yarn run build-dev && yarn run build-css
# The tag should be in the form of vx.x.x:
# ./upload.sh v2.0.0

# use $CIRCLE_TAG on CircleCI
# else a tag must be supplied by user
if [ -n "$CIRCLE_TAG" ]
then
	tag=$CIRCLE_TAG
elif [ -n "$1" ]
then
	tag=$1
else
	echo "Error: A tag must be set to upload to s3. If running this script manually, pass the tag as an argument: ./upload.sh vx.x.x"
	exit 1;
fi

declare -a files=(
    "mapbox-gl.js"
    "mapbox-gl.js.map"
    "mapbox-gl-dev.js"
    "mapbox-gl.css"
    "mapbox-gl-unminified.js"
    "mapbox-gl-unminified.js.map"
    "mapbox-gl-csp.js"
    "mapbox-gl-csp.js.map"
    "mapbox-gl-csp-worker.js"
    "mapbox-gl-csp-worker.js.map"
)

for i in "${files[@]}"
do
	file=$i
	# separate the file name on the "."
	isjs=$(echo $file | cut -d. -f2)
	ismap=$(echo $file | cut -d. -f3)

	if [ "$isjs" = "js" ]
	then
		mimetype="application/javascript"
		if [ -n "$ismap" ]
		then
			mimetype="application/octet-stream"
		fi
	else
		mimetype="text/css"
	fi

	aws s3 cp --acl public-read --content-type ${mimetype} dist/${file} s3://mapbox-gl-js/${tag}/${file}
done