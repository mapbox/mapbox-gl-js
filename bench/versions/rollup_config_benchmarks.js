import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import replace from 'rollup-plugin-replace';
import {plugins as basePlugins} from '../../build/rollup_plugins';

const plugins = () => basePlugins(true, true).concat(
    replace({
        'process.env.BENCHMARK_VERSION': JSON.stringify(process.env.BENCHMARK_VERSION),
        'process.env.MAPBOX_ACCESS_TOKEN': JSON.stringify(process.env.MAPBOX_ACCESS_TOKEN),
        'process.env.MapboxAccessToken': JSON.stringify(process.env.MapboxAccessToken),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    })
);

const config = [{
    input: [`bench/versions/benchmarks.js`, 'src/source/worker.js'],
    output: {
        dir: 'rollup/build/benchmarks/versions',
        format: 'amd',
        indent: false,
        sourcemap: 'inline',
        chunkFileNames: 'shared.js'
    },
    plugins: plugins()
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

export default config;
