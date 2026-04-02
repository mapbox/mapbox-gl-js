import {plugins} from './build/rollup_plugins.js';

const {BUILD, MINIFY, NO_DIST_SOURCEMAPS} = process.env;
const minified = MINIFY === 'true';
const production = BUILD === 'production';
const disableDistSourcemaps = NO_DIST_SOURCEMAPS === 'true';

export default () => [
    {
        input: {
            'mapbox-gl': 'src/index.ts',
            'worker': 'src/source/worker.ts'
        },
        output: {
            dir: production ?
                    minified ? 'dist/esm-min/' : 'dist/esm/' :
                    'dist/esm-dev/',
            chunkFileNames: 'shared.js',
            format: 'esm',
            compact: true,
            // Do not add additional interop helpers.
            interop: 'esModule',
            // Never add a `__esModule` property when generating exports.
            esModule: false,
            // Allow using ES2015 features in Rollup wrappers and helpers.
            generatedCode: 'es2015',
            exports: 'named',
            minifyInternalExports: true,
            externalLiveBindings: false,
            // Allows publish/build scripts to suppress distributable sourcemaps.
            sourcemap: !disableDistSourcemaps,
        },
        treeshake: production ? {
            preset: 'smallest',
            moduleSideEffects: (id) => !id.endsWith('devtools.ts'),
        } : false,
        strictDeprecations: true,
        preserveEntrySignatures: 'strict',
        plugins: [
            resolveWebWorker(),
        ].concat(plugins({production, minified, test: false, keepClassNames: false, mode: BUILD, format: 'esm'})),
    }
];

/**
 * Resolves web worker imports based on the output format
 */
function resolveWebWorker() {
    return {
        name: 'web-worker-resolver',
        resolveId(source, importer) {
            if (source === './web_worker') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                return this.resolve('./web_worker_esm.ts', importer, {skipSelf: true});
            }

            return null;
        }
    };
}
