import {mergeConfig, defineConfig} from 'vitest/config';
import {existsSync} from 'fs';
import {playwright} from '@vitest/browser-playwright';
import baseConfig from './vitest.config.base';
import {integrationTests, setupIntegrationTestsMiddlewares} from './vitest.config.common';

const isCI = process.env.CI === 'true';

const suiteDirs = ['test/integration/query-tests'];
if (existsSync('internal/test/integration/query-tests')) {
    suiteDirs.push('internal/test/integration/query-tests');
}

export default mergeConfig(baseConfig, defineConfig({
    define: {
        'import.meta.env.VITE_CI': isCI,
        'import.meta.env.VITE_UPDATE': process.env.UPDATE != null,
        'import.meta.env.VITE_DIST_BUNDLE': JSON.stringify('dev'),
    },
    test: {
        include: ['test/integration/query-tests/index.test.ts'],
        reporters: isCI ? [['verbose', {summary: false}]] : [['default']],
        browser: {
            provider: playwright({launchOptions: {channel: isCI ? 'chromium' : 'chrome'}}),
            instances: [
                {browser: 'chromium'},
            ],
            headless: isCI,
            ui: false,
            viewport: {
                width: 1280,
                height: 720,
            },
        }
    },
    plugins: [
        setupIntegrationTestsMiddlewares({reportPath: 'test/integration/query-tests/query-tests.html'}),
        integrationTests({suiteDirs}),
    ],
}));
