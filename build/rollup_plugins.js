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
import browserslistToEsbuild from 'browserslist-to-esbuild';
import minifyStyleSpec from './rollup_plugin_minify_style_spec.js';

/**
 * Common set of plugins/transformations shared across different rollup
 * builds (umd and esm mapboxgl bundles, style-spec package, benchmarks bundle)
 *
 * @param {Object} options
 * @param {string | 'dev' | 'bench' | 'production'} [options.mode] - build mode
 * @param {string | 'esm' | 'umd'} [options.format] - output format
 * @param {boolean} [options.minified] - whether to minify the output
 * @param {boolean} [options.production] - whether this is a production build
 * @param {boolean} [options.test] - whether this is a test build
 * @param {boolean} [options.bench] - whether this is a benchmark build
 * @param {boolean} [options.keepClassNames] - whether to keep class names during minification
 */
export const plugins = ({mode, format, minified, production, test, bench, keepClassNames}) => [
    minifyStyleSpec(),
    esbuild({
        target: browserslistToEsbuild(),
        minify: false,
        sourceMap: true,
        define: {
            'import.meta.env': JSON.stringify({mode}),
        }
    }),
    json({
        exclude: 'src/style-spec/reference/v8.json'
    }),
    (production && !bench) ? strip({
        sourceMap: true,
        functions: ['PerformanceUtils.*', 'WorkerPerformanceUtils.*', 'Debug.*', 'DevTools.*'],
        include: ['**/*.ts']
    }) : false,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    production || bench ? unassert({include: ['*.js', '**/*.js', '*.ts', '**/*.ts']}) : false,
    test ? replace({
        preventAssignment: true,
        values: {
            'process.env.CI': JSON.stringify(process.env.CI),
            'process.env.UPDATE': JSON.stringify(process.env.UPDATE)
        }
    }) : false,
    glsl(['./src/shaders/*.glsl', './3d-style/shaders/*.glsl']),
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
        preferBuiltins: false
    }),
    commonjs({
        // global keyword handling causes Webpack compatibility issues, so we disabled it:
        // https://github.com/mapbox/mapbox-gl-js/pull/6956
        ignoreGlobal: true
    }),
].filter(Boolean);

/**
 * GLSL Shader Transform Plugin
 * Performs lightweight minification: strips comments, collapses whitespace, and removes unnecessary line breaks.
 * @param {string[]} include - Array of glob patterns to include
 * @returns {import('rollup').Plugin} - Rollup plugin object
 */
function glsl(include) {
    const filter = createFilter(include);

    const COMMENT_REGEX = /\s*\/\/.*$/gm;
    const MULTILINE_REGEX = /\n+/g;
    const INDENT_REGEX = /\n\s+/g;
    const OPERATOR_REGEX = /\s?([+\-/*=,])\s?/g;
    const LINEBREAK_REGEX = /([;,{}])\n(?=[^#])/g;

    return {
        name: 'glsl',
        transform(code, id) {
            if (!filter(id)) return;

            // GLSL minification
            code = code.trim() // strip whitespace at the start/end
                .replace(COMMENT_REGEX, '') // strip double-slash comments
                .replace(MULTILINE_REGEX, '\n') // collapse multi line breaks
                .replace(INDENT_REGEX, '\n') // strip indentation
                .replace(OPERATOR_REGEX, '$1') // strip whitespace around operators
                .replace(LINEBREAK_REGEX, '$1'); // strip more line breaks

            return {
                code: `export default ${JSON.stringify(code)};`,
                map: {mappings: ''}
            };
        }
    };
}
