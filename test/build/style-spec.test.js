import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import isBuiltin from 'is-builtin-module';
import {createRequire} from 'node:module';
import {rollup} from 'rollup';
import rollupConfig from '../../src/style-spec/rollup.config.js';

const require = createRequire(import.meta.url);

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const styleSpecDirectory = path.join(__dirname, '../../src/style-spec');

const styleSpecPackage = JSON.parse(fs.readFileSync(path.join(styleSpecDirectory, 'package.json')).toString());

describe('@mapbox/mapbox-gl-style-spec npm package', () => {
    it('builds self-contained bundle without undeclared dependencies', () => {
        const warn = console.warn;
        console.warn = () => {};
        return rollup({
            input: `${styleSpecDirectory}/style-spec.ts`,
            plugins: [{
                name: 'check-dependencies',
                resolveId: (id, importer) => {
                    if (isBuiltin(id) || /node_modules/.test(id) || /node_modules/.test(importer)) {
                        return null;
                    }

                    if (!styleSpecPackage.dependencies[id]) {
                        if (!path.resolve(importer, id).startsWith(styleSpecDirectory)) {
                            throw new Error(`Import outside of the style-spec package: ${id} (imported from ${importer})`);
                        }
                    }

                    if (/^[\/\.]/.test(id)) {
                        return null;
                    }

                    assert(styleSpecPackage.dependencies[id], `External dependency ${id} (imported from ${importer}) declared in style-spec's package.json`);
                }
            }].concat(rollupConfig[0].plugins)
        }).then(() => {
            console.warn = warn;
        }).catch(e => {
            console.warn = warn;
            throw e;
        });
    });

    it('exports components directly, not behind `default` - https://github.com/mapbox/mapbox-gl-js/issues/6601', () => {
        const spec = require('../../dist/style-spec/index.cjs');
        assert(!!spec.validate, 'validate function is exported directly');
        assert(!spec.default || !spec.default.validate, 'validate function is not exported behind default export');
    });
});
