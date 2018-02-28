import replace from 'rollup-plugin-replace';
import {plugins} from '../../build/rollup_plugins';
const config = [{
    input: `${__dirname}/style-spec.js`,
    output: {
        name: 'mapboxGlStyleSpecification',
        file: `${__dirname}/dist/index.js`,
        format: 'umd',
        sourcemap: true
    },
    plugins: [
        // https://github.com/zaach/jison/issues/351
        replace({
            include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
            delimiters: ['', ''],
            values: {
                '_token_stack:': ''
            }
        })
    ].concat(plugins())
}];
export default config;
