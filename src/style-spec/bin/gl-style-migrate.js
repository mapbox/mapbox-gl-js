#!/usr/bin/env node

// @flow
/* eslint-disable no-process-exit */

import fs from 'fs';
import minimist from 'minimist';

/* eslint import/no-unresolved: [error, { ignore: ['^@mapbox/mapbox-gl-style-spec$'] }] */
/* $FlowFixMe[cannot-resolve-module] */
import {format, migrate} from '@mapbox/mapbox-gl-style-spec';

const argv = minimist(process.argv.slice(2));

if (argv.help || argv.h || (!argv._.length && process.stdin.isTTY)) {
    help();
    process.exit(0);
}

console.log(format(migrate(JSON.parse(fs.readFileSync(argv._[0]).toString()))));

function help() {
    console.log('usage:');
    console.log('  gl-style-migrate source.json > destination.json');
}
