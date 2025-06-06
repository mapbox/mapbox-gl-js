import {mergeConfig, defineConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';
import {integrationTests, setupIntegrationTestsMiddlewares} from './vitest.config.common';

const isCI = process.env.CI === 'true';

export default mergeConfig(baseConfig, defineConfig({
    define: {
        'import.meta.env.VITE_CI': isCI ? 'true' : 'false',
        'import.meta.env.VITE_UPDATE': process.env.UPDATE ? 'true' : 'false',
        'import.meta.env.VITE_SPRITE_FORMAT': process.env.SPRITE_FORMAT ? JSON.stringify(process.env.SPRITE_FORMAT) : 'null',
        'import.meta.env.VITE_DIST_BUNDLE': JSON.stringify('dev'),
    },
    test: {
        setupFiles: ['./test/integration/render-tests/setup.ts'],
        include: ['test/integration/render-tests/index.test.ts'],
        reporters: isCI ? [['verbose', {summary: false}]] : [['default']],
        browser: {
            headless: isCI,
            ui: false,
            fileParallelism: false,
            viewport: {
                width: 1280,
                height: 720,
            },
        }
    },
    plugins: [
        setupIntegrationTestsMiddlewares({reportPath: './test/integration/render-tests/render-tests.html'}),
        integrationTests({suiteDir: './test/integration/render-tests/', includeImages: true})
    ],
}));
