#!/bin/bash
set -e

DEST="$(cd "$(dirname "$0")" && pwd)"
cd "$DEST/../.."

if [ ! -f dist/mapbox-gl.js ] || [ ! -d dist/esm ] || [ ! -d dist/style-spec ]; then
  echo "pack.sh: dist/ artifacts missing. Run build-dev, build-prod, build-esm-prod, build-csp, build-css, build-style-spec, build-dts first." >&2
  exit 1
fi

if [ -f "$DEST/mapbox-gl.tgz" ] && [ -f "$DEST/mapbox-gl-style-spec.tgz" ] \
   && [ "$DEST/mapbox-gl.tgz" -nt dist/mapbox-gl.js ] \
   && [ "$DEST/mapbox-gl-style-spec.tgz" -nt dist/style-spec/index.cjs ]; then
  exit 0
fi

rm -f "$DEST"/mapbox-gl-*.tgz "$DEST"/mapbox-mapbox-gl-style-spec-*.tgz

npm pack --pack-destination "$DEST"
npm pack --pack-destination "$DEST" --workspace src/style-spec

mv -f "$DEST"/mapbox-gl-[0-9]*.tgz "$DEST/mapbox-gl.tgz"
mv -f "$DEST"/mapbox-mapbox-gl-style-spec-*.tgz "$DEST/mapbox-gl-style-spec.tgz"
