#!/usr/bin/env node
/* eslint-disable no-process-exit */

import fs from 'fs';
import {parseArgs} from 'util';
import {format} from '@mapbox/mapbox-gl-style-spec';

const {values: argv, positionals} = parseArgs({
    options: {
        space: {type: 'string'},
        help: {type: 'boolean', short: 'h'}
    },
    allowPositionals: true
});

if (argv.help || (!positionals.length && process.stdin.isTTY)) {
    help();
    process.exit(0);
}

console.log(format(JSON.parse(fs.readFileSync(positionals[0]).toString()), argv.space ? Number(argv.space) : undefined));

function help() {
    console.log('usage:');
    console.log('  gl-style-format source.json > destination.json');
    console.log('');
    console.log('options:');
    console.log('  --space <num>');
    console.log('     Number of spaces in output (default "2")');
    console.log('     Pass "0" for minified output.');
}
