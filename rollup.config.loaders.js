
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

// a config for generating GLTF loaders bundle that gets lazy-loaded when GL JS encounters a style with 3D models

export default {
    input: 'rollup/loaders.js',
    output: {
        name: 'mapboxglLoaders',
        file: 'dist/mapbox-gl-loaders.js',
        format: 'iife',
        sourcemap: false,
        indent: false
    },
    treeshake: true,
    plugins: [
        terser(),
        resolve({
            browser: true,
            preferBuiltins: false,
            mainFields: ['browser', 'main']
        }),
        commonjs({ignoreGlobal: true})
    ]
};
