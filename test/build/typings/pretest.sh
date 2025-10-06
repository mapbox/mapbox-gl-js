#!/bin/bash

set -e

pushd ../../../
npm run build-dts
npm run build-style-spec

npm pack --pack-destination test/build/typings
npm pack --pack-destination test/build/typings --workspace src/style-spec

popd
mv mapbox-gl-*.tgz mapbox-gl.tgz
mv mapbox-mapbox-gl-style-spec-*.tgz mapbox-gl-style-spec.tgz

npm install --no-save mapbox-gl.tgz mapbox-gl-style-spec.tgz
rm *.tgz
