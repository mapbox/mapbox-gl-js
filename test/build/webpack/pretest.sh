#!/bin/bash
set -e

../pack.sh
rm -rf node_modules/mapbox-gl
npm install --no-save ../mapbox-gl.tgz
