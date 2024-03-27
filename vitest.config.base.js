/* eslint-disable flowtype/require-valid-file-annotation */
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

import {join as pathJoin} from 'node:path';
import {defineConfig} from 'vite';
import {createFilter} from '@rollup/pluginutils';
import alias from '@rollup/plugin-alias';
import flowRemoveTypes from '@mapbox/flow-remove-types';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import arraybuffer from 'vite-plugin-arraybuffer';

const TYPING_DIRS = [
    '3d-style',
    'src'
];

// Borrowed from flow-esbuild-plugin
function flowEsbuildPlugin(regexp = /$^/) {
    return {
        name: 'flow',
        setup(build) {
            build.onLoad({filter: regexp}, async (args) => {
                const source = await readFile(args.path, 'utf8');
                let output = source;
                if (source.slice(0, 200).includes('@flow')) {
                    output = flowRemoveTypes(source, {pretty: true});
                }

                return {
                    contents: output.toString(),
                    loader: 'jsx',
                };
            });
        },
    };
}

function flow() {
    return {
        enforce: 'pre',
        name: 'flow-remove-types',
        transform: (code) => ({
            code: flowRemoveTypes(code).toString(),
            map: null
        })
    };
}

function glsl(include) {
    const filter = createFilter(include);
    return {
        name: 'glsl',
        transform(code, id) {
            if (!filter(id)) return;
            return {
                code: `export default ${JSON.stringify(code)};`,
                map: {mappings: ''}
            };
        }
    };
}

function fixAssertUtil(regexp = /node_modules\/assert/) {
    return {
        name: 'fix-assert-util',
        setup(build) {
            build.onLoad({filter: regexp}, async (args) => {
                const source = await readFile(args.path, 'utf8');

                return {
                    contents: source.replace(/util\/'/g, 'util\'').toString(),
                    loader: 'jsx',
                };
            });
        },
    };
}

export default defineConfig({
    pool: 'threads',
    poolOptions: {
        threads: {
            isolate: false,
            useAtomics: true,
            singleThread: true
        }
    },
    test: {
        testTimeout: 5_000,
        browser: {
            name: 'chromium',
            provider: 'playwright',
            enabled: true,
            headless: true,
            slowHijackESM: false,
            fileParallelism: false,
        },
        restoreMocks: true,
        unstubGlobals: true
    },
    optimizeDeps: {
        esbuildOptions: {
            plugins: [
                flowEsbuildPlugin(new RegExp(`^${pathJoin(process.cwd(), `(${TYPING_DIRS.join('|')})/`)}.*\.js`)),
                fixAssertUtil()
            ]
        },
        include: [
            'assert'
        ]
    },
    plugins: [
        nodePolyfills(),
        flow(),
        glsl(['./src/shaders/*.glsl', './3d-style/shaders/*.glsl']),
        arraybuffer(),
        alias({
            entries: [
                {find: 'tracked_parameters_proxy', replacement: fileURLToPath(new URL('src/tracked-parameters/internal/tracked_parameters_mock.js', import.meta.url))}
            ]
        }),
    ],
});
