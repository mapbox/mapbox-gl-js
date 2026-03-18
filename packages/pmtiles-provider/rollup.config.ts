import {readFileSync} from 'fs';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';
import commonjs from '@rollup/plugin-commonjs';
import browserslistToEsbuild from 'browserslist-to-esbuild';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {version: string};
const banner = `/* @mapbox/mapbox-gl-pmtiles-provider v${pkg.version} | Mapbox Terms of Service */`;

export default {
    input: 'src/pmtiles_provider.ts',
    output: {
        file: 'dist/mapbox-gl-pmtiles-provider.js',
        format: 'es',
        sourcemap: true,
        indent: false,
        banner
    },
    treeshake: {preset: 'recommended'},
    plugins: [
        esbuild({target: browserslistToEsbuild(), sourceMap: true}),
        resolve({browser: true, preferBuiltins: false}),
        commonjs({ignoreGlobal: true}),
        terser({ecma: 2020, module: true})
    ]
};
