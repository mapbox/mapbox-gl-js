#!/usr/bin/env node
/* eslint-disable import/no-unresolved, no-process-exit */

import rw from 'rw';
import minimist from 'minimist';
import {validate, validateMapboxApiSupported} from '../dist/index.es.js';

const argv = minimist(process.argv.slice(2), {
    boolean: ['json', 'mapbox-api-supported'],
});

let status = 0;

if (argv.help || argv.h || (!argv._.length && process.stdin.isTTY)) {
    help();
    process.exit(status);
}

if (!argv._.length) {
    argv._.push('/dev/stdin');
}

argv._.forEach((file) => {
    let errors = [];
    if (argv['mapbox-api-supported']) {
        errors = validateMapboxApiSupported(rw.readFileSync(file, 'utf8'));
    } else {
        errors = validate(rw.readFileSync(file, 'utf8'));
    }
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
