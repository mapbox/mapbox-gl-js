import {mergeConfig, defineConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';
import {integrationTests, setupIntegrationTestsMiddlewares} from './vitest.config.common';

export default mergeConfig(baseConfig, defineConfig({
    define: {
        'import.meta.env.VITE_CI': process.env.CI ? 'true' : 'false',
        'import.neta.env.VITE_UPDATE': process.env.UPDATE ? 'true' : 'false',
        'import.meta.env.VITE_DIST_BUNDLE': JSON.stringify('dev'),
    },
    test: {
        include: ['test/integration/query-tests/index.test.ts'],
        reporters: process.env.CI ? [
            ['html', {outputFile: './test/integration/query-tests/vitest/index.html'}],
            ['junit', {outputFile: './test/integration/query-tests/vitest/test-results.xml'}],
            ['default']
        ] : [['default']],
        browser: {
            instances: [{browser: 'chromium'}],
            headless: Boolean(process.env.CI),
            ui: false,
            viewport: {
                width: 1280,
                height: 720,
            },
        }
    },
    plugins: [
        setupIntegrationTestsMiddlewares('query'),
        integrationTests('query', false)
    ],
}));
