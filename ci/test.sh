#!/usr/bin/env bash

source ./nvm/nvm.sh
nvm use ${NODE_VERSION}

set -e
set -o pipefail

# add npm packages to $PATH
PATH=$(pwd)/node_modules/.bin:$PATH

# add python packages to $PATH
PATH=$(python -m site --user-base)/bin:${PATH}

# set up code coverage instrumentation
rm -rf coverage .nyc_output

# run linters
npm run lint
npm run lint-docs

# build and run build tests
npm run build-min
npm run build-dev

# run unit, render & query tests with coverage
npm run test-cov

# send coverage report to coveralls
nyc report --reporter=lcov
# this code works around a Coveralls / CircleCI bug triggered by tagged builds
if [ -z "$CIRCLE_TAG" ]; then
    (node ./node_modules/coveralls/bin/coveralls.js < ./coverage/lcov.info) || true
fi

# upload benchmarks
if [ "$CIRCLE_BRANCH" == "master" ]; then
    npm run build-benchmarks
    aws s3 cp --acl public-read --content-type application/javascript bench/benchmarks_generated.js s3://mapbox-gl-js/master/benchmarks.js
fi
