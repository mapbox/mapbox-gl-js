set -e
set -o pipefail

git fetch --prune

# add npm packages to $PATH
PATH=$(pwd)/node_modules/.bin:$PATH

# add python packages to $PATH
PATH=$(python -m site --user-base)/bin:${PATH}

# set up code coverage instrumentation
rm -rf coverage .nyc_output

# run linters
yarn run lint
yarn run lint-docs
yarn run lint-css

# build and run build tests
yarn run build-min
yarn run build-dev

# run flow to check types
yarn run test-flow

# run unit, render & query tests with coverage
xvfb-run --server-args="-screen 0 1024x768x24" npm run test-cov

# send coverage report to coveralls
nyc report --reporter=lcov

# this code works around a Coveralls / CircleCI bug triggered by tagged builds
if [ -z "$CIRCLE_TAG" ]; then
    (node ./node_modules/coveralls/bin/coveralls.js < ./coverage/lcov.info) || true
fi

# upload benchmarks
if [ "$CIRCLE_BRANCH" == "master" ]; then
    yarn run build-benchmarks
    aws s3 cp --acl public-read --content-type application/javascript bench/benchmarks_generated.js s3://mapbox-gl-js/master/benchmarks.js
fi
