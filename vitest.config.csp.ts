import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';

const isCI = process.env.CI === 'true';

export default mergeConfig(baseConfig, defineConfig({
    test: {
        reporters: isCI ? [['verbose', {summary: false}]] : [['default']],
        browser: {
            instances: [
                {browser: 'chromium', launch: {channel: isCI ? 'chromium' : 'chrome'}},
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
