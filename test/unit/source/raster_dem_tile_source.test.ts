import {describe, test, beforeEach, afterEach, expect, vi} from 'vitest';
import RasterDEMTileSource from '../../../src/source/raster_dem_tile_source';
import {waitFor} from '../../util/vitest';
import {Evented} from '../../../src/util/evented';
import {mockFetch} from '../../util/network';
import {RequestManager} from '../../../src/util/mapbox';
import {OverscaledTileID} from '../../../src/source/tile_id';
import config from '../../../src/util/config';

import type Tile from '../../../src/source/tile';
import type Dispatcher from '../../../src/util/dispatcher';
import type {Map as MapboxMap} from '../../../src/ui/map';
import type {RequestTransformFunction} from '../../../src/util/mapbox';
import type {RasterDEMSourceSpecification} from '../../../src/style-spec/types';

function createSource(options: Partial<RasterDEMSourceSpecification>, transformCallback?: RequestTransformFunction) {
    const dispatcher = {
        send() {},
        getActor() {
            return {
                send() {
                    return {cancel() {}};
                }
            };
        }
    } as unknown as Dispatcher;
    const source = new RasterDEMTileSource('id', options as RasterDEMSourceSpecification, dispatcher, new Evented());
    source.onAdd({
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback),
        getWorldview: () => undefined
    } as unknown as MapboxMap);

    source.on('error', (e) => {
        expect.unreachable(e.error.message);
    });

    return source;
}

