#!/bin/bash
# Uploads the WebMCP plugin bundles to the CDN (S3).
#
# Usage:
#   ./publish_cdn.sh
#   ./publish_cdn.sh --dry-run

set -e

version=$(node -p "require('./package.json').version")
dist="dist"
s3_prefix="s3://mapbox-gl-js/plugins/mapbox-gl-webmcp/v${version}"
cache="public, max-age=31536000, immutable"
names="mapbox-gl-webmcp.js tools.js"
run=""
[ "$1" = "--dry-run" ] && run=echo

for name in $names; do
	for f in "$dist/$name" "$dist/$name.map"; do
		[ -f "$f" ] || { echo "Error: $f missing. Run: npm run build"; exit 1; }
	done
done

for name in $names; do
	$run aws s3 cp --acl public-read --content-type "application/javascript" --cache-control "$cache" "$dist/$name" "$s3_prefix/$name"
	$run aws s3 cp --acl public-read --content-type "application/octet-stream" --cache-control "$cache" "$dist/$name.map" "$s3_prefix/$name.map"
done

[ -n "$run" ] || echo "Published WebMCP plugin v${version} to CDN"
