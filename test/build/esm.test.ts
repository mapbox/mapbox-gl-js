import {describe, test, expect} from 'vitest';
import {waitFor} from '../util/vitest';

import type MapboxGL from '../../src/index';

function testEsmBundle(name: string, importPath: string) {
    describe(name, async () => {
        const mapboxgl = await import(importPath).then((module: {default: typeof MapboxGL}) => module.default);

        expect(mapboxgl.Map).toBeDefined();
        expect(mapboxgl.version).toBeDefined();

        test('Simple map', async () => {
            const container = document.createElement('div');
            container.style.width = '400px';
            container.style.height = '300px';
            document.body.appendChild(container);

            const map = new mapboxgl.Map({
                testMode: true,
                container,
                zoom: 1,
                center: [0, 0],
                style: {version: 8, sources: {}, layers: []}
            });

            map.on('error', ({error}) => expect.unreachable(error.message));

            await waitFor(map, 'load');

            expect(map.getContainer()).toBe(container);
            const canvas = container.querySelector('canvas.mapboxgl-canvas');
            expect(canvas).toBeTruthy();
        });
    });
}

testEsmBundle('ESM NPM bundle', '/dist/esm/mapbox-gl.js');
testEsmBundle('ESM CDN bundle', '/dist/esm-cdn/mapbox-gl.js');
