import {plugins} from './build/rollup_plugins.js';
import banner from './build/banner.js';

import type {InputOption, ModuleFormat, RollupOptions} from 'rollup';

// a config for generating a special GL JS bundle with static web worker code (in a separate file)
// https://github.com/mapbox/mapbox-gl-js/issues/6058

const config = (input: InputOption, file: string, format: ModuleFormat): RollupOptions => ({
    input,
    output: {
        name: 'mapboxgl',
        file,
        format,
        sourcemap: true,
        indent: false,
        banner
    },
    treeshake: {preset: 'recommended', moduleSideEffects: (id) => !id.endsWith('devtools.ts')},
    plugins: plugins({minified: true, production: true, keepClassNames: true, test: false, mode: 'production'})
});

export default [
    config('src/index.ts', 'dist/mapbox-gl-csp.js', 'umd'),
    config('src/source/worker.ts', 'dist/mapbox-gl-csp-worker.js', 'iife')
];
