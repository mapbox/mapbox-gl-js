import os from 'node:os';
import {mergeConfig, defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';
import baseConfig, {isCI, chromiumBrowser} from './vitest.config.base';
import {integrationTests, setupIntegrationTestsMiddlewares, serveDistPlugin, suiteDirs} from './vitest.config.common';

import type {BrowserConfigOptions} from 'vitest/node';

const renderBrowser = process.env.RENDER_BROWSER || 'chromium';
const bundle = process.env.RENDER_BUNDLE || 'dev';

const getAngle = () => {
    if (os.platform() === 'darwin' && os.arch() === 'arm64') return '--use-angle=metal';
    if (os.platform() === 'win32') return '--use-angle=d3d11';
    return '--use-angle=gl';
};

const chromiumArgs = [
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=CalculateNativeWinOcclusion',
    '--disable-renderer-backgrounding',
    '--ash-no-nudges',
    getAngle(),
];
if (isCI) chromiumArgs.push('--ignore-gpu-blocklist');

const browsers: Record<string, BrowserConfigOptions> = {
    chromium: chromiumBrowser({args: chromiumArgs}),
    firefox: {provider: playwright(), headless: false, instances: [{browser: 'firefox'}]},
    webkit: {provider: playwright(), instances: [{browser: 'webkit'}]},
};
const browser = browsers[renderBrowser === 'safari' ? 'webkit' : renderBrowser];

export default mergeConfig(baseConfig, defineConfig({
    define: {
        'import.meta.env.VITE_CI': isCI,
        'import.meta.env.VITE_UPDATE': process.env.UPDATE != null,
        'import.meta.env.VITE_SPRITE_FORMAT': process.env.SPRITE_FORMAT != null ? JSON.stringify(process.env.SPRITE_FORMAT) : null,
        'import.meta.env.VITE_DIST_BUNDLE': JSON.stringify(bundle),
    },
    test: {
        setupFiles: ['./test/integration/render-tests/setup.ts'],
        include: ['test/integration/render-tests/index.test.ts'],
        browser: {headless: isCI,
            ui: false,
            viewport: {width: 1280, height: 720}, ...browser},
    },
    plugins: [
        setupIntegrationTestsMiddlewares({
            reportPath: 'test/integration/render-tests/render-tests.html',
        }),
        integrationTests({suiteDirs: suiteDirs('render-tests'), includeImages: true}),
        serveDistPlugin(),
    ],
}));
