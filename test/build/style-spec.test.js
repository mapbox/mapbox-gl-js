
/* eslint-disable import/no-commonjs */

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const isBuiltin = require('is-builtin-module');

const Linter = require('eslint').Linter;
const rollup = require('rollup');

import rollupConfig from '../../src/style-spec/rollup.config';

// some paths
const styleSpecDirectory = path.join(__dirname, '../../src/style-spec');
const styleSpecPackage = require('../../src/style-spec/package.json');
const styleSpecDistBundle = fs.readFileSync(path.join(__dirname, '../../dist/style-spec/index.js'), 'utf-8');

test('@mapbox/mapbox-gl-style-spec npm package', (t) => {
    t.test('build plain ES5 bundle in prepublish', (t) => {
        const linter = new Linter();
        const messages = linter.verify(styleSpecDistBundle, {
            parserOptions: {
                ecmaVersion: 5
            },
            rules: {},
            env: {
                node: true
            }
        }).map(message => `${message.line}:${message.column}: ${message.message}`);
        t.deepEqual(messages, [], 'distributed bundle is plain ES5 code');

        t.stub(console, 'warn');
        rollup.rollup({
            input: `${styleSpecDirectory}/style-spec.js`,
            plugins: [{
                resolveId: (id, importer) => {
                    if (
                        /^[\/\.]/.test(id) ||
                        isBuiltin(id) ||
                        /node_modules/.test(importer)
                    ) {
                        return null;
                    }

                    t.ok(styleSpecPackage.dependencies[id], `External dependency ${id} (imported from ${importer}) declared in style-spec's package.json`);
                    return false;
                }
            }].concat(rollupConfig[0].plugins)
        }).then(() => {
            t.end();
        }).catch(e => {
            t.error(e);
        });
    });

    t.test('exports components directly, not behind `default` - https://github.com/mapbox/mapbox-gl-js/issues/6601', (t) => {
        const spec = require('../../dist/style-spec/index.js');
        t.ok(spec.validate);
        t.notOk(spec.default && spec.default.validate);
        t.end();
    });

    t.end();
});
