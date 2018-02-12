import flow from 'rollup-plugin-flow';
import buble from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import unassert from 'rollup-plugin-unassert';
import json from 'rollup-plugin-json';

export default [
    {
        input: 'style-spec.js',
        output: {
            name: 'mapboxGlStyleSpec',
            file: 'dist/index.js',
            format: 'umd'
        },
        plugins: [
            flow(),
            json(),
            buble({transforms: {dangerousForOf: true}, objectAssign: "Object.assign"}),
            unassert(),
            resolve({
                browser: true,
                preferBuiltins: false
            }),
            commonjs()
        ]
    }
]
