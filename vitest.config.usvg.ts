import {basename} from 'path';
import {readFileSync} from 'fs';
import virtual from '@rollup/plugin-virtual';
import {globSync} from 'glob';
import {mergeConfig, defineConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';

const isCI = process.env.CI === 'true';

// base64 encoded PNG fixtures
const fixtures = globSync(['./test/usvg/test-suite/*.png', './test/usvg/mapbox_usvg_pb_test_suite/*.png']).reduce((acc, pngPath) => {
    const name = basename(pngPath, '.png');
    const base64Data = readFileSync(pngPath, 'base64');
    acc[name] = base64Data;
    return acc;
}, {});

export default mergeConfig(baseConfig, defineConfig({
    test: {
        browser: {
            instances: [
                {browser: 'chromium', launch: {channel: isCI ? 'chromium' : 'chrome'}},
            ],
        },
        retry: 0,
        include: ['./test/usvg/*.test.ts'],
        setupFiles: ['./test/usvg/setup.ts'],
        reporters: isCI ? [['verbose', {summary: false}]] : [['default']],
    },
    plugins: [
        virtual({
            'virtual:usvg-fixtures': `export const fixtures = ${JSON.stringify(fixtures)};`
        })
    ]
}));
