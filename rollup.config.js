import sourcemaps from 'rollup-plugin-sourcemaps';
import {plugins} from './build/rollup_plugins';

const production = process.env.BUILD === 'production';
const outputFile = production ? 'dist/mapbox-gl.js' : 'dist/mapbox-gl-dev.js';

const config = [{
    input: ['src/index.js', 'src/source/worker.js'],
    output: {
        name: 'mapboxgl',
        dir: 'rollup/build',
        format: 'amd',
        sourcemap: 'inline'
    },
    experimentalCodeSplitting: true,
    plugins: plugins()
}, {
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
function define(_, module) {
if (!shared) {
    shared = module;
} else if (!worker) {
    worker = module;
} else {
    const workerBundleString = 'const sharedModule = {}; (' + shared + ')(sharedModule); (' + worker + ')(sharedModule);'

    const sharedModule = {};
    shared(sharedModule);
    mapboxgl = module(sharedModule);
    mapboxgl.workerUrl = window.URL.createObjectURL(new Blob([workerBundleString], { type: 'text/javascript' }));
}
}
`
}];

export default config