describe('RasterTileSource', () => {
    test('create and serialize source', async () => {
        mockFetch({
            '/source.json': () => Promise.resolve(new Response(JSON.stringify({})))
        });
        const transformSpy = vi.fn<RequestTransformFunction>((url) => {
            return {url};
        });
        const options: Partial<RasterDEMSourceSpecification> = {
            url: "/source.json",
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5] as [number, number, number, number],
            encoding: "terrarium",
            tileSize: 512,
            volatile: false
        };
        const source = createSource(options, transformSpy);
        source.load();
        expect(source.serialize()).toEqual(Object.assign({type: "raster-dem"}, options));
        await waitFor(source, 'data');
    });

    test('transforms request for TileJSON URL', async () => {
        mockFetch({
            '/source.json': () => Promise.resolve(new Response(JSON.stringify({
                minzoom: 0,
                maxzoom: 22,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.pngraw"],
                bounds: [-47, -7, -45, -5]
            })))
        });
        const transformSpy = vi.fn<RequestTransformFunction>((url) => {
            return {url};
        });

        const source = createSource({url: "/source.json"}, transformSpy);

        expect(transformSpy.mock.calls[0][0]).toEqual('/source.json');
        expect(transformSpy.mock.calls[0][1]).toEqual('Source');

        await waitFor(source, 'data');
    });

    test('transforms tile urls before requesting', async () => {
        mockFetch({
            '/source.json': () => Promise.resolve(new Response(JSON.stringify({
                minzoom: 0,
                maxzoom: 22,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"],
                bounds: [-47, -7, -45, -5]
            }))),
        });
        const source = createSource({url: "/source.json"});
        const transformSpy = vi.spyOn(source.map._requestManager, 'transformRequest');
        const e = await waitFor(source, "data") as {sourceDataType?: string};
        expect(e.sourceDataType).toBe('metadata');

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData() {},
            setExpiryData() {}
        } as unknown as Tile;
        source.loadTile(tile, () => {});
        // transformRequest is called synchronously when building params for the worker
        expect(transformSpy).toHaveBeenCalledTimes(1);
        expect(transformSpy.mock.calls[0][0]).toEqual('http://example.com/10/5/5.png');
        expect(transformSpy.mock.calls[0][1]).toEqual('Tile');
    });

    test('null worker result marks tile as loaded (empty tile)', async () => {
        // When the worker delivers (null, null) — e.g., provider returned
        // {data: null} for a sparse area — the main-thread done() handler must
        // set tile.state = 'loaded' so SourceCache doesn't keep re-requesting.
        const dispatcher = {
            send() {},
            getActor() {
                return {
                    send: (_type: string, _params: unknown, cb: (err?: Error | null, result?: unknown) => void) => {
                        Promise.resolve().then(() => cb(null, null));
                        return {cancel() {}};
                    }
                };
            }
        } as unknown as Dispatcher;

        const source = new RasterDEMTileSource(
            'id',
            {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']} as RasterDEMSourceSpecification,
            dispatcher,
            new Evented(),
        );
        // Skip onAdd's load() flow (no fetch mock); set up directly for loadTile.
        source.map = {
            _requestManager: new RequestManager(),
            _refreshExpiredTiles: true,
            getWorldview: () => undefined,
        } as unknown as MapboxMap;
        source.tiles = ['http://example.com/{z}/{x}/{y}.png'];

        const tile = {
            uid: 0,
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {},
        } as unknown as Tile;

        await new Promise<void>((resolve) => {
            source.loadTile(tile, (err) => {
                expect(err).toBeNull();
                expect(tile.state).toBe('loaded');
                resolve();
            });
        });
    });

    describe('getNeighboringTiles', () => {
        let source: RasterDEMTileSource;
        beforeEach(async () => {
            mockFetch({
                '/source.json': () => Promise.resolve(new Response(JSON.stringify({
                    minzoom: 0,
                    maxzoom: 22,
                    attribution: "Mapbox",
                    tiles: ["http://example.com/{z}/{x}/{y}.png"]
                })))
            });

            source = createSource({url: "/source.json"});

            await waitFor(source, 'data');
        });

        test('getNeighboringTiles', () => {
            expect(
                Uint32Array.from(Object.keys(source._getNeighboringTiles(new OverscaledTileID(10, 0, 10, 5, 5)))).sort()
            ).toEqual(Uint32Array.from([
                new OverscaledTileID(10, 0, 10, 4, 5).key,
                new OverscaledTileID(10, 0, 10, 6, 5).key,
                new OverscaledTileID(10, 0, 10, 4, 4).key,
                new OverscaledTileID(10, 0, 10, 5, 4).key,
                new OverscaledTileID(10, 0, 10, 6, 4).key,
                new OverscaledTileID(10, 0, 10, 4, 6).key,
                new OverscaledTileID(10, 0, 10, 5, 6).key,
                new OverscaledTileID(10, 0, 10, 6, 6).key
            ]).sort());
        });

        test('getNeighboringTiles with wrapped tiles', () => {
            expect(
                Uint32Array.from(Object.keys(source._getNeighboringTiles(new OverscaledTileID(5, 0, 5, 31, 5)))).sort()
            ).toEqual(Uint32Array.from([
                new OverscaledTileID(5, 0, 5, 30, 6).key,
                new OverscaledTileID(5, 0, 5, 31, 6).key,
                new OverscaledTileID(5, 0, 5, 30, 5).key,
                new OverscaledTileID(5, 1, 5, 0,  5).key,
                new OverscaledTileID(5, 0, 5, 30, 4).key,
                new OverscaledTileID(5, 0, 5, 31, 4).key,
                new OverscaledTileID(5, 1, 5, 0,  4).key,
                new OverscaledTileID(5, 1, 5, 0,  6).key
            ]).sort());
        });
    });
});

