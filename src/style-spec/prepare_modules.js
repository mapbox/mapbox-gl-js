#!/usr/bin/env node
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import glob from 'glob';
import unassert from 'rollup-plugin-unassert';
import flow from '@mapbox/flow-remove-types';
import {dirname, join} from 'path';

const removeAssert = unassert({include: [/\.js$/]});

async function main() {
    const files = glob.sync('**/*.js', {
        ignore: ['+(bin|build|node_modules|dist)/**/*', 'rollup.config.js', 'test.js', 'prepare_modules.js']
    });
    for (let i = 0, ii = files.length; i < ii; i++) {
        const path = files[i];
        console.log(path);
        let file = readFileSync(path, 'utf8');
        file = flow(file, path).toString();
        const {code} = await removeAssert.transform(file, path);
        const dir = join('dist', dirname(path));
        if (!existsSync(dir)) {
            mkdirSync(dir);
        }
        writeFileSync(join('dist', path), code, 'utf8');
    }

    if (!existsSync(join('dist', 'reference'))) {
        mkdirSync('dist/reference');
    }
    const fullSpecJson = readFileSync('./reference/v8.json', 'utf8');
    const minifiedSpec = JSON.parse(fullSpecJson, (key, value) => ['doc', 'example'].includes(key) ? undefined : value);
    writeFileSync('./dist/reference/v8.json', JSON.stringify(minifiedSpec), 'utf8');
}
main();
