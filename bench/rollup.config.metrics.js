import {plugins} from '../build/rollup_plugins';

export default {
    input: 'bench/lib/metrics-harness.js',
    output: {
        name: 'metrics',
        format: 'umd',
        sourcemap: 'inline',
        indent: false,
        file: 'bench/dist/metrics-suite.js'
    },
    plugins: plugins(false, false),
    external: [ 'mapboxgl' ]
};
