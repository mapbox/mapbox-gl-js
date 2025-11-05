import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';
import {playwright} from '@vitest/browser-playwright';

const isCI = process.env.CI === 'true';

export default mergeConfig(baseConfig, defineConfig({
    test: {
        reporters: isCI ? [['verbose', {summary: false}]] : [['default']],
        browser: {
            provider: playwright({launchOptions: {channel: isCI ? 'chromium' : 'chrome'}}),
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
