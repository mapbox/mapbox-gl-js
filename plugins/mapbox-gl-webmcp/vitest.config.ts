import {defineConfig} from 'vitest/config';
import {chromiumBrowser} from '../../vitest.config.base.ts';

export default defineConfig({
    test: {
        projects: [{
            resolve: {alias: {'mapbox-gl': new URL('../../dist/esm-dev/mapbox-gl.js', import.meta.url).pathname}},
            test: {
                name: 'browser',
                include: ['test/mapbox_webmcp.test.ts'],
                browser: {enabled: true, headless: true, screenshotFailures: false, ...chromiumBrowser()}
            }
        }, {
            test: {name: 'node', include: ['test/package.test.ts']}
        }]
    }
});
