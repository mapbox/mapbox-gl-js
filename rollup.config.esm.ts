import {plugins} from './build/rollup_plugins.js';

import type {Plugin, RollupOptions} from 'rollup';

const {BUILD, MINIFY} = process.env;
const minified = MINIFY === 'true';
const production = BUILD === 'production';

export default (): RollupOptions[] => [
    {
        input: {
            'mapbox-gl': 'src/index.ts',
            'worker': 'src/source/worker.ts'
        },
        output: {
            dir: production ?
                minified ? 'dist/esm-min/' : 'dist/esm/' :
                'dist/esm-dev/',
            chunkFileNames: (chunk) => {
                if (chunk.name === "index") return "core.js";
                if (chunk.isDynamicEntry) {
                    if (chunk.facadeModuleId.endsWith('hd_main_imports.ts')) return 'hd.shared.js';
                    if (chunk.facadeModuleId.endsWith('hd_worker_imports.ts')) return 'hd.worker.js';
                }
                return 'shared.js'; // catch all for deduped code
            },
            experimentalMinChunkSize: 5000,
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
            sourcemap: true,
        },
        treeshake: production ? {
            preset: 'smallest',
            moduleSideEffects: (id) => !id.endsWith('devtools.ts'),
        } : false,
        strictDeprecations: true,
        preserveEntrySignatures: 'strict',
        plugins: [
            esmSubstitutions(),
        ].concat(plugins({production, minified, test: false, keepClassNames: false, mode: BUILD, format: 'esm'})),
    }
];

const filesToSub = new Set(['web_worker', 'hd_main', 'hd_worker']);

/**
 * Resolves web worker imports based on the output format
 */
function esmSubstitutions(): Plugin {
    return {
        name: 'esm-substitution-resolver',
        resolveId(source, importer) {
            const name = source.slice(source.lastIndexOf('/') + 1);
            if (filesToSub.has(name)) {
                return this.resolve(`${source}_esm.ts`, importer, {skipSelf: true});
            }
            return null;
        }
    };
}
