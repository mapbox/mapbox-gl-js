import {describe, test, expect, vi} from '../../util/vitest';
import {mockFetch, getPNGResponse} from '../../util/network';
import RasterDEMTileWorkerSource from '../../../src/source/raster_dem_tile_worker_source';
import DEMData from '../../../src/data/dem_data';
import {OverscaledTileID} from '../../../src/source/tile_id';

import type {WorkerSourceOptions} from '../../../src/source/worker_source';

describe('RasterDEMTileWorkerSource', () => {
    test('loads DEM tile via getArrayBuffer + createImageBitmap', async () => {
        const pngData = await getPNGResponse();
        mockFetch({
            'http://example.com/10/5/5.png': () => Promise.resolve(new Response(pngData))
        });

        const source = new RasterDEMTileWorkerSource({} as WorkerSourceOptions);

        const result = await source.loadTile({
            source: 'source',
            uid: 0,
            type: 'raster-dem',
            scope: '',
            request: {url: 'http://example.com/10/5/5.png'},
            encoding: 'mapbox',
        });

        expect(result).toBeTruthy();
        expect(result && result.dem instanceof DEMData).toBeTruthy();
        expect(result && typeof result.borderReady).toBe('boolean');
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test('abortTile cancels in-flight fetch', async () => {
        const source = new RasterDEMTileWorkerSource({} as WorkerSourceOptions);

        // Simulate an in-flight request
        const cancelSpy = vi.fn();
        source.loading[42] = {cancel: cancelSpy};

        source.abortTile({uid: 42, source: 'source', type: 'raster-dem', scope: ''});

        expect(cancelSpy).toHaveBeenCalledTimes(1);
        expect(source.loading[42]).toBeUndefined();
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test('abortTile is no-op when tile is not loading', async () => {
        const source = new RasterDEMTileWorkerSource({} as WorkerSourceOptions);
        source.abortTile({uid: 99, source: 'source', type: 'raster-dem', scope: ''});
        // no-op: just verifies it doesn't throw
    });

    test('loads DEM tile via tileProvider', async () => {
        const pngData = await getPNGResponse();
        const buffer = await new Response(pngData).arrayBuffer();
        const tileProvider = {loadTile: vi.fn().mockResolvedValue({data: buffer})};
        const source = new RasterDEMTileWorkerSource({tileProvider} as unknown as WorkerSourceOptions);

        const result = await source.loadTile({
            source: 'source',
            uid: 0,
            type: 'raster-dem',
            scope: '',
            tileID: new OverscaledTileID(1, 0, 1, 0, 0),
            request: {url: 'http://example.com/1/0/0.png'},
            encoding: 'mapbox',
        });

        expect(result && result.dem instanceof DEMData).toBeTruthy();
    });

    test('reuses ImageBitmap response from tileProvider without redecoding', async () => {
        // Build the bitmap *before* spying so the setup call isn't counted.
        const pngBlob = await getPNGResponse();
        const realBitmap = await createImageBitmap(pngBlob);

        const createSpy = vi.spyOn(globalThis, 'createImageBitmap');
        const tileProvider = {loadTile: vi.fn().mockResolvedValue({data: realBitmap})};
        const source = new RasterDEMTileWorkerSource({tileProvider} as unknown as WorkerSourceOptions);

        const result = await source.loadTile({
            source: 'source',
            uid: 0,
            type: 'raster-dem',
            scope: '',
            tileID: new OverscaledTileID(1, 0, 1, 0, 0),
            request: {url: 'http://example.com/1/0/0.png'},
            encoding: 'mapbox',
        });
        expect(result && result.dem instanceof DEMData).toBeTruthy();
        expect(createSpy).not.toHaveBeenCalled();
    });
});
