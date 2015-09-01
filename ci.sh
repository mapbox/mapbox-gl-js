#!/usr/bin/env bash

set -e
set -o pipefail

npm test

# allow writing core files
ulimit -c unlimited -S
echo 'ulimit -c: '`ulimit -c`
echo '/proc/sys/kernel/core_pattern: '`cat /proc/sys/kernel/core_pattern`
sysctl kernel.core_pattern

RESULT=0
npm run test-suite || RESULT=$?

if [[ ${RESULT} != 0 ]]; then
    echo "The program crashed with exit code ${RESULT}. We're now trying to output the core dump."
fi

# output core dump if we got one
for DUMP in $(find ./ -maxdepth 1 -name 'core*' -print); do
    gdb `which node` ${DUMP} -ex "thread apply all bt" -ex "set pagination 0" -batch
    rm -rf ${DUMP}
done

# now we should present the original error code so the run cleanly stops
if [[ ${RESULT} != 0 ]]; then
    exit $RESULT
fi
