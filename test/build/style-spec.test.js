const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const isBuiltin = require('is-builtin-module');

const Linter = require('eslint').Linter;
const rollup = require('rollup');

import rollupConfig from '../../src/style-spec/rollup.config';

// some paths
const styleSpecDirectory = path.join(__dirname, '../../src/style-spec');
const styleSpecPackage = require('../../src/style-spec/package.json');
const styleSpecDistBundle = path.join(styleSpecDirectory, styleSpecPackage.main);

test('@mapbox/mapbox-gl-style-spec npm package', (t) => {
    // simulate npm install of @mapbox/mapbox-gl-style-spec
    t.test('build plain ES5 bundle in prepublish', (t) => {
        t.tearDown(() => {
            fs.unlink(styleSpecDistBundle, (error) => {
                if (error) console.error(error);
            });
        });

        exec(`rm -f ${styleSpecDistBundle} && npm run build`, { cwd: styleSpecDirectory }, (error) => {
            t.error(error);
            t.ok(fs.existsSync(styleSpecDistBundle), 'dist bundle exists');

            const linter = new Linter();
            const messages = linter.verify(fs.readFileSync(styleSpecDistBundle, 'utf-8'), {
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
    });

    t.end();
});
