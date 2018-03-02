import sourcemaps from 'rollup-plugin-sourcemaps';
import {plugins} from './build/rollup_plugins';

const production = process.env.BUILD === 'production';
const outputFile = production ? 'dist/mapbox-gl.js' : 'dist/mapbox-gl-dev.js';

const config = [{
    // First, use code splitting to bundle GL JS into three "chunks":
    // - rollup/build/index.js: the main module, plus all its dependencies not shared by the worker module
    // - rollup/build/worker.js: the worker module, plus all dependencies not shared by the main module
    // - rollup/build/chunk1.js: the set of modules that are dependencies of both the main module and the worker module
    //
    // This is also where we do all of our source transformations: removing
    // flow annotations, transpiling ES6 features using buble, inlining shader
    // sources as strings, etc.
    input: ['src/index.js', 'src/source/worker.js'],
    output: {
        dir: 'rollup/build',
        format: 'amd',
        sourcemap: 'inline'
    },
    experimentalCodeSplitting: true,
    plugins: plugins()
}, {
    // Next, bundle together the three "chunks" produced in the previous pass
    // into a single, final bundle. See 'intro:' below and rollup/mapboxgl.js
    // for details.
    input: 'rollup/mapboxgl.js',
    output: {
        name: 'mapboxgl',
        file: outputFile,
        format: 'umd',
        sourcemap: production ? true : 'inline'
    },
    plugins: [sourcemaps()],
    intro: `
let shared, worker, mapboxgl;
// define gets called three times: one for each chunk. we rely on the order
// they're imported to know which is which
function define(_, chunk) {
if (!shared) {
    shared = chunk;
} else if (!worker) {
    worker = chunk;
} else {
    const workerBundleString = 'const sharedChunk = {}; (' + shared + ')(sharedChunk); (' + worker + ')(sharedChunk);'

    const sharedChunk = {};
    shared(sharedChunk);
    mapboxgl = chunk(sharedChunk);
    mapboxgl.workerUrl = window.URL.createObjectURL(new Blob([workerBundleString], { type: 'text/javascript' }));
}
}`
}];

export default config
