#!/usr/bin/env bash

set -e
set -o pipefail

# add npm packages to $PATH
export PATH=$(pwd)/node_modules/.bin:$PATH

# run linters
npm run lint

# run unit tests
tap --reporter dot test/js/*/*.js

# allow writing core files for render tests
ulimit -c unlimited -S
echo 'ulimit -c: '`ulimit -c`
echo '/proc/sys/kernel/core_pattern: '`cat /proc/sys/kernel/core_pattern`
sysctl kernel.core_pattern

# run render tests
node test/render.test.js && node test/query.test.js
EXIT_CODE=$?

# collect core dumps from render tests
if [[ ${EXIT_CODE} != 0 ]]; then
    echo "The program crashed with exit code ${EXIT_CODE}. We're now trying to output the core dump."
fi
for DUMP in $(find ./ -maxdepth 1 -name 'core*' -print); do
    gdb `which node` ${DUMP} -ex "thread apply all bt" -ex "set pagination 0" -batch
    rm -rf ${DUMP}
done

# return original error code
if [[ ${EXIT_CODE} != 0 ]]; then
    exit $EXIT_CODE
fi
