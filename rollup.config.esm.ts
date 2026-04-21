import {visualizer} from 'rollup-plugin-visualizer';
import {plugins} from './build/rollup_plugins.js';

import type {Plugin, RollupOptions} from 'rollup';

const {BUILD, MINIFY, VISUALIZE} = process.env;
const minified = MINIFY === 'true';
const production = BUILD === 'production';
const visualize = production && (VISUALIZE === '1' || VISUALIZE === 'true');

/**
 * Creates an ESM rollup config.
 * @param dir - Output directory
 * @param workerSuffix - Suffix for the web_worker substitution ('_esm_cdn' for cross-origin Blob workaround, '_esm_npm' for bundler-detectable pattern)
 * @param emitVisualizer - When true, append rollup-plugin-visualizer to emit a gzip treemap at `<dir>/treemap.html`
 */
function esmConfig(dir: string, workerSuffix: string, emitVisualizer = false): RollupOptions {
    return {
        input: {
            'mapbox-gl': 'src/index.ts',
            'worker': 'src/source/worker.ts'
        },
        output: {
            dir,
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
            esmSubstitutions(workerSuffix),
            ...plugins({production, minified, test: false, keepClassNames: false, mode: BUILD, format: 'esm'}),
            emitVisualizer && visualizer({
                filename: `${dir}treemap.html`,
                template: 'treemap',
                gzipSize: true,
                brotliSize: false,
                sourcemap: false,
                title: 'GL JS ESM bundle',
            }),
        ],
    };
}

export default (): RollupOptions[] => {
    if (production) {
        // Production: build both NPM (dist/esm/) and CDN (dist/esm-cdn/) variants
        return [
            esmConfig('dist/esm/', '_esm_npm', visualize),
            esmConfig('dist/esm-cdn/', '_esm_cdn'),
        ];
    }
    // Dev: build only NPM variant (dist/esm-dev/)
    return [
        esmConfig('dist/esm-dev/', '_esm_npm'),
    ];
};

const filesToSub = new Set(['hd_main', 'hd_worker']);

function esmSubstitutions(workerSuffix: string): Plugin {
    return {
        name: 'esm-substitution-resolver',
        resolveId(source, importer) {
            const name = source.slice(source.lastIndexOf('/') + 1);
            if (name === 'web_worker') {
                return this.resolve(`${source}${workerSuffix}.ts`, importer, {skipSelf: true});
            }
            if (filesToSub.has(name)) {
                return this.resolve(`${source}_esm.ts`, importer, {skipSelf: true});
            }
            return null;
        }
    };
}
