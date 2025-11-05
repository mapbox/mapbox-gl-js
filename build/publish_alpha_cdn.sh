#!/bin/bash

dry_run=false

if [ "$1" = "--help" ]; then
    echo "usage: $0"
    echo "Uploads current build to CDN as alpha version in format v<semver>-alpha.<sha>"
    exit 0
fi

for arg in "$@"; do
    if [[ "$arg" == "--dry-run" ]]; then
        dry_run=true
    fi
done

sha=$(git rev-parse --short HEAD)
version=$(node -e 'console.log(require("./package.json").version)')
next_version=$(npx semver $version -i minor)
version=v$next_version-alpha.$sha

echo "Publishing $version to CDN"

if [[ $dry_run == false ]]; then
    ./build/publish_cdn.sh $version
else
    ./build/publish_cdn.sh $version --dry-run
fi
