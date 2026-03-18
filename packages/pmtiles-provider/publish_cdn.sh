#!/bin/bash
# Uploads the PMTiles provider bundle to the CDN (S3).
#
# Usage:
#   ./publish_cdn.sh
#   ./publish_cdn.sh --dry-run

set -e

version=$(node -p "require('./package.json').version")
dist="dist"
s3_prefix="s3://mapbox-gl-js/mapbox-gl-pmtiles-provider-v${version}"
cache="public, max-age=31536000, immutable"

if [ "$1" != "--dry-run" ]; then
	for f in "$dist/mapbox-gl-pmtiles-provider.js" "$dist/mapbox-gl-pmtiles-provider.js.map"; do
		[ -f "$f" ] || { echo "Error: $f missing. Run: npm run build"; exit 1; }
	done

	aws s3 cp --acl public-read --content-type "application/javascript" --cache-control "$cache" "$dist/mapbox-gl-pmtiles-provider.js" "$s3_prefix.js"
	aws s3 cp --acl public-read --content-type "application/octet-stream" --cache-control "$cache" "$dist/mapbox-gl-pmtiles-provider.js.map" "$s3_prefix.js.map"
else
	echo "aws s3 cp ... $dist/mapbox-gl-pmtiles-provider.js $s3_prefix.js"
	echo "aws s3 cp ... $dist/mapbox-gl-pmtiles-provider.js.map $s3_prefix.js.map"
fi

echo "Published PMTiles provider v${version} to CDN"
