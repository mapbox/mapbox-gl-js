import {describe, test, expect, vi} from '../../util/vitest';
import {mockFetch, getPNGResponse} from '../../util/network';
import RasterDEMTileWorkerSource from '../../../src/source/raster_dem_tile_worker_source';
import DEMData from '../../../src/data/dem_data';

import type {WorkerSourceOptions, WorkerSourceDEMTileRequest, WorkerSourceDEMTileResult} from '../../../src/source/worker_source';

describe('RasterDEMTileWorkerSource', () => {
    test('loads DEM tile via getArrayBuffer + createImageBitmap', async () => {
        const pngData = await getPNGResponse();
        mockFetch({
            'http://example.com/10/5/5.png': () => Promise.resolve(new Response(pngData))
        });

        const source = new RasterDEMTileWorkerSource({} as WorkerSourceOptions);

        await new Promise<void>((resolve, reject) => {
            source.loadTile({
                source: 'source',
                uid: 0,
                type: 'raster-dem',
                scope: '',
                request: {url: 'http://example.com/10/5/5.png'},
                encoding: 'mapbox',
            } as WorkerSourceDEMTileRequest, (err?: Error | null, result?: WorkerSourceDEMTileResult | null) => {
                if (err) return reject(err);
                expect(result).toBeTruthy();
                expect(result && result.dem instanceof DEMData).toBeTruthy();
                expect(result && typeof result.borderReady).toBe('boolean');
                resolve();
            });
        });
    });

    test('abortTile cancels in-flight fetch', () => {
        const source = new RasterDEMTileWorkerSource({} as WorkerSourceOptions);

        // Simulate an in-flight request
        const cancelSpy = vi.fn();
        source.loading[42] = {cancel: cancelSpy};

        source.abortTile({uid: 42, source: 'source', type: 'raster-dem', scope: ''}, () => {});

        expect(cancelSpy).toHaveBeenCalledTimes(1);
        expect(source.loading[42]).toBeUndefined();
    });

    test('abortTile is no-op when tile is not loading', () => {
        const source = new RasterDEMTileWorkerSource({} as WorkerSourceOptions);
        const callbackSpy = vi.fn();

        source.abortTile({uid: 99, source: 'source', type: 'raster-dem', scope: ''}, callbackSpy);

        expect(callbackSpy).toHaveBeenCalledTimes(1);
    });
});
