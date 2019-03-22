import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import replace from 'rollup-plugin-replace';
import {plugins} from '../../build/rollup_plugins';

const replaceConfig = {
    'process.env.BENCHMARK_VERSION': JSON.stringify(process.env.BENCHMARK_VERSION),
    'process.env.MAPBOX_ACCESS_TOKEN': JSON.stringify(process.env.MAPBOX_ACCESS_TOKEN),
    'process.env.MapboxAccessToken': JSON.stringify(process.env.MapboxAccessToken)
};

export default [{
    input: [`bench/versions/benchmarks.js`, 'src/source/worker.js'],
    output: {
        dir: 'rollup/build/benchmarks/versions',
        format: 'amd',
        indent: false,
        sourcemap: 'inline',
        chunkFileNames: 'shared.js'
    },
    plugins: plugins(true, true).concat(replace(replaceConfig))
}, {
    input: 'rollup/benchmarks.js',
    output: {
        file: 'bench/versions/benchmarks_generated.js',
        format: 'umd',
        indent: false,
        sourcemap: true,
        intro: fs.readFileSync(require.resolve('../../rollup/bundle_prelude.js'), 'utf8')
    },
    treeshake: false,
    plugins: [sourcemaps()],
}];
