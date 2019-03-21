import {plugins} from './build/rollup_plugins';
import banner from './build/banner';

// a config for generating a special GL JS bundle with static web worker code (in a separate file)
// https://github.com/mapbox/mapbox-gl-js/issues/6058

const config = (input, file, format) => ({
    input,
    output: {
        name: 'mapboxgl',
        file,
        format,
        sourcemap: true,
        indent: false,
        banner
    },
    treeshake: true,
    plugins: plugins(true, true)
});

export default [
    config('src/index.js', 'dist/mapbox-gl-csp.js', 'umd'),
    config('src/source/worker.js', 'dist/mapbox-gl-csp-worker.js', 'iife')
];
