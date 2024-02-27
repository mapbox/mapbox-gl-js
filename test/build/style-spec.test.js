/* eslint-disable import/extensions */
import path from 'path';
import fs from 'fs';
import isBuiltin from 'is-builtin-module';
import {rollup} from 'rollup';

import {test} from 'tape';
import rollupConfig from '../../src/style-spec/rollup.config.js';

import {createRequire} from 'module';
const require = createRequire(import.meta.url);

import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const styleSpecDirectory = path.join(__dirname, '../../src/style-spec');

const styleSpecPackage = JSON.parse(fs.readFileSync(path.join(styleSpecDirectory, 'package.json')));
// import styleSpecPackage from '../../src/style-spec/package.json';

test('@mapbox/mapbox-gl-style-spec npm package', (t) => {
    t.test('builds self-contained bundle without undeclared dependencies', (t) => {
        const warn = console.warn;
        console.warn = () => {};
        rollup({
            input: `${styleSpecDirectory}/style-spec.js`,
            plugins: [{
                resolveId: (id, importer) => {
                    if (isBuiltin(id) || /node_modules/.test(id) || /node_modules/.test(importer)) {
                        return null;
                    }

                    if (!styleSpecPackage.dependencies[id]) {
                        if (!path.resolve(importer, id).startsWith(styleSpecDirectory)) {
                            t.fail(`Import outside of the style-spec package: ${id} (imported from ${importer})`);
                        }
                    }

                    if (/^[\/\.]/.test(id)) {
                        return null;
                    }

                    t.ok(styleSpecPackage.dependencies[id], `External dependency ${id} (imported from ${importer}) declared in style-spec's package.json`);
                    return false;
                }
            }].concat(rollupConfig[0].plugins)
        }).then(() => {
            console.warn = warn;
            t.end();
        }).catch(e => {
            console.warn = warn;
            t.error(e);
        });
    });

    t.test('exports components directly, not behind `default` - https://github.com/mapbox/mapbox-gl-js/issues/6601', (t) => {
        const spec = require('../../dist/style-spec/index.cjs');
        t.ok(spec.validate);
        t.notOk(spec.default && spec.default.validate);
        t.end();
    });

    t.end();
});
