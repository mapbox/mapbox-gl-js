import replace from 'rollup-plugin-replace';
import {plugins} from '../build/rollup_plugins';

export default {
    input: 'bench/benchmarks_view.js',
    output: {
        name: 'Benchmarks',
        file: 'bench/benchmarks_view_generated.js',
        format: 'umd',
        indent: false,
        sourcemap: true
    },
    plugins: plugins(true, true).concat(replace({'process.env.NODE_ENV': '"production"'}))
};
