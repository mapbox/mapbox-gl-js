import sourcemaps from 'rollup-plugin-sourcemaps';
import replace from 'rollup-plugin-replace';
import {plugins as basePlugins} from '../build/rollup_plugins';

const plugins = () => basePlugins().concat(
    replace({
        'process.env.BENCHMARK_VERSION': JSON.stringify(process.env.BENCHMARK_VERSION),
        'process.env.MAPBOX_ACCESS_TOKEN': JSON.stringify(process.env.MAPBOX_ACCESS_TOKEN),
        'process.env.MapboxAccessToken': JSON.stringify(process.env.MapboxAccessToken),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    })
);

const config = [{
    input: ['bench/benchmarks.js', 'src/source/worker.js'],
    output: {
        dir: 'rollup/build/benchmarks',
        format: 'amd',
        sourcemap: 'inline'
    },
    experimentalCodeSplitting: true,
    plugins: plugins()
}, {
    input: 'rollup/benchmarks.js',
    output: {
        file: 'bench/benchmarks_generated.js',
        format: 'umd',
        sourcemap: 'inline',
        intro: `
var shared, worker, mapboxgl;
function define(_, chunk) {
if (!shared) {
    shared = chunk;
} else if (!worker) {
    worker = chunk;
} else {
    var workerBundleString = 'var sharedChunk = {}; (' + shared + ')(sharedChunk); (' + worker + ')(sharedChunk);'

    var sharedChunk = {};
    shared(sharedChunk);
    mapboxgl = chunk(sharedChunk);
    mapboxgl.workerUrl = window.URL.createObjectURL(new Blob([workerBundleString], { type: 'text/javascript' }));
}
}
`
    },
    treeshake: false,
    indent: false,
    plugins: [sourcemaps()],
}];

export default config;

