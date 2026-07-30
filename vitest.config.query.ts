import {mergeConfig, defineConfig} from 'vitest/config';
import baseConfig, {isCI, chromiumBrowser} from './vitest.config.base';
import {integrationTests, setupIntegrationTestsMiddlewares, serveDistPlugin, suiteDirs} from './vitest.config.common';
import {agentForwardingPlugin} from './test/integration/lib/agent-forwarding';

export default mergeConfig(baseConfig, defineConfig({
    define: {
        'import.meta.env.VITE_CI': JSON.stringify(String(isCI)),
        'import.meta.env.VITE_UPDATE': JSON.stringify(String(process.env.UPDATE === 'true')),
        // Opt-in embedding of passed-test images in the report (local dev only;
        // forced off on CI to keep the report small).
        'import.meta.env.VITE_EMBED_PASSED_IMAGES': JSON.stringify(String(!isCI && process.env.EMBED_PASSED_IMAGES === 'true')),
        'import.meta.env.VITE_DIST_BUNDLE': JSON.stringify(process.env.QUERY_BUNDLE || 'esm'),
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
        agentForwardingPlugin(),
    ],
}));
