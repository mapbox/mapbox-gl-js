import {test, describe, expect, vi} from '../../util/vitest';
import VectorTileWorkerSource from '../../../src/source/vector_tile_worker_source';
import StyleLayerIndex from '../../../src/style/style_layer_index';
import {isHttpNotFound} from '../../../src/util/ajax';
import {getProjection} from '../../../src/geo/projection/index';
import {processTileJSON} from '../../../src/source/tile_provider';

import type {TileProvider, TileDataResponse} from '../../../src/source/tile_provider';
import type {RequestParameters} from '../../../src/util/ajax';
import type {RequestManager} from '../../../src/util/mapbox';
import type {WorkerSourceOptions, WorkerSourceVectorTileRequest} from '../../../src/source/worker_source';

type Tile = {z: number; x: number; y: number};
type TileOptions = {request: RequestParameters; signal: AbortSignal};

const actor = {send: () => {}, scheduler: undefined} as unknown as WorkerSourceOptions['actor'];

function makeParams(): WorkerSourceVectorTileRequest {
    return {
        type: 'vector',
        uid: 1,
        source: 'test-source',
        scope: '',
        tileID: {overscaledZ: 3, wrap: 0, canonical: {x: 1, y: 2, z: 3}},
        tileZoom: 3,
        zoom: 3,
        maxZoom: 22,
        tileSize: 512,
        pixelRatio: 1,
        showCollisionBoxes: false,
        promoteId: null,
        brightness: 0,
        scaleFactor: 1,
        lut: null,
        projection: getProjection({name: 'mercator'}),
        request: {url: 'http://example.com/tile'},
    } as unknown as WorkerSourceVectorTileRequest;
}

function makeSource(
    loadTileFn: (tile: Tile, options: TileOptions) => Promise<TileDataResponse<ArrayBuffer> | null>,
) {
    const provider: TileProvider<ArrayBuffer> = {
        loadTile(tile: Tile, options: TileOptions) { return loadTileFn(tile, options); }
    };
    return new VectorTileWorkerSource({
        actor,
        layerIndex: new StyleLayerIndex(),
        availableImages: [],
        availableModels: {},
        isSpriteLoaded: true,
        tileProvider: provider,
    });
}

test('loadTileData with provider - happy path with TileDataResponse', async () => {
    const data = new ArrayBuffer(8);
    const loadTile = vi.fn<(tile: Tile, options: TileOptions) => Promise<TileDataResponse<ArrayBuffer>>>()
        .mockResolvedValue({data, cacheControl: 'max-age=300', expires: 'Thu, 01 Jan 2099 00:00:00 GMT'});

    const source = makeSource(loadTile);
    const callback = vi.fn();

    source.loadTileData(makeParams(), callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(callback).toHaveBeenCalledWith(null, {
        rawData: data,
        responseHeaders: new Map([
            ['cache-control', 'max-age=300'],
            ['expires', 'Thu, 01 Jan 2099 00:00:00 GMT'],
        ]),
    });

    expect(loadTile).toHaveBeenCalledWith(
        {z: 3, x: 1, y: 2},
        expect.objectContaining({
            request: {url: 'http://example.com/tile'},
        }),
    );
});

test('loadTile with provider - null response produces 404 that triggers SourceCache overscaling', async () => {
    const source = makeSource(vi.fn().mockResolvedValue(null));
    const callback = vi.fn();

    source.loadTile(makeParams(), callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    // loadTile propagates the error from loadTileData to its callback.
    // SourceCache._tileLoaded checks isHttpNotFound(err) to decide
    // whether to look up a parent tile for overscaling.
    const err = callback.mock.calls[0][0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Tile not found');
    expect(isHttpNotFound(err)).toBe(true);
});

test('loadTileData with provider - {data: null} produces empty tile callback', async () => {
    const source = makeSource(vi.fn().mockResolvedValue({data: null}));
    const callback = vi.fn();

    source.loadTileData(makeParams(), callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(callback).toHaveBeenCalledWith(null, null);
});

test('loadTileData with provider - rejection propagates as Error', async () => {
    const source = makeSource(vi.fn().mockRejectedValue(new Error('network failure')));
    const callback = vi.fn();
    source.loadTileData(makeParams(), callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());
    const err = callback.mock.calls[0][0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('network failure');
});

test('loadTileData with provider - cancellation aborts and ignores settlement', async () => {
    let resolve: (value: TileDataResponse<ArrayBuffer>) => void = (_v) => {};
    const loadTile = vi.fn()
        .mockImplementation(() => {
            return new Promise<TileDataResponse<ArrayBuffer>>(r => { resolve = r; });
        });

    const source = makeSource(loadTile);
    const callback = vi.fn();

    const cancel = source.loadTileData(makeParams(), callback);

    cancel();

    // After cancel, callback should NOT have been called (abort just returns early)
    expect(callback).not.toHaveBeenCalled();

    resolve({data: new ArrayBuffer(4)});
    // Wait a tick - the abort guard should prevent callback from being called
    await new Promise<void>(r => { setTimeout(r, 10); });
    expect(callback).not.toHaveBeenCalled();
});

describe('processTileJSON', () => {
    function mockRequestManager(): RequestManager {
        return {
            canonicalizeTileset: vi.fn((_result: unknown, _url: unknown) => ['https://canonical/{z}/{x}/{y}']),
        } as unknown as RequestManager;
    }

    test('returns processed TileJSON when tileJSON is provided', () => {
        const rm = mockRequestManager();
        const options = {type: 'vector' as const, url: 'https://example.com/tiles'};
        const tileJSON = {tiles: ['https://example.com/{z}/{x}/{y}.pbf']};

        const result = processTileJSON(options, tileJSON, rm);
        expect(result).not.toBeInstanceOf(Error);
        expect(result).toHaveProperty('tiles');
    });

    test('falls back to options.tiles when tileJSON is null and tiles exist', () => {
        const rm = mockRequestManager();
        const tiles = ['https://example.com/{z}/{x}/{y}.pbf'];
        const options = {type: 'vector' as const, tiles};

        const result = processTileJSON(options, null, rm);
        expect(result).not.toBeInstanceOf(Error);
        expect(result).toEqual({tiles});
    });

    test('returns Error when tileJSON is null and no tiles available', () => {
        const rm = mockRequestManager();
        const options = {type: 'vector' as const, url: 'https://example.com/tiles'};

        const result = processTileJSON(options, null, rm);
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toBe('TileJSON is missing required "tiles" property');
    });

});

