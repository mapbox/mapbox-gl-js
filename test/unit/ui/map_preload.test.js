import {describe, test, expect, waitFor, vi, createMap} from '../../util/vitest.js';
import {createStyleSource} from './map/util.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import {makeFQID} from '../../../src/util/fqid.js';

describe('preloadOnly', () => {
    test('easeTo with dynamic source', async () => {
        const map = createMap({
            interactive: true,
            style: {
                version: 8,
                center: [0, 0],
                zoom: 0,
                layers: [],
                sources: {}
            }
        });

        map.on('error', ({error}) => expect.unreachable(error.message));

        await waitFor(map, 'style.load');

        map.addSource('geojson', createStyleSource());
        await waitFor(map, 'idle');

        const spy = vi.spyOn(map.style._mergedOtherSourceCaches['geojson'], '_loadTile');

        map.flyTo({center: [0, 0], zoom: 1, preloadOnly: true});
        await waitFor(map, 'idle');

        // Expected tileIDs to preload
        const expectedTileIDs = new Set([
            new OverscaledTileID(0, 0, 0, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 1).key,
            new OverscaledTileID(1, 0, 1, 1, 1).key,
        ]);

        for (const call of spy.mock.calls) {
            const tileID = call[0].tileID.key;
            expect(expectedTileIDs.has(tileID)).toBe(true);
            expectedTileIDs.delete(tileID);
        }

        expect(expectedTileIDs.size).toBe(0);

        map.remove();
    });

    test('flyTo with static style', async () => {
        const map = createMap({
            interactive: true,
            style: {
                version: 8,
                center: [0, 0],
                zoom: 0,
                layers: [],
                sources: {geojson: createStyleSource()}
            }
        });

        map.on('error', ({error}) => expect.unreachable(error.message));

        await waitFor(map, 'style.load');

        const spy = vi.spyOn(map.style._mergedOtherSourceCaches['geojson'], '_loadTile');

        map.flyTo({center: [0, 0], zoom: 1, preloadOnly: true});
        await waitFor(map, 'idle');

        // Expected tileIDs to preload
        const expectedTileIDs = new Set([
            new OverscaledTileID(0, 0, 0, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 1).key,
            new OverscaledTileID(1, 0, 1, 1, 1).key,
        ]);

        for (const call of spy.mock.calls) {
            const tileID = call[0].tileID.key;
            expect(expectedTileIDs.has(tileID)).toBe(true);
            expectedTileIDs.delete(tileID);
        }

        expect(expectedTileIDs.size).toBe(0);

        map.remove();
    });

    test('flyTo with style import', async () => {
        const map = createMap({
            interactive: true,
            style: {
                version: 8,
                center: [0, 0],
                zoom: 0,
                layers: [],
                sources: {},
                imports: [{
                    id: 'basemap',
                    url: '',
                    data: {
                        version: 8,
                        layers: [],
                        sources: {geojson: createStyleSource()}
                    }
                }]
            }
        });

        map.on('error', ({error}) => expect.unreachable(error.message));

        await waitFor(map, 'style.load');

        const spy = vi.spyOn(map.style._mergedOtherSourceCaches[makeFQID('geojson', 'basemap')], '_loadTile');

        map.flyTo({center: [0, 0], zoom: 1, preloadOnly: true});
        await waitFor(map, 'idle');

        // Expected tileIDs to preload
        const expectedTileIDs = new Set([
            new OverscaledTileID(0, 0, 0, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 1).key,
            new OverscaledTileID(1, 0, 1, 1, 1).key,
        ]);

        for (const call of spy.mock.calls) {
            const tileID = call[0].tileID.key;
            expect(expectedTileIDs.has(tileID)).toBe(true);
            expectedTileIDs.delete(tileID);
        }

        expect(expectedTileIDs.size).toBe(0);

        map.remove();
    });
});
