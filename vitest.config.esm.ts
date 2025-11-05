import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';
import {playwright} from '@vitest/browser-playwright';

const isCI = process.env.CI === 'true';

export default mergeConfig(baseConfig, defineConfig({
    test: {
        include: ['test/build/esm.test.ts'],
        browser: {
            provider: playwright({launchOptions: {channel: isCI ? 'chromium' : 'chrome'}}),
            instances: [
                {browser: 'chromium'},
            ],
        },
    }
}));
