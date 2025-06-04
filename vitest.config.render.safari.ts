import {defineConfig, mergeConfig} from 'vitest/config';
import baseRenderConfig from './vitest.config.render';

export default mergeConfig(baseRenderConfig, defineConfig({
    test: {
        browser: {
            provider: 'playwright',
            instances: [
                {browser: 'webkit'},
            ],
        }
    },
}));
