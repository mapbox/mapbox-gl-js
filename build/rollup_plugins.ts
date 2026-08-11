/* eslint-disable camelcase */
import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import strip from '@rollup/plugin-strip';
import replace from '@rollup/plugin-replace';
import {createFilter} from '@rollup/pluginutils';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import minifyStyleSpec from './rollup_plugin_minify_style_spec.js';
import {eliminateDeadBranches} from './glsl_dead_code.ts';

import type {InputPluginOption, Plugin} from 'rollup';

export type BundleFormat = 'umd' | 'csp' | 'esm';

export type BuildPluginOptions = {
    /** Bundle format, reported as `bundleFormat` in telemetry. */
    format: BundleFormat;
    /** Whether to minify the output. */
    minified: boolean;
    /** Whether this is a production build. */
    production: boolean;
    /** Whether this is a test build. */
    test: boolean;
    /** Whether to keep class names during minification. */
    keepClassNames: boolean;
};

/**
 * Common set of plugins/transformations shared across different rollup
 * builds (umd and esm mapboxgl bundles, style-spec package bundle)
 */
export const plugins = ({
    format,
    minified,
    production,
    test,
    keepClassNames
}: BuildPluginOptions): InputPluginOption[] => [
    minifyStyleSpec(),
    esbuild({
        target: browserslistToEsbuild(),
        minify: false,
        sourceMap: true,
        tsconfig: './tsconfig.browser.json',
        define: {
            'import.meta.env': JSON.stringify({format}),
        }
    }),
    json({
        exclude: 'src/style-spec/reference/v8.json'
    }),
    production ? strip({
        sourceMap: true,
        functions: ['assert', 'assert.*', 'PerformanceUtils.*', 'Debug.*', 'DevTools.*', 'StyleBOMUtils.*'],
        include: ['**/*.ts']
    }) : null,
    test ? replace({
        preventAssignment: true,
        values: {
            'process.env.CI': JSON.stringify(process.env.CI),
            'process.env.UPDATE': JSON.stringify(process.env.UPDATE)
        }
    }) : null,
    glsl(['./src/shaders/*.glsl', './3d-style/shaders/*.glsl']),
    minified ? terser({
        ecma: 2020,
        module: true,
        keep_classnames: keepClassNames,
        compress: {
            pure_getters: true,
            passes: 3
        },
        format: {
            comments: (node, comment) => comment.value.includes('webpackIgnore') || comment.value.includes('vite-ignore'),
        },
    }) : null,
    resolve({
        browser: true,
        preferBuiltins: false
    }),
    commonjs({
        // global keyword handling causes Webpack compatibility issues, so we disabled it:
        // https://github.com/mapbox/mapbox-gl-js/pull/6956
        ignoreGlobal: true
    }),
];

/**
 * GLSL Shader Transform Plugin
 *
 * Removes preprocessor branches GL JS can never reach (see `./glsl_dead_code.js`), then performs
 * lightweight minification: strips comments, collapses whitespace, and removes unnecessary line
 * breaks.
 *
 * Dead-branch elimination runs *before* the whitespace passes, while each directive is still
 * alone on its own line.
 *
 * @param include - Array of glob patterns to include
 */
function glsl(include: string[]): Plugin {
    const filter = createFilter(include);

    const COMMENT_REGEX = /\s*\/\/.*$/gm;
    const MULTILINE_REGEX = /\n+/g;
    const INDENT_REGEX = /\n\s+/g;
    const OPERATOR_REGEX = /\s?([+\-/*=,])\s?/g;
    const LINEBREAK_REGEX = /([;,{}])\n(?=[^#])/g;

    let deadBytesRemoved = 0;
    let filesAffected = 0;

    return {
        name: 'glsl',
        transform(code, id) {
            if (!filter(id)) return;

            code = code.trim() // strip whitespace at the start/end
                .replace(COMMENT_REGEX, ''); // strip double-slash comments

            const live = eliminateDeadBranches(code, undefined, id);
            if (live.length !== code.length) {
                deadBytesRemoved += code.length - live.length;
                filesAffected++;
            }

            code = live
                .replace(MULTILINE_REGEX, '\n') // collapse multi line breaks
                .replace(INDENT_REGEX, '\n') // strip indentation
                .replace(OPERATOR_REGEX, '$1') // strip whitespace around operators
                .replace(LINEBREAK_REGEX, '$1'); // strip more line breaks

            return {
                code: `export default ${JSON.stringify(code)};`,
                map: null
            };
        },
        buildEnd() {
            if (deadBytesRemoved > 0) {
                this.info(`glsl: removed ${deadBytesRemoved} bytes of gl-native-only branches from ${filesAffected} shaders`);
            }
        }
    };
}
