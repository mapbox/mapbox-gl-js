import {plugins} from '../build/rollup_plugins';
import replace from 'rollup-plugin-replace';
const replaceConfig = {
    'process.env.NUM_WARMUP_RUNS': JSON.stringify(process.env.NUM_WARMUP_RUNS)
};

const allPlugins = plugins(false, false).concat(replace(replaceConfig));

export default {
    input: 'bench/lib/metrics-harness.js',
    output: {
        name: 'metrics',
        format: 'umd',
        sourcemap: false,
        indent: false,
        file: 'bench/dist/metrics-suite.js'
    },
    plugins: allPlugins,
    external: [ 'mapboxgl' ]
};
