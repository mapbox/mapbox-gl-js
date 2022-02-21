#!/usr/bin/env node
/* eslint-disable import/no-unresolved, no-process-exit */

import fs from 'fs';
import minimist from 'minimist';
import {format, composite} from '../dist/index.es.js';

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
