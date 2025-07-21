import {mergeConfig, defineConfig} from 'vitest/config';
import {existsSync} from 'fs';
import baseConfig from './vitest.config.base';
import {integrationTests, setupIntegrationTestsMiddlewares} from './vitest.config.common';

const isCI = process.env.CI === 'true';

const suiteDirs = ['test/integration/query-tests'];
if (existsSync('internal/test/integration/query-tests')) {
    suiteDirs.push('internal/test/integration/query-tests');
}

export default mergeConfig(baseConfig, defineConfig({
    define: {
        'import.meta.env.VITE_CI': isCI ? 'true' : 'false',
        'import.meta.env.VITE_UPDATE': process.env.UPDATE ? 'true' : 'false',
        'import.meta.env.VITE_DIST_BUNDLE': JSON.stringify('dev'),
    },
    test: {
        include: ['test/integration/query-tests/index.test.ts'],
        reporters: isCI ? [['verbose', {summary: false}]] : [['default']],
        browser: {
            instances: [
                {browser: 'chromium', launch: {channel: isCI ? 'chromium' : 'chrome'}},
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
