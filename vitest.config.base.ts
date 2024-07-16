import {defineConfig} from 'vitest/config';
import {createFilter} from '@rollup/pluginutils';
import arraybuffer from 'vite-plugin-arraybuffer';

function glsl(include: string[]) {
    const filter = createFilter(include);
    return {
        name: 'glsl',
        transform(code, id) {
            if (!filter(id)) return;
            return {
                code: `export default ${JSON.stringify(code)};`
            };
        }
    };
}

export default defineConfig({
    test: {
        pool: 'threads',
        poolOptions: {
            threads: {
                isolate: false,
                useAtomics: true,
                singleThread: true
            }
        },
        retry: 2,
        testTimeout: 5_000,
        browser: {
            name: 'chromium',
            provider: 'playwright',
            enabled: true,
            headless: true,
            fileParallelism: false,
        },
        restoreMocks: true,
        unstubGlobals: true,
    },
    plugins: [
        glsl(['./src/shaders/*.glsl', './3d-style/shaders/*.glsl']),
        arraybuffer(),
    ],
});
