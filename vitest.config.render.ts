import {mergeConfig, defineConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';
import {integrationTests, setupIntegrationTestsMiddlewares} from './vitest.config.common';

export default mergeConfig(baseConfig, defineConfig({
    define: {
        'import.meta.env.VITE_CI': process.env.CI ? 'true' : 'false',
        'import.meta.env.VITE_UPDATE': process.env.UPDATE ? 'true' : 'false',
        'import.meta.env.VITE_SPRITE_FORMAT': process.env.SPRITE_FORMAT ? JSON.stringify(process.env.SPRITE_FORMAT) : 'null',
        'import.meta.env.VITE_DIST_BUNDLE': JSON.stringify('dev'),
    },
    test: {
        setupFiles: ['./test/integration/render-tests/setup.ts'],
        include: ['test/integration/render-tests/index.test.ts'],
        reporters: process.env.CI ? [
            ['html', {outputFile: './test/integration/render-tests/vitest/index.html'}],
            ['junit', {outputFile: './test/integration/render-tests/test-results.xml'}],
            ['verbose']
        ] : [['default']],
        poolOptions: {
            forks: {
                singleFork: true,
            },
            threads: {
                singleThread: true,
            }
        },
        browser: {
            headless: Boolean(process.env.CI),
            ui: false,
            fileParallelism: false,
            viewport: {
                width: 1280,
                height: 720,
            },
        }
    },
    plugins: [
        setupIntegrationTestsMiddlewares('render'),
        integrationTests('render')
    ],
}));
