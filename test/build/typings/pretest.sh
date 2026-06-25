#!/bin/bash
set -e

DEST="$(cd "$(dirname "$0")" && pwd)"
TARBALL_DIR="$DEST/.."

"$TARBALL_DIR/pack.sh"

ISO_DIR="$(mktemp -d)"
trap "rm -rf '$ISO_DIR'" EXIT

cp "$DEST"/package.json \
   "$DEST"/tsconfig.json \
   "$DEST"/tsconfig.strict.json \
   "$DEST"/*.ts \
   "$ISO_DIR/"

cd "$ISO_DIR"
npm install --no-save "$TARBALL_DIR/mapbox-gl.tgz"
npm run tsc:strict

cd "$DEST"
rm -rf node_modules/mapbox-gl node_modules/@mapbox/mapbox-gl-style-spec
npm install --no-save "$TARBALL_DIR/mapbox-gl.tgz" "$TARBALL_DIR/mapbox-gl-style-spec.tgz"
