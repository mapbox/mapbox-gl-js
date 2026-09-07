import {createFilter} from '@rollup/pluginutils';
import arraybuffer from 'vite-plugin-arraybuffer';
import {playwright} from '@vitest/browser-playwright';

import type {BrowserConfigOptions, InlineConfig} from 'vitest/node';
import type {UserConfig} from 'vite';

export const isCI = process.env.CI === 'true';

const defaultReporters: InlineConfig['reporters'] = isCI ?
    [['verbose', {summary: false}]] :
    [['default']];

export function chromiumBrowser(extraLaunchOptions: Record<string, unknown> = {}): BrowserConfigOptions {
    const launchOptions = {channel: isCI ? 'chromium' : 'chrome', ...extraLaunchOptions};
    return {
        provider: playwright({launchOptions}),
        instances: [{browser: 'chromium'}],
    };
}

function glsl(include: string[]) {
    const filter = createFilter(include);
    return {
        name: 'glsl',
        transform(code, id) {
            if (!filter(id)) return;
            return {
                code: `export default ${JSON.stringify(code)};`
            };
        }
    };
}

const baseConfig: UserConfig = {
    test: {
        retry: isCI ? 2 : 0,
        testTimeout: 5_000,
        reporters: defaultReporters,
        fileParallelism: false,
        browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
        },
        restoreMocks: true,
        unstubGlobals: true,
    },
    plugins: [
        glsl(['./src/shaders/*.glsl', './3d-style/shaders/*.glsl']),
        arraybuffer(),
    ],
};

export default baseConfig;
