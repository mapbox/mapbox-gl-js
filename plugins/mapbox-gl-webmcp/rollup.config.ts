import browserslistToEsbuild from 'browserslist-to-esbuild';
import esbuild from 'rollup-plugin-esbuild';
import {dts} from 'rollup-plugin-dts';

export default [{
    input: {'mapbox-gl-webmcp': 'src/index.ts', tools: 'src/tools/index.ts'},
    output: [
        {dir: 'dist', sourcemap: true},
        {dir: 'dist', sourcemap: true, format: 'cjs', entryFileNames: '[name].cjs'}
    ],
    external: ['mapbox-gl'],
    plugins: [esbuild({target: browserslistToEsbuild()})]
}, {
    input: {index: 'src/index.ts', 'tools/index': 'src/tools/index.ts'},
    output: {dir: 'dist'},
    external: ['mapbox-gl', 'mapbox-gl/esm'],
    plugins: [dts()]
}];
