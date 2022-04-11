import path from 'path';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import unassert from 'rollup-plugin-unassert';
import {flow} from '../../build/rollup_plugins.js';

// Build es modules?
const esm = 'esm' in process.env;

import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const reviver = (key, value) => ['doc', 'example', 'sdk-support'].includes(key) ? undefined : value;

const config = [{
    input: `${__dirname}/style-spec.js`,
    output: {
        name: 'mapboxGlStyleSpecification',
        file: `${__dirname}/dist/${esm ? 'index.es.js' : 'index.cjs'}`,
        format: esm ? 'esm' : 'umd',
        sourcemap: true
    },
    plugins: [
        {
            name: 'dep-checker',
            resolveId(source, importer) {
                // Some users reference modules within style-spec package directly, instead of the bundle
                // This means that files within the style-spec package should NOT import files from the parent mapbox-gl-js tree.
                // This check will cause the build to fail on CI allowing these issues to be caught.
                if (importer && !importer.includes('node_modules')) {
                    const resolvedPath = path.join(importer, source);
                    const fromRoot = path.relative(__dirname, resolvedPath);
                    if (fromRoot.length > 2 && fromRoot.slice(0, 2) === '..') {
                        throw new Error(`Module ${importer} imports ${source} from outside the style-spec package root directory.`);
                    }
                }

                return null;
            }
        },
        // https://github.com/zaach/jison/issues/351
        replace({
            include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
            delimiters: ['', ''],
            values: {
                '_token_stack:': ''
            }
        }),
        replace({
            include: /\/reference\/latest\.js$/,
            delimiters: ['', ''],
            values: {
                'export const min = spec.default': 'export const min = spec.min'
            }
        }),
        flow(),
        {
            name: 'json-min',
            transform(code, id) {
                if (id.endsWith('.json')) {
                    const json = JSON.parse(code);
                    const min = JSON.stringify(json, reviver);
                    const full = JSON.stringify(json);
                    code = `export default ${full}`;
                    if (min !== full) {
                        code += `\nexport const min = ${min}`;
                    }
                    return {
                        code,
                        map: null
                    };
                }
                return null;
            }
        },
        unassert(),
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs()
    ]
}];
export default config;
