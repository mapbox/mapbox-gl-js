/* eslint-disable flowtype/require-valid-file-annotation */
import {defineConfig, mergeConfig} from 'vite';
import baseConfig from './vitest.config.base.js';

export default mergeConfig(baseConfig, defineConfig({
    test: {
        browser: {
            name: 'chromium',
            provider: 'playwright',
            enabled: true,
            headless: true,
        },
        include: ['test/integration/csp-tests/**/*.test.js'],
        testTimeout: 10_000,
    },
    publicDir: 'test/integration/csp-tests/',
    server: {
        headers: {
            "Allow-CSP-From": "*",
        },
    },
}));
