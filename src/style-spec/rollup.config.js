import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import unassert from 'rollup-plugin-unassert';
import json from '@rollup/plugin-json';
import esbuild from 'rollup-plugin-esbuild';
import {fileURLToPath} from 'url';

// Build es modules?
const esm = 'esm' in process.env;

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const config = [{
    input: `${__dirname}style-spec.ts`,
    output: {
        name: 'mapboxGlStyleSpecification',
        file: `${__dirname}/dist/${esm ? 'index.es.js' : 'index.cjs'}`,
        format: esm ? 'esm' : 'umd',
        sourcemap: true
    },
    plugins: [
        // https://github.com/zaach/jison/issues/351
        replace({
            preventAssignment: true,
            include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
            delimiters: ['', ''],
            values: {
                '_token_stack:': ''
            }
        }),
        esbuild({tsconfig: `${__dirname}/../../tsconfig.json`}),
        json(),
        unassert({include: ['*.js', '**/*.js', '*.ts', '**/*.ts']}),
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs()
    ]
}];

export default config;
