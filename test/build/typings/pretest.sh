#!/bin/bash
set -e

../pack.sh
rm -rf node_modules/mapbox-gl node_modules/@mapbox/mapbox-gl-style-spec
npm install --no-save ../mapbox-gl.tgz ../mapbox-gl-style-spec.tgz
