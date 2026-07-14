#!/bin/bash
set -e

cd "$(dirname "$0")"

npm run build -w @mapbox/mapbox-gl-pmtiles-provider --prefix ../../..
../pack.sh
rm -rf node_modules/mapbox-gl
npm install --no-save ../mapbox-gl.tgz
