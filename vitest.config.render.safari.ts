import {defineConfig, mergeConfig} from 'vitest/config';
import baseRenderConfig from './vitest.config.render';
import {playwright} from '@vitest/browser-playwright';

export default mergeConfig(baseRenderConfig, defineConfig({
    test: {
        browser: {
            provider: playwright(),
            instances: [
                {browser: 'webkit'},
            ],
        }
    },
}));
