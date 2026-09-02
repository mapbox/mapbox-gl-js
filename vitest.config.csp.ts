import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig, {chromiumBrowser} from './vitest.config.base.ts';
import {serveDistPlugin} from './vitest.config.common.ts';

export default mergeConfig(baseConfig, defineConfig({
    test: {
        browser: chromiumBrowser(),
        include: ['test/integration/csp-tests/**/*.test.ts'],
        testTimeout: 10_000,
    },
    publicDir: 'test/integration/csp-tests/',
    plugins: [serveDistPlugin()],
    server: {
        headers: {
            'Allow-CSP-From': '*',
        },
    },
}));
