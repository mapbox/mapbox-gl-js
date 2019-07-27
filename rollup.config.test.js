import {plugins} from './build/rollup_plugins';


export default {
    input: 'test/unit/ui/**/*.js',
    output: {
        name: 'test',
        format: 'iife',
        sourcemap: 'inline',
        indent: false,
        file: 'rollup/build/test/unit.js'
    },
    plugins: plugins(false, false, true),
    external: [ 'tape' ]
}