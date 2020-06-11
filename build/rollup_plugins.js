
import flowRemoveTypes from '@mapbox/flow-remove-types';
import buble from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import unassert from 'rollup-plugin-unassert';
import json from 'rollup-plugin-json';
import {terser} from 'rollup-plugin-terser';
import minifyStyleSpec from './rollup_plugin_minify_style_spec';
import {createFilter} from 'rollup-pluginutils';
import strip from '@rollup/plugin-strip';
import GLSLOptimizer from 'glsl-optimizer-emcc';

function glslOptimize() {}

GLSLOptimizer().then((Module) => {
    // eslint-disable-next-line no-func-assign
    glslOptimize = Module.cwrap('optimize_glsl', 'string', ['string', 'number', 'number']);
});

// Common set of plugins/transformations shared across different rollup
// builds (main mapboxgl bundle, style-spec package, benchmarks bundle)

export const plugins = (minified, production) => [
    flow(),
    minifyStyleSpec(),
    json(),
    production ? strip({
        sourceMap: true,
        functions: ['PerformanceUtils.*', 'Debug.*']
    }) : false,
    glsl('./src/shaders/*.glsl', production),
    buble({transforms: {dangerousForOf: true}, objectAssign: "Object.assign"}),
    minified ? terser({
        compress: {
            pure_getters: true,
            passes: 3
        }
    }) : false,
    production ? unassert() : false,
    resolve({
        browser: true,
        preferBuiltins: false
    }),
    commonjs({
        // global keyword handling causes Webpack compatibility issues, so we disabled it:
        // https://github.com/mapbox/mapbox-gl-js/pull/6956
        ignoreGlobal: true
    })
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
            let optimizedShader = glslOptimize(code, 2, id.includes('vertex'));
            let failed = false;
            if (!optimizedShader || optimizedShader.length === 0) {
                optimizedShader = code;
                failed = true;
            }
            if (id.includes('symbol_sdf.vertex.glsl') ||
                id.includes('symbol_text_and_icon.vertex.glsl')) {
                optimizedShader = code;
                failed = true;
            }
            if (!failed) {
                const re = /#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g;
                let initializePragmas = '';
                let definePragmas = '';
                code.replace(re, (match, operation, precision, type, name) => {
                    if (operation === 'initialize') {
                        initializePragmas += match + '\n';
                    } else {
                        definePragmas += match + '\n';
                    }
                });
                optimizedShader = optimizedShader.replace(/void main([\s]*)\(\)([\s]*){/g, (match) => {
                    return definePragmas + 'void main(){\n' + initializePragmas;
                });
            }
            // barebones GLSL minification
            if (minify) {
                optimizedShader = optimizedShader.trim() // strip whitespace at the start/end
                    .replace(/\s*\/\/[^\n]*\n/g, '\n') // strip double-slash comments
                    .replace(/\n+/g, '\n') // collapse multi line breaks
                    .replace(/\n\s+/g, '\n') // strip identation
                    .replace(/\s?([+-\/*=,])\s?/g, '$1') // strip whitespace around operators
                    .replace(/([;\(\),\{\}])\n(?=[^#])/g, '$1'); // strip more line breaks
            }
            console.log(id, failed, optimizedShader);
            return {
                code: `export default ${JSON.stringify(optimizedShader)};`,
                map: {mappings: ''}
            };
        }
    };
}
