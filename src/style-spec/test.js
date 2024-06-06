#!/usr/bin/env node
/* eslint-disable no-process-exit */

import fs from 'fs';
import {execSync} from 'child_process';
import {createRequire} from 'module';

// @ts-expect-error - TS2345 - Argument of type 'Buffer' is not assignable to parameter of type 'string'.
const packageJson = JSON.parse(fs.readFileSync('./package.json'));

process.on('unhandledRejection', (error) => {
    // don't log `error` directly, because errors from child_process.execSync
    // contain an (undocumented) `envPairs` with environment variable values
    // @ts-expect-error - TS2339 - Property 'message' does not exist on type 'unknown'.
    console.log(error.message || 'unhandledRejection');
    process.exit(1);
});

const require = createRequire(import.meta.url);
const stylePath = require.resolve('mapbox-gl-styles/styles/basic-v9.json');

try {
    for (const bin in packageJson.bin) {
        const script = packageJson.bin[bin];
        const command = [script, stylePath].join(' ');

        console.log(command);
        execSync(command).toString();
    }
} catch (error) {
    console.log(error.message);
    process.exit(1);
}
