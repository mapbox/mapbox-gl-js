/* eslint-disable flowtype/require-valid-file-annotation */
import fs from 'fs';
import {fileURLToPath} from 'url';
import {readFile} from 'node:fs/promises';

import {plugins} from './build/rollup_plugins.js';
import banner from './build/banner.js';

const {BUILD, MINIFY} = process.env;
const minified = MINIFY === 'true';
const bench = BUILD === 'bench';
const production = BUILD === 'production' || bench;

function buildType(build, minified) {
    switch (build) {
    case 'production':
        if (minified) return 'dist/mapbox-gl.js';
        return 'dist/mapbox-gl-unminified.js';
    case 'bench':
        return 'dist/mapbox-gl-bench.js';
    case 'dev':
        return 'dist/mapbox-gl-dev.js';
    default:
        return 'dist/mapbox-gl-dev.js';
    }
}
const outputFile = buildType(BUILD, MINIFY);

export default [{
    // First, use code splitting to bundle GL JS into three "chunks":
    // - rollup/build/index.js: the main module, plus all its dependencies not shared by the worker module
    // - rollup/build/worker.js: the worker module, plus all dependencies not shared by the main module
    // - rollup/build/shared.js: the set of modules that are dependencies of both the main module and the worker module
    //
    // This is also where we do all of our source transformations: removing
    // flow annotations, transpiling ES6 features using buble, inlining shader
    // sources as strings, etc.
    input: ['src/index.js', 'src/source/worker.js'],
    output: {
        dir: 'rollup/build/mapboxgl',
        format: 'amd',
        sourcemap: 'inline',
        indent: false,
        chunkFileNames: 'shared.js',
        minifyInternalExports: production
    },
    onwarn: production ? onwarn : false,
    treeshake: production,
    plugins: plugins({minified, production, bench})
}, {
    // Next, bundle together the three "chunks" produced in the previous pass
    // into a single, final bundle. See rollup/bundle_prelude.js and
    // rollup/mapboxgl.js for details.
    input: 'rollup/mapboxgl.js',
    output: {
        name: 'mapboxgl',
        file: outputFile,
        format: 'umd',
        sourcemap: production ? true : 'inline',
        indent: false,
        intro: fs.readFileSync(fileURLToPath(new URL('./rollup/bundle_prelude.js', import.meta.url)), 'utf8'),
        banner
    },
    treeshake: false,
    plugins: [
        // Ingest the sourcemaps produced in the first step of the build.
        // This is the only reason we use Rollup for this second pass
        sourcemaps()
    ],
}];

function sourcemaps() {
    const base64SourceMapRegExp = /\/\/# sourceMappingURL=data:[^,]+,([^ ]+)/;

    return {
        name: 'sourcemaps',
        async load(id) {
            const code = await readFile(id, {encoding: 'utf8'});
            const match = base64SourceMapRegExp.exec(code);
            if (!match) return;

            const base64EncodedSourceMap = match[1];
            const decodedSourceMap = Buffer.from(base64EncodedSourceMap, 'base64').toString('utf-8');
            const map = JSON.parse(decodedSourceMap);

            return {code, map};
        }
    };
}

function onwarn(warning) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
        // Ignore circular dependencies in style-spec and throw on all others
        if (!warning.ids[0].includes('/src/style-spec')) throw new Error(warning.message);
    } else {
        console.error(`(!) ${warning.message}`);
    }
}
