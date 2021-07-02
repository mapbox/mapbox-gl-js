import {plugins} from '../../build/rollup_plugins.js';

const suiteName = process.env.SUITE_NAME;

export default {
    input: `test/integration/lib/${suiteName}.js`,
    output: {
        name: `${suiteName}Tests`,
        format: 'iife',
        sourcemap: 'inline',
        indent: false,
        file: `test/integration/dist/integration-test.js`
    },
    plugins: plugins(false, false, true),
    external: [ 'tape', 'mapboxgl' ]
};
