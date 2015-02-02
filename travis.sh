#!/usr/bin/env bash

set -e
set -o pipefail

sudo apt-get -y install gdb

npm test

git submodule update --init .mason
PATH=`pwd`/.mason:$PATH
export MASON_DIR=`pwd`/.mason
mason install mesa 10.4.3
export LD_LIBRARY_PATH=`mason prefix mesa 10.4.3`/lib:$LD_LIBRARY_PATH

# allow writing core files
ulimit -c unlimited -S
echo 'ulimit -c: '`ulimit -c`
echo '/proc/sys/kernel/core_pattern: '`cat /proc/sys/kernel/core_pattern`

if [[ ${TRAVIS_OS_NAME} == "linux" ]]; then
    sysctl kernel.core_pattern
fi

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

# now we should present travis with the original
# error code so the run cleanly stops
if [[ ${RESULT} != 0 ]]; then
    exit $RESULT
fi

if [ ! -z "${AWS_ACCESS_KEY_ID}" ] && [ ! -z "${AWS_SECRET_ACCESS_KEY}" ] ; then
    (cd ./node_modules/mapbox-gl-test-suite/ && ./bin/deploy_results.sh)
fi
