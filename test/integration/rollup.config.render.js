import {plugins} from '../../build/rollup_plugins';

export default {
    input: 'test/integration/lib/render-browser.js',
    output: {
        name: 'queryTests',
        format: 'iife',
        sourcemap: 'inline',
        indent: false,
        file: 'test/integration/dist/render-test.js'
    },
    plugins: plugins(false, false),
    external: [ 'tape', 'mapboxgl' ]
};
