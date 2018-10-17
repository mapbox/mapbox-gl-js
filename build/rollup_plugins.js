
import flowRemoveTypes from '@mapbox/flow-remove-types';
import buble from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import unassert from 'rollup-plugin-unassert';
import json from 'rollup-plugin-json';
import uglify from 'rollup-plugin-uglify';
import minifyStyleSpec from './rollup_plugin_minify_style_spec';
import { createFilter } from 'rollup-pluginutils';

const {BUILD, MINIFY} = process.env;
const minified = MINIFY === 'true';
const production = BUILD === 'production';

// Common set of plugins/transformations shared across different rollup
// builds (main mapboxgl bundle, style-spec package, benchmarks bundle)

export const plugins = () => [
    flow(),
    minifyStyleSpec(),
    json(),
    glsl('./src/shaders/*.glsl', production),
    buble({transforms: {dangerousForOf: true}, objectAssign: "Object.assign"}),
    production ? unassert() : false,
    resolve({
        browser: true,
        preferBuiltins: false
    }),
    commonjs({
        // global keyword handling causes Webpack compatibility issues, so we disabled it:
        // https://github.com/mapbox/mapbox-gl-js/pull/6956
        ignoreGlobal: true
    }),
    minified ? uglify() : false
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

// Using this instead of rollup-plugin-string to add minification
function glsl(include, minify) {
    const filter = createFilter(include);
    return {
        name: 'glsl',
        transform(code, id) {
            if (!filter(id)) return;

            // barebones GLSL minification
            if (minify) {
                code = code.trim() // strip whitespace at the start/end
                    .replace(/\s*\/\/[^\n]*\n/g, '\n') // strip double-slash comments
                    .replace(/\n+/g, '\n') // collapse multi line breaks
                    .replace(/\n\s+/g, '\n') // strip identation
                    .replace(/\s?([+-\/*=,])\s?/g, '$1') // strip whitespace around operators
                    .replace(/([;\(\),\{\}])\n(?=[^#])/g, '$1'); // strip more line breaks
            }

            return {
                code: `export default ${JSON.stringify(code)};`,
                map: {mappings: ''}
            };
        }
    };
}
