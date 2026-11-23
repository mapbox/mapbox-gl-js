import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {readFile} from 'node:fs/promises';
import {transformSync} from 'esbuild';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import {plugins} from './build/rollup_plugins.ts';
import banner from './build/banner.ts';

import type {Plugin, RollupLog, RollupOptions, SourceMapInput} from 'rollup';

const {BUILD, MINIFY} = process.env;
const minified = MINIFY === 'true';
const production = BUILD === 'production';

function buildType(build: string, minified: string) {
    switch (build) {
    case 'production':
        return 'dist/mapbox-gl.js';
    case 'dev':
        return 'dist/mapbox-gl-dev.js';
    default:
        return 'dist/mapbox-gl-dev.js';
    }
}

const outputFile = buildType(BUILD, MINIFY);

const bundlePreludeSource = fs.readFileSync(fileURLToPath(new URL('./rollup/bundle_prelude.js', import.meta.url)), 'utf8');
// Not minified: it would strip the import() ignore comments that stop downstream bundlers rewriting the worker's import().
const bundlePrelude = production ? transformSync(bundlePreludeSource, {target: browserslistToEsbuild()}).code : bundlePreludeSource;

function preserveDynamicImport(): Plugin {
    return {
        name: 'preserve-dynamic-import',
        resolveDynamicImport() {
            // Prevent Rollup from resolving and code-splitting dynamic imports.
            // They will be loaded natively at runtime via import().
            return false;
        },
        renderDynamicImport() {
            return {left: 'self.__mapboxImport(', right: ')'};
        }
    };
}

export default ({watch}: {watch: boolean}): RollupOptions[] => {
    return [{
        // First, use code splitting to bundle GL JS into three "chunks":
        // - rollup/build/index.js: the main module, plus all its dependencies not shared by the worker module
        // - rollup/build/worker.js: the worker module, plus all dependencies not shared by the main module
        // - rollup/build/shared.js: the set of modules that are dependencies of both the main module and the worker module
        //
        // This is also where we do all of our source transformations:
        // transpiling ES6 features, inlining shader sources as strings, etc.
        input: ['src/index.ts', 'src/source/worker.ts'],
        output: {
            dir: 'rollup/build/mapboxgl',
            format: 'amd',
            sourcemap: 'inline',
            indent: false,
            chunkFileNames: 'shared.js',
            minifyInternalExports: production
        },
        onwarn: production ? onwarn : undefined,
        treeshake: production ? {preset: 'recommended', moduleSideEffects: (id) => !id.endsWith('devtools.ts')} : false,
        plugins: [preserveDynamicImport(), lowerStringifiedChunks(), ...plugins({minified, production, test: false, keepClassNames: false, format: 'umd'})]
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
            intro: bundlePrelude,
            banner
        },
        treeshake: false,
        plugins: [
            preserveDynamicImport(),
            // Ingest the sourcemaps produced in the first step of the build.
            // This is the only reason we use Rollup for this second pass
            sourcemaps({watch}),
        ]
    }];
};

// The UMD worker is built by stringifying the shared and worker chunk factories (see rollup/bundle_prelude.js), so a
// downstream bundler that lowers syntax into top-level helpers (e.g. Angular's esbuild builder) breaks the worker.
// Lowering the factory bodies here, before minification, puts one copy of each helper inside the stringified code.
// esbuild hoists helpers to the top of its input, so it gets only the body, with a blank line standing in for the
// `define(..., (function (...) {` header to keep source lines aligned. https://github.com/mapbox/mapbox-gl-js/issues/13756
function lowerStringifiedChunks(): Plugin {
    return {
        name: 'lower-stringified-chunks',
        renderChunk(code, chunk) {
            if (chunk.name === 'index') return null;
            const bodyStart = code.indexOf('\n') + 1;
            const bodyEnd = code.lastIndexOf('}));');
            if (!code.startsWith('define(') || bodyEnd < bodyStart) throw new Error(`Unexpected AMD chunk shape in ${chunk.fileName}`);

            const {code: body, map} = transformSync(`\n${code.slice(bodyStart, bodyEnd)}`, {
                supported: {'object-rest-spread': false, 'async-await': false},
                sourcemap: true,
                sourcefile: chunk.fileName
            });
            const parsedMap = JSON.parse(map) as {mappings: string};
            parsedMap.mappings = `;${parsedMap.mappings}`;
            return {code: code.slice(0, bodyStart) + body + code.slice(bodyEnd), map: parsedMap as SourceMapInput};
        }
    };
}

function sourcemaps({watch}: {watch: boolean}): Plugin {
    const base64SourceMapRegExp = /\/\/# sourceMappingURL=data:[^,]+,([^ ]+)/;

    return {
        name: 'sourcemaps',
        async load(id) {
            const code = await readFile(id, {encoding: 'utf8'});
            const match = base64SourceMapRegExp.exec(code);
            if (!match) return;

            const base64EncodedSourceMap = match[1];
            const decodedSourceMap = Buffer.from(base64EncodedSourceMap, 'base64').toString('utf-8');
            const map = JSON.parse(decodedSourceMap) as SourceMapInput;

            // Starting with Rollup 4.x, we need to explicitly watch files
            // if their content is returned by the load hook.
            // https://github.com/rollup/rollup/pull/5150
            if (watch) this.addWatchFile(id);

            return {code, map};
        }
    };
}

function onwarn(warning: RollupLog) {
    const styleSpecValidatePath = path.resolve('src', 'style-spec', 'validate') + path.sep;
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
        // The style-spec validators are mutually recursive through the `validate` dispatcher;
        // that cycle is benign (function-only modules), so allow it and throw on all others.
        if (!warning.ids.every(id => id.startsWith(styleSpecValidatePath))) throw new Error(warning.message);
    } else {
        console.error(`(!) ${warning.message}`);
    }
}
