'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const isBuiltin = require('is-builtin-module');

const Linter = require('eslint').Linter;
const browserify = require('browserify');


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

        exec('npm run build', { cwd: styleSpecDirectory }, (error) => {
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

            browserify(styleSpecDirectory, {
                postFilter: (id) => {
                    if (!/^[\/\.]/.test(id) && !isBuiltin(id)) {
                        t.ok(styleSpecPackage.dependencies[id], `External dependency ${id} declared in style-spec's package.json`);
                        return false;
                    }
                    return true;
                }
            }).bundle((err) => {
                t.error(err);
                t.end();
            });
        });
    });

    t.end();
});
