import {plugins} from './build/rollup_plugins';


export default {
    // POC with running the browser tests in the browser
    input: 'test/util/test.js',
    output: {
        name: 'tape',
        format: 'iife',
        sourcemap: 'inline',
        indent: false,
        file: 'rollup/build/test/unit.js'
    },
    plugins: plugins(false, false, true)
}