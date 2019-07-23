import {testPlugins} from './build/rollup_plugins';


export default {
    // POC with running the browser tests in the browser
    input: ['test/unit/util/browser.test.js'],
    output: {
        format: 'umd',
        sourcemap: 'inline',
        indent: false,
        file: 'rollup/build/test/unit.js'
    },
    treeshake: true,
    plugins: testPlugins
}