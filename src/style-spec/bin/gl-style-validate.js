#!/usr/bin/env node
/* eslint-disable no-process-exit */

import fs from 'fs';
import {parseArgs} from 'util';
import {validate, validateMapboxApiSupported} from '@mapbox/mapbox-gl-style-spec';

const {values: argv, positionals} = parseArgs({
    options: {
        json: {type: 'boolean'},
        'mapbox-api-supported': {type: 'boolean'},
        help: {type: 'boolean', short: 'h'}
    },
    allowPositionals: true
});

let status = 0;

if (argv.help || (!positionals.length && process.stdin.isTTY)) {
    help();
    process.exit(status);
}

const files = positionals.length ? positionals : [0];

files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const errors = argv['mapbox-api-supported'] ?
        validateMapboxApiSupported(source) :
        validate(source);
    if (errors.length) {
        if (argv.json) {
            process.stdout.write(JSON.stringify(errors, null, 2));
        } else {
            errors.forEach((e) => {
                console.log('%s:%d: %s', file, e.line, e.message);
            });
        }
        status = 1;
    }
});

process.exit(status);

function help() {
    console.log('usage:');
    console.log('  gl-style-validate file.json');
    console.log('  gl-style-validate < file.json');
    console.log('');
    console.log('options:');
    console.log('--json  output errors as json');
    console.log('--mapbox-api-supported  validate compatibility with Mapbox Styles API');
}
