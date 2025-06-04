import {mergeConfig, defineConfig} from 'vitest/config';
import renderChromiumConfig from './vitest.config.render.chromium';

export default mergeConfig(renderChromiumConfig, defineConfig({
    define: {
        'import.meta.env.VITE_DIST_BUNDLE': JSON.stringify('prod'),
    }
}));
