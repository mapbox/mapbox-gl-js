/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable camelcase */

import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import unassert from 'rollup-plugin-unassert';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import strip from '@rollup/plugin-strip';
import replace from '@rollup/plugin-replace';
import {createFilter} from '@rollup/pluginutils';
import minifyStyleSpec from './rollup_plugin_minify_style_spec.js';

// Common set of plugins/transformations shared across different rollup
// builds (main mapboxgl bundle, style-spec package, benchmarks bundle)

export const plugins = ({minified, production, test, bench, keepClassNames}) => [
    minifyStyleSpec(),
    esbuild({
        // We target `esnext` and disable minification so esbuild
        // doesn't transform the code, which we'll minify later with the terser
        target: 'esnext',
        minify: false,
        sourceMap: true,
    }),
    json({
        exclude: 'src/style-spec/reference/v8.json'
    }),
    (production && !bench) ? strip({
        sourceMap: true,
        functions: ['PerformanceUtils.*', 'WorkerPerformanceUtils.*', 'Debug.*'],
        include:['**/*.ts']
    }) : false,
    production || bench ? unassert({include: ['*.js', '**/*.js', '*.ts', '**/*.ts']}) : false,
    test ? replace({
        preventAssignment: true,
        values: {
            'process.env.CI': JSON.stringify(process.env.CI),
            'process.env.UPDATE': JSON.stringify(process.env.UPDATE)
        }
    }) : false,
    glsl(['./src/shaders/*.glsl', './3d-style/shaders/*.glsl'], production),
    minified ? terser({
        ecma: 2020,
        module: true,
        keep_classnames: keepClassNames,
        compress: {
            pure_getters: true,
            passes: 3
        },
    }) : false,
    resolve({
        browser: true,
        preferBuiltins: false,
        mainFields: ['browser', 'main']
    }),
    commonjs({
        // global keyword handling causes Webpack compatibility issues, so we disabled it:
        // https://github.com/mapbox/mapbox-gl-js/pull/6956
        ignoreGlobal: true
    }),
].filter(Boolean);

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
                    .replace(/\n\s+/g, '\n') // strip indentation
                    .replace(/\s?([+-\/*=,])\s?/g, '$1') // strip whitespace around operators
                    .replace(/([;,\{\}])\n(?=[^#])/g, '$1'); // strip more line breaks
            }

            return {
                code: `export default ${JSON.stringify(code)};`,
                map: {mappings: ''}
            };
        }
    };
}
