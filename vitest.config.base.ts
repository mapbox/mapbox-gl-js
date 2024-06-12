// @ts-nocheck
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

import {defineConfig} from 'vite';
import {createFilter} from '@rollup/pluginutils';
import alias from '@rollup/plugin-alias';
import arraybuffer from 'vite-plugin-arraybuffer';

function glsl(include: string[]) {
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
            build.onLoad({filter: regexp}, async (args: {path: string}) => {
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
                fixAssertUtil()
            ]
        },
        include: [
            'assert'
        ]
    },
    plugins: [
        glsl(['./src/shaders/*.glsl', './3d-style/shaders/*.glsl']),
        arraybuffer(),
    ],
});