describe('RasterDEMTileSource provider', () => {
    const savedApiUrl = config.API_URL;
    let providerId = 0;
    let currentProvider: string;

    function nextProvider() {
        currentProvider = `test-raster-dem-provider-${++providerId}`;
        return currentProvider;
    }

    afterEach(() => {
        vi.restoreAllMocks();
        if (currentProvider) {
            delete config.TILE_PROVIDER_URLS[currentProvider];
        }
        config.API_URL = savedApiUrl;
    });

    function createProviderSource(
        providerName: string,
        options: Record<string, unknown> = {},
        overrides: {broadcastResult?: unknown[]; broadcastError?: Error} = {},
    ) {
        const moduleUrl = 'http://example.com/mock-provider.js';
        config.TILE_PROVIDER_URLS[providerName] = moduleUrl;

        const {broadcastResult, broadcastError} = overrides;
        const broadcastSpy = vi.fn((_type: string, _data: unknown, cb?: (err: Error | null, result?: unknown[]) => void) => {
            if (!cb) return;
            if (broadcastError) {
                cb(broadcastError);
            } else {
                cb(null, broadcastResult !== undefined ? broadcastResult : [null]);
            }
        });

        const dispatcher = {
            send() {},
            getActor() { return {send() { return {cancel() {}}; }}; },
            ready: true,
            broadcast: broadcastSpy,
        } as unknown as Dispatcher;

        const source = new RasterDEMTileSource(
            'id',
            {type: 'raster-dem', ...options} as RasterDEMSourceSpecification,
            dispatcher,
            new Evented(),
        );

        source.onAdd({
            transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
            _getMapId: () => 1,
            _requestManager: new RequestManager(),
            _refreshExpiredTiles: true,
            style: {clearSource: () => {}, getLut: () => null, getBrightness: () => 0.0},
            painter: {},
            getWorldview: () => undefined,
        } as unknown as MapboxMap);

        return {source, broadcastSpy};
    }

    test('broadcasts loadTileProvider when provider resolves', () => {
        const name = nextProvider();
        const {source, broadcastSpy} = createProviderSource(name, {
            provider: name,
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
        });

        expect(broadcastSpy).toHaveBeenCalledWith(
            'loadTileProvider',
            expect.objectContaining({name, source: 'id', type: 'raster-dem'}),
            expect.any(Function),
        );
        expect(source.tiles).toEqual(['http://example.com/{z}/{x}/{y}.png']);
    });

    test('uses provider TileJSON when workers return it', () => {
        const name = nextProvider();
        const tileJSON = {
            tiles: ['http://provider.example.com/{z}/{x}/{y}.png'],
            minzoom: 2,
            maxzoom: 16,
        };
        const {source} = createProviderSource(name, {provider: name}, {broadcastResult: [tileJSON]});

        expect(source.tiles).toEqual(['http://provider.example.com/{z}/{x}/{y}.png']);
        expect(source.minzoom).toEqual(2);
        expect(source.maxzoom).toEqual(16);
    });

    test('falls back to options.tiles when workers return no TileJSON', () => {
        const name = nextProvider();
        const {source} = createProviderSource(name, {
            provider: name,
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
        }, {broadcastResult: [null]});

        expect(source.tiles).toEqual(['http://example.com/{z}/{x}/{y}.png']);
        expect(source._loaded).toBe(true);
    });

    test('fires error when provider is not registered', async () => {
        const name = `unregistered-dem-provider-${++providerId}`;
        delete config.TILE_PROVIDER_URLS[name];

        const dispatcher = {
            send() {},
            getActor() { return {send() { return {cancel() {}}; }}; },
            ready: true,
            broadcast: vi.fn(),
        } as unknown as Dispatcher;

        const source = new RasterDEMTileSource(
            'id',
            {type: 'raster-dem', provider: name, tiles: ['http://example.com/{z}/{x}/{y}.png']} as unknown as RasterDEMSourceSpecification,
            dispatcher,
            new Evented(),
        );

        const errorPromise = waitFor(source, 'error') as Promise<{error: Error}>;

        source.onAdd({
            transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
            _getMapId: () => 1,
            _requestManager: new RequestManager(),
            _refreshExpiredTiles: true,
            style: {clearSource: () => {}, getLut: () => null, getBrightness: () => 0.0},
            painter: {},
            getWorldview: () => undefined,
        } as unknown as MapboxMap);

        const e = await errorPromise;
        expect(e.error.message).toMatch(new RegExp(`TileProvider "${name}" is not registered`));
    });

});

