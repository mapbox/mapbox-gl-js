#!/usr/bin/env node
/* eslint-disable no-process-exit */
/* eslint import/no-unresolved: [error, { ignore: ['^@mapbox/mapbox-gl-style-spec$'] }] */

import fs from 'fs';
import minimist from 'minimist';
import {format, composite} from '@mapbox/mapbox-gl-style-spec';

const argv = minimist(process.argv.slice(2));

if (argv.help || argv.h || (!argv._.length && process.stdin.isTTY)) {
    help();
    process.exit(0);
}

console.log(format(composite(JSON.parse(fs.readFileSync(argv._[0])))));

function help() {
    console.log('usage:');
    console.log('  gl-style-composite style.json');
}
