
import flowRemoveTypes from '@mapbox/flow-remove-types';
import buble from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import unassert from 'rollup-plugin-unassert';
import json from 'rollup-plugin-json';
import browserifyPlugin from 'rollup-plugin-browserify-transform';
import brfs from 'brfs';
import uglify from 'rollup-plugin-uglify';
import minifyStyleSpec from './rollup_plugin_minify_style_spec';

const production = process.env.BUILD === 'production';

// Common set of plugins/transformations shared across different rollup
// builds (main mapboxgl bundle, style-spec package, benchmarks bundle)

export const plugins = () => [
    flow(),
    minifyStyleSpec(),
    json(),
    buble({transforms: {dangerousForOf: true}, objectAssign: "Object.assign"}),
    production ? unassert() : false,
    resolve({
        browser: true,
        preferBuiltins: false
    }),
    browserifyPlugin(brfs, {
        include: 'src/shaders/index.js'
    }),
    commonjs({
        namedExports: {
            '@mapbox/whoots-js': ['getTileBBox']
        }
    }),
    production ? uglify() : false
].filter(Boolean);

// Using this instead of rollup-plugin-flow due to
// https://github.com/leebyron/rollup-plugin-flow/issues/5
export function flow() {
    return {
        name: 'flow-remove-types',
        transform: (code) => ({
            code: flowRemoveTypes(code).toString(),
            map: null
        })
    };
}

