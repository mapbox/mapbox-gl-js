#!/usr/bin/env node
/* eslint-disable no-process-exit */

import fs from 'fs';
import minimist from 'minimist';
import {format} from '@mapbox/mapbox-gl-style-spec';

const argv = minimist(process.argv.slice(2));

if (argv.help || argv.h || (!argv._.length && process.stdin.isTTY)) {
    help();
    process.exit(0);
}

console.log(format(JSON.parse(fs.readFileSync(argv._[0]).toString()), argv.space));

function help() {
    console.log('usage:');
    console.log('  gl-style-format source.json > destination.json');
    console.log('');
    console.log('options:');
    console.log('  --space <num>');
    console.log('     Number of spaces in output (default "2")');
    console.log('     Pass "0" for minified output.');
}
