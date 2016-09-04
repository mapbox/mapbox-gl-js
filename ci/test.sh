#!/usr/bin/env bash

source ./nvm/nvm.sh
nvm use ${NODE_VERSION}

set -eu
set -o pipefail

# add npm packages to $PATH
PATH=$(pwd)/node_modules/.bin:$PATH

# set up code coverage instrumentation
rm -rf coverage .nyc_output

# run linters
npm run lint

# build and run build tests
npm run build-min
npm run build-dev

# run unit, render & query tests with coverage
npm run test-cov

# send coverage report to coveralls
nyc report --reporter=lcov
(node ./node_modules/coveralls/bin/coveralls.js < ./coverage/lcov.info) || true
