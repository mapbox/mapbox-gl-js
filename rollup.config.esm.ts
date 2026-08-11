import {visualizer} from 'rollup-plugin-visualizer';
import {plugins} from './build/rollup_plugins.ts';

import type {Plugin, RollupOptions} from 'rollup';

const {BUILD, MINIFY, VISUALIZE, ESM_TARGET} = process.env;
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
            'mapbox-gl': 'src/index.esm.ts',
            'worker': 'src/source/worker.ts'
        },
        output: {
            dir,
            chunkFileNames: (chunk) => {
                // Single-facade dynamic entries are named by facade id; a chunk shared across
                // several dynamic imports has a null facadeModuleId and falls through below.
                if (chunk.isDynamicEntry && chunk.facadeModuleId) {
                    if (chunk.facadeModuleId.endsWith('hd_main_imports.ts')) return 'hd.main.js';
                    if (chunk.facadeModuleId.endsWith('hd_worker_imports.ts')) return 'hd.worker.js';
                    if (chunk.facadeModuleId.endsWith('standard_main_imports.ts')) return 'standard.main.js';
                    if (chunk.facadeModuleId.endsWith('standard_worker_imports.ts')) return 'standard.worker.js';
                    if (chunk.facadeModuleId.endsWith('lite_main_imports.ts')) return 'lite.main.js';
                    if (chunk.facadeModuleId.endsWith('debug_imports.ts')) return 'debug.js';
                }
                // Identify each code-split chunk by a foundational module/file rather than by
                // chunk.name, which is derived from rollup's representative-module selection
                // and can silently change when the module graph topology shifts
                if (chunk.moduleIds.some(id => id.endsWith('/src/ui/map.ts'))) return 'core.js';
                if (chunk.moduleIds.some(id => id.endsWith('/3d-style/data/bucket/building_bucket.ts'))) return 'hd.shared.js';
                if (chunk.moduleIds.some(id => id.endsWith('/3d-style/render/draw_ground_effect.ts'))) return 'hd_standard.shared.js';
                // The model data cluster (Model, model_loader, glTF/draco/meshopt loaders) is shared
                // between the HD and Standard lazy graphs and reachable from neither core entry — keep
                // it out of the core `shared*.js` glob.
                if (chunk.moduleIds.some(id => id.endsWith('/3d-style/data/model.ts'))) return 'hd_standard.model.js';
                // The Standard model buckets are shared between the Standard main and worker chunks only.
                if (chunk.moduleIds.some(id => id.endsWith('/3d-style/data/bucket/model_bucket.ts'))) return 'standard.shared.js';
                // The raster-array capability splits into three reachability sets.
                if (chunk.moduleIds.some(id => id.endsWith('/src/data/mrt/mrt.esm.js'))) return 'raster_array.shared.js'; // MRT decoder: shared by the main and worker raster-array chunks
                if (chunk.moduleIds.some(id => id.endsWith('/src/source/raster_array_tile_worker_source.ts'))) return 'raster_array.worker.js'; // worker source: worker's lazy raster-array import only
                if (chunk.moduleIds.some(id => id.endsWith('/src/source/raster_array_tile.ts'))) return 'raster_array.main.js'; // source/tile classes: main raster-array import only
                return 'shared.js'; // catch-all: the large gl-matrix / startup utilities chunk
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
            assertWorkerChunkIsolation(),
            ...plugins({production, minified, test: false, keepClassNames: false, format: 'esm'}),
            emitVisualizer && visualizer({
                filename: `${dir}treemap.html`,
                template: 'treemap',
                gzipSize: true,
                brotliSize: false,
                sourcemap: false,
                title: 'GL JS ESM bundle',
            }),
            emitVisualizer && visualizer({
                filename: `${dir}bundle-stats.json`,
                template: 'raw-data',
                gzipSize: true,
                brotliSize: false,
                sourcemap: false,
                projectRoot: process.cwd(),
            }),
        ],
    };
}

export default (): RollupOptions[] => {
    if (production) {
        // Production: build NPM (dist/esm/) by default; ESM_TARGET=cdn selects the CDN variant (dist/esm-cdn/).
        if (ESM_TARGET === 'cdn') return [esmConfig('dist/esm-cdn/', '_esm_cdn')];
        return [esmConfig('dist/esm/', '_esm_npm', visualize)];
    }
    // Dev: build only NPM variant (dist/esm-dev/)
    return [
        esmConfig('dist/esm-dev/', '_esm_npm'),
    ];
};

const filesToSub = new Set(['hd_main', 'hd_worker', 'standard_main', 'standard_registry', 'standard_worker', 'lite_main', 'raster_array_main', 'raster_array_worker', 'debug']);

/**
 * Guards the worker/main lazy-chunk boundary.
 *
 * Main-tier lazy chunks (`*.main.js`) hold main-thread-only code and must never be
 * reachable from the worker entry: bundlers such as Vite re-bundle the worker as a
 * nested build, and a chunk that ends up shared across two dynamic imports inside that
 * worker build cannot be inlined into a non-code-splitting (`iife`) worker — the failure
 * surfaces far downstream (in a consumer's bundler) with an error that points nowhere
 * near the offending import. This asserts the invariant here instead, at build time.
 *
 * A regression is almost always a worker-reachable module (e.g. `feature_index`,
 * a bucket, a style layer) importing a `*_main` module facade that carries the
 * `import('./*_main_imports')` call. Import the loader-free `*_registry` facade instead.
 */
function assertWorkerChunkIsolation(): Plugin {
    return {
        name: 'assert-worker-chunk-isolation',
        generateBundle(_options, bundle) {
            const chunks = Object.values(bundle).filter(output => output.type === 'chunk');
            const workerEntry = chunks.find(chunk => chunk.isEntry && chunk.facadeModuleId && chunk.facadeModuleId.replace(/\\/g, '/').endsWith('/src/source/worker.ts'));
            if (!workerEntry) {
                this.error('worker entry chunk not found — cannot verify main/worker chunk isolation');
                return;
            }

            const byFileName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));

            // Collect chunks statically reachable from the worker entry, and flag any that
            // dynamically import a main-tier chunk.
            const seen = new Set<string>([workerEntry.fileName]);
            const queue = [workerEntry.fileName];
            while (queue.length > 0) {
                const chunk = byFileName.get(queue.pop());
                if (!chunk) continue;
                for (const leaked of chunk.dynamicImports) {
                    if (leaked.endsWith('.main.js')) {
                        this.error(`Worker-reachable chunk "${chunk.fileName}" dynamically imports main-tier chunk "${leaked}". A worker-reachable module is importing a "*_main" facade (which carries the main-chunk import()). Import the loader-free "*_registry" facade instead.`);
                    }
                }
                for (const next of chunk.imports) {
                    if (!seen.has(next)) {
                        seen.add(next);
                        queue.push(next);
                    }
                }
            }
        }
    };
}

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
