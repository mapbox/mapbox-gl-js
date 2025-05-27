import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';

export default mergeConfig(baseConfig, defineConfig({
    test: {
        browser: {
            instances: [
                {browser: 'chromium'},
            ],
        },
        include: ['test/integration/csp-tests/**/*.test.ts'],
        testTimeout: 10_000,
    },
    publicDir: 'test/integration/csp-tests/',
    server: {
        headers: {
            'Allow-CSP-From': '*',
        },
    },
}));
