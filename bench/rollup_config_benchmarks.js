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
        dir: 'rollup/build',
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
        sourcemap: 'inline'
    },
    plugins: [sourcemaps()],
    intro: `
let shared, worker;
function define(_, module) {
if (!shared) {
    shared = module;
} else if (!worker) {
    worker = module;
} else {
    const workerBundleString = 'const sharedModule = {}; (' + shared + ')(sharedModule); (' + worker + ')(sharedModule);'

    const sharedModule = {};
    shared(sharedModule);
    window.mapboxGlWorkerUrl = window.URL.createObjectURL(new Blob([workerBundleString], { type: 'text/javascript' }));
    module(sharedModule);
}
}
`
}];

export default config;

