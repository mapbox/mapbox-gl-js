#!/usr/bin/env node

import fs from 'fs';
import {execSync} from 'child_process';
import {createRequire} from 'module';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const packageJson = JSON.parse(fs.readFileSync('./package.json').toString());

process.on('unhandledRejection', (/** @type {Error} */ error) => {
    // don't log `error` directly, because errors from child_process.execSync
    // contain an (undocumented) `envPairs` with environment variable values
    console.log(error.message || 'unhandledRejection');
    process.exit(1);
});

const require = createRequire(import.meta.url);
const stylePath = require.resolve('mapbox-gl-styles/styles/basic-v9.json');

try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (const bin in packageJson.bin) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const script = packageJson.bin[bin];
        const command = [script, stylePath].join(' ');

        console.log(command);
        execSync(command).toString();
    }
} catch (error) {
    console.log(/** @type {Error} */ (error).message);
    process.exit(1);
}
