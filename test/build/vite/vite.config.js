import {resolve} from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
    build: {
        commonjsOptions: {
            include: [/mapbox-gl/],
        },
        rollupOptions: {
            input: {
                esm: resolve(__dirname, 'esm.html'),
                umd: resolve(__dirname, 'umd.html'),
            }
        }
    }
});
