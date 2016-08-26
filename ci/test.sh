#!/usr/bin/env bash

source ./nvm/nvm.sh
nvm use ${NODE_VERSION}

set -eu
set -o pipefail

# add npm packages to $PATH
PATH=$(pwd)/node_modules/.bin:$PATH

# add python packages to $PATH
PATH=$(python -m site --user-base)/bin:${PATH}

# set up code coverage instrumentation
rm -rf coverage .nyc_output

# run linters
npm run lint

# build and run build tests
npm run build-min
npm run build-dev

# run unit tests
tap --reporter dot --coverage --no-coverage-report test/js test/build/webpack.test.js

# run render tests
istanbul cover --dir .nyc_output --include-pid --report none --print none test/render.test.js
istanbul cover --dir .nyc_output --include-pid --report none --print none test/query.test.js

# send coverage report to coveralls
nyc report --reporter=lcov
(node ./node_modules/coveralls/bin/coveralls.js < ./coverage/lcov.info) || true

# upload benchmark
if [ "$CIRCLE_BRANCH" == "master" ] || [ "$CIRCLE_BRANCH" == "benchmark-master" ]; then
    npm run build-benchmarks
    aws s3 cp --acl public-read --content-type  dist/benchmarks_generated.js s3://mapbox-gl-js/master/benchmarks.js
fi
