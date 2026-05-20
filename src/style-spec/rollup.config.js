import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import strip from '@rollup/plugin-strip';
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
        esbuild({tsconfig: `${__dirname}/../../tsconfig.browser.json`}),
        json(),
        strip({
            sourceMap: true,
            functions: ['assert', 'assert.*'],
            include: ['**/*.ts']
        }),
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs()
    ]
}];

export default config;
