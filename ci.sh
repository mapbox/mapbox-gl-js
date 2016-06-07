#!/usr/bin/env bash

set -e
set -o pipefail

# add npm packages to $PATH
export PATH=$(pwd)/node_modules/.bin:$PATH

# set up code coverage instrumentation
rm -rf coverage .nyc_output

# run linters
npm run lint

# run unit tests
npm run build-min
tap --reporter dot --coverage --no-coverage-report test/js/*/*.js

# allow writing core files for render tests
ulimit -c unlimited -S
echo 'ulimit -c: '`ulimit -c`
echo '/proc/sys/kernel/core_pattern: '`cat /proc/sys/kernel/core_pattern`
sysctl kernel.core_pattern

# run render tests
istanbul cover --dir .nyc_output --include-pid --report none --print none test/render.test.js &&
istanbul cover --dir .nyc_output --include-pid --report none --print none test/query.test.js
EXIT_CODE=$?

# collect core dumps from render tests
if [[ ${EXIT_CODE} != 0 ]]; then
    echo "The program crashed with exit code ${EXIT_CODE}. We're now trying to output the core dump."
fi
for DUMP in $(find ./ -maxdepth 1 -name 'core*' -print); do
    gdb `which node` ${DUMP} -ex "thread apply all bt" -ex "set pagination 0" -batch
    rm -rf ${DUMP}
done

# send coverage report to coveralls
nyc report --reporter=lcov
(node ./node_modules/coveralls/bin/coveralls.js < ./coverage/lcov.info) || true

# return original error code
if [[ ${EXIT_CODE} != 0 ]]; then
    exit $EXIT_CODE
fi
