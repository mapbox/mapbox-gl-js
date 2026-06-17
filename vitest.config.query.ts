import {mergeConfig, defineConfig} from 'vitest/config';
import baseConfig, {isCI, chromiumBrowser} from './vitest.config.base';
import {integrationTests, setupIntegrationTestsMiddlewares, serveDistPlugin, suiteDirs} from './vitest.config.common';

export default mergeConfig(baseConfig, defineConfig({
    define: {
        'import.meta.env.VITE_CI': isCI,
        'import.meta.env.VITE_UPDATE': process.env.UPDATE != null,
        'import.meta.env.VITE_DIST_BUNDLE': JSON.stringify('dev'),
    },
    test: {
        include: ['test/integration/query-tests/index.test.ts'],
        browser: Object.assign(chromiumBrowser(), {
            headless: isCI,
            ui: false,
            viewport: {
                width: 1280,
                height: 720,
            },
        })
    },
    plugins: [
        setupIntegrationTestsMiddlewares({
            reportPath: 'test/integration/query-tests/query-tests.html',
        }),
        integrationTests({suiteDirs: suiteDirs('query-tests')}),
        serveDistPlugin(),
    ],
}));
