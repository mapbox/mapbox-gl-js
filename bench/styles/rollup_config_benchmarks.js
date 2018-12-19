import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import replace from 'rollup-plugin-replace';
import {plugins as basePlugins} from '../../build/rollup_plugins';

let styles = ['mapbox://styles/mapbox/streets-v10'];

if (process.env.MAPBOX_STYLES) {
    styles = process.env.MAPBOX_STYLES
        .split(',')
        .map(style => style.match(/\.json$/) ? require(style) : style);
}

const plugins = () => basePlugins().concat(
    replace({
        'process.env.BENCHMARK_VERSION': JSON.stringify(process.env.BENCHMARK_VERSION),
        'process.env.MAPBOX_ACCESS_TOKEN': JSON.stringify(process.env.MAPBOX_ACCESS_TOKEN),
        'process.env.MapboxAccessToken': JSON.stringify(process.env.MapboxAccessToken),
        'process.env.MAPBOX_STYLES': JSON.stringify(styles),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    })
);

const config = [{
    input: [`bench/styles/benchmarks.js`, 'src/source/worker.js'],
    output: {
        dir: 'rollup/build/benchmarks/styles',
        format: 'amd',
        sourcemap: 'inline',
        chunkFileNames: 'chunk1.js'
    },
    experimentalCodeSplitting: true,
    plugins: plugins()
}, {
    input: 'rollup/style_benchmarks.js',
    output: {
        file: 'bench/styles/benchmarks_generated.js',
        format: 'umd',
        sourcemap: 'inline',
        intro: fs.readFileSync(require.resolve('../../rollup/bundle_prelude.js'), 'utf8')
    },
    treeshake: false,
    indent: false,
    plugins: [sourcemaps()],
}];

export default config;
