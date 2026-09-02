import {defineConfig} from 'vitest/config';
import {isCI} from './vitest.config.base.ts';

export default defineConfig({
    test: {
        include: ['test/bundlers/bundlers.test.ts'],
        testTimeout: 20_000,
        hookTimeout: 120_000,
        fileParallelism: false,
        retry: isCI ? 2 : 0,
    },
});
