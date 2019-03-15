import fs from 'fs';
import {plugins} from './build/rollup_plugins';
import banner from './build/banner';

// a config for generating a special GL JS bundle with static web worker code (in a separate file)
// https://github.com/mapbox/mapbox-gl-js/issues/6058

export default [{
    input: 'src/index.js',
    output: {
        name: 'mapboxgl',
        file: 'dist/mapbox-gl.csp.js',
        format: 'umd',
        sourcemap: true,
        indent: false,
        banner
    },
    treeshake: true,
    plugins: plugins(true, true)
}, {
    input: ['src/source/worker.js'],
    output: {
        name: 'mapboxgl',
        file: 'dist/mapbox-gl.worker.js',
        format: 'iife',
        sourcemap: true,
        indent: false,
        banner
    },
    treeshake: true,
    plugins: plugins(true, true)
}];
