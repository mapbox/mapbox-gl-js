#!/usr/bin/env node
/* eslint-disable no-process-exit */

import fs from 'fs';
import {parseArgs} from 'util';
import {format, migrate} from '@mapbox/mapbox-gl-style-spec';

const {values: argv, positionals} = parseArgs({
    options: {
        help: {type: 'boolean', short: 'h'}
    },
    allowPositionals: true
});

if (argv.help || (!positionals.length && process.stdin.isTTY)) {
    help();
    process.exit(0);
}

console.log(format(migrate(JSON.parse(fs.readFileSync(positionals[0]).toString()))));

function help() {
    console.log('usage:');
    console.log('  gl-style-migrate source.json > destination.json');
}
