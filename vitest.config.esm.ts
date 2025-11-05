import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';

const isCI = process.env.CI === 'true';

export default mergeConfig(baseConfig, defineConfig({
    test: {
        include: ['test/build/esm.test.ts'],
        browser: {
            instances: [
                {browser: 'chromium', launch: {channel: isCI ? 'chromium' : 'chrome'}},
            ],
        },
    }
}));
