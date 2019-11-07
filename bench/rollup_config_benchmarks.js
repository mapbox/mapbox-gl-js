import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import replace from 'rollup-plugin-replace';
import {plugins} from '../build/rollup_plugins';
import buble from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

let styles = ['mapbox://styles/mapbox/streets-v10'];

if (process.env.MAPBOX_STYLES) {
    styles = process.env.MAPBOX_STYLES
        .split(',')
        .map(style => style.match(/\.json$/) ? require(style) : style);
}

const replaceConfig = {
    'process.env.BENCHMARK_VERSION': JSON.stringify(process.env.BENCHMARK_VERSION),
    'process.env.MAPBOX_ACCESS_TOKEN': JSON.stringify(process.env.MAPBOX_ACCESS_TOKEN),
    'process.env.MapboxAccessToken': JSON.stringify(process.env.MapboxAccessToken),
    'process.env.MAPBOX_STYLES': JSON.stringify(styles),
    'process.env.NODE_ENV': JSON.stringify('production')
};

const allPlugins = plugins(true, true).concat(replace(replaceConfig));
const intro = fs.readFileSync('rollup/bundle_prelude.js', 'utf8');

const splitConfig = (name) => [{
    input: [`bench/${name}/benchmarks.js`, 'src/source/worker.js'],
    output: {
        dir: `rollup/build/benchmarks/${name}`,
        format: 'amd',
        indent: false,
        sourcemap: 'inline',
        chunkFileNames: 'shared.js'
    },
    plugins: allPlugins
}, {
    input: `rollup/benchmarks_${name}.js`,
    output: {
        file: `bench/${name}/benchmarks_generated.js`,
        format: 'umd',
        indent: false,
        sourcemap: true,
        intro
    },
    treeshake: false,
    plugins: [sourcemaps()],
}];

const viewConfig = {
    input: 'bench/benchmarks_view.js',
    output: {
        name: 'Benchmarks',
        file: 'bench/benchmarks_view_generated.js',
        format: 'umd',
        indent: false,
        sourcemap: false
    },
    plugins: [
        buble({transforms: {dangerousForOf: true}, objectAssign: true}),
        resolve({browser: true, preferBuiltins: false}),
        commonjs(),
        replace(replaceConfig)
    ]
};

export default splitConfig('versions').concat(splitConfig('styles')).concat(viewConfig);
