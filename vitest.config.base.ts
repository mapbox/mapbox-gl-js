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
        pool: 'forks',
        retry: process.env.CI ? 2 : 0,
        testTimeout: 5_000,
        browser: {
            provider: 'playwright',
            enabled: true,
            headless: true,
            fileParallelism: false,
            screenshotFailures: false,
        },
        restoreMocks: true,
        unstubGlobals: true,
    },
    plugins: [
        glsl(['./src/shaders/*.glsl', './3d-style/shaders/*.glsl']),
        arraybuffer(),
    ],
});
