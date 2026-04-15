// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor, vi, afterEach} from '../../util/vitest';
import {getPNGResponse, mockFetch} from '../../util/network';
import RasterTileSource from '../../../src/source/raster_tile_source';
import config from '../../../src/util/config';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {RequestManager} from '../../../src/util/mapbox';
import sourceFixture from '../../fixtures/source.json';

function createSource(options, transformCallback, throwOnError = true) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const source = new RasterTileSource('id', options, {send() {}}, options.eventedParent);

    source.onAdd({
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        _requestManager: new RequestManager(transformCallback),
        _refreshExpiredTiles: true,
        style: {
            clearSource: () => {},
            getLut: () => { return null; },
            getBrightness: () => { return 0.0; },
        },
        painter: {},
        getWorldview: () => undefined
    });

    if (throwOnError) {
        source.on('error', (e) => {
            throw e.error;
        });
    }

    return source;
}

describe('RasterTileSource', () => {
    test('transforms request for TileJSON URL', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify({
                minzoom: 0,
                maxzoom: 22,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"],
                bounds: [-47, -7, -45, -5]
            }))
        });
        const transformSpy = vi.fn((url) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            return {url};
        });

        const source = createSource({url: "/source.json"}, transformSpy);

        expect(transformSpy.mock.calls[0][0]).toEqual('/source.json');
        expect(transformSpy.mock.calls[0][1]).toEqual('Source');

        await waitFor(source, 'data');
    });

    test('respects TileJSON.bounds', async () => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5]
        });

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
        }
    });

    test('does not error on invalid bounds', async () => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, 91]
        });

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.tileBounds.bounds).toEqual({_sw: {lng: -47, lat: -7}, _ne: {lng: -45, lat: 90}});
        }
    });

    test('respects TileJSON.bounds when loaded from TileJSON', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify({
                minzoom: 0,
                maxzoom: 22,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"],
                bounds: [-47, -7, -45, -5]
            }))
        });
        const source = createSource({url: "/source.json"});

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
        }
    });

    test('transforms tile urls before requesting', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify({
                minzoom: 0,
                maxzoom: 22,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"],
                bounds: [-47, -7, -45, -5]
            })),
            'http://example.com/10/5/5.png': async () => {
                return new Response(await getPNGResponse());
            }
        });
        const source = createSource({url: "/source.json"});
        const transformSpy = vi.spyOn(source.map._requestManager, 'transformRequest');
        const e = await waitFor(source, "data");

        if (e.sourceDataType === 'metadata') {
            const tile = {
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                state: 'loading',
                loadVectorData() {},
                setExpiryData() {}
            };

            await new Promise(resolve => {
                source.loadTile(tile, () => {
                    expect(transformSpy).toHaveBeenCalledTimes(1);
                    expect(transformSpy.mock.calls[0][0]).toEqual('http://example.com/10/5/5.png');
                    expect(transformSpy.mock.calls[0][1]).toEqual('Tile');
                    resolve();
                });
            });
        }
    });

    describe('adds @2x to requests on hidpi devices', () => {
        // helper function that makes a mock mapbox raster source and makes it load a tile
        async function makeMapboxSource(url, extension, loadCb, accessToken) {
            mockFetch({
                '/source.json': () => new Response(JSON.stringify(sourceFixture)),
                'http://path.png/v4/path.png.json': () => {
                    return new Response(JSON.stringify({}));
                },
                'http://path.png/v4/10/5/5@2x.png': async () => {
                    return new Response(await getPNGResponse());
                },
                'http://path.png/v4/10/5/5@2x.png32': async () => {
                    return new Response(await getPNGResponse());
                },
                'http://path.png/v4/10/5/5@2x.jpg70': async () => {
                    return new Response(await getPNGResponse());
                }
            });
            window.devicePixelRatio = 2;
            config.API_URL = 'http://path.png';
            config.REQUIRE_ACCESS_TOKEN = !!accessToken;
            if (accessToken) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                config.ACCESS_TOKEN = accessToken;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const source = createSource({url});
            source.tiles = [`${url}/{z}/{x}/{y}.${extension}`];
            const urlNormalizerSpy = vi.spyOn(source.map._requestManager, 'normalizeTileURL');
            const tile = {
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                state: 'loading',
                loadVectorData() {},
                setExpiryData() {}
            };

            await new Promise((resolve) => {
                source.loadTile(tile, () => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    loadCb(urlNormalizerSpy);
                    resolve();
                });
            });
        }

        test('png extension', async () => {
            await makeMapboxSource('mapbox://path.png', 'png', (spy) => {
                expect(spy).toHaveBeenCalledTimes(1);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(spy.mock.calls[0][0]).toEqual('mapbox://path.png/10/5/5.png');
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(spy.mock.calls[0][1]).toEqual(true);
            });
        });
        test('png32 extension', async () => {
            await makeMapboxSource('mapbox://path.png', 'png32', (spy) => {
                expect(spy).toHaveBeenCalledTimes(1);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(spy.mock.calls[0][0]).toEqual('mapbox://path.png/10/5/5.png32');
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(spy.mock.calls[0][1]).toEqual(true);
            });
        });
        test('jpg70 extension', async () => {
            await makeMapboxSource('mapbox://path.png', 'jpg70', (spy) => {
                expect(spy).toHaveBeenCalledTimes(1);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(spy.mock.calls[0][0]).toEqual('mapbox://path.png/10/5/5.jpg70');
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(spy.mock.calls[0][1]).toEqual(true);
            });
        });
    });

    test('cancels TileJSON request if removed', () => {
        const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
        const source = createSource({url: "/source.json"});
        source.onRemove();
        expect(abortSpy).toHaveBeenCalledTimes(1);
    });

    test('supports property updates', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture)),
        });
        const source = createSource({url: '/source.json'});

        const loadSpy = vi.spyOn(source, 'load');
        const clearSourceSpy = vi.spyOn(source.map.style, 'clearSource');

        await waitFor(source, 'data');

        const responseSpy = vi.fn();

        mockFetch({
            '/source.json': (request) => {
                responseSpy.call(request);
                return new Response(JSON.stringify(sourceFixture));
            },
        });

        source.attribution = 'OpenStreetMap';
        source.reload();

        await waitFor(source, 'data');

        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(responseSpy).toHaveBeenCalledTimes(1);
        expect(clearSourceSpy).toHaveBeenCalledTimes(1);
        expect(clearSourceSpy).toHaveBeenCalledAfter(responseSpy);
    });

    test('supports url property updates', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture)),
            '/new-source.json': () => new Response(JSON.stringify({...sourceFixture, minzoom: 0, maxzoom: 22}))
        });

        const source = createSource({url: '/source.json'});
        source.setUrl('/new-source.json');

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.minzoom).toEqual(0);
            expect(source.maxzoom).toEqual(22);
            expect(source.attribution).toEqual('Mapbox');
            expect(source.serialize()).toEqual({type: 'raster', url: '/new-source.json'});
        }
    });

    test('supports tiles property updates', async () => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: 'Mapbox',
            tiles: ['http://example.com/v1/{z}/{x}/{y}.png']
        });

        source.setTiles(['http://example.com/v2/{z}/{x}/{y}.png']);

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.serialize()).toEqual({
                type: 'raster',
                minzoom: 1,
                maxzoom: 10,
                attribution: 'Mapbox',
                tiles: ['http://example.com/v2/{z}/{x}/{y}.png']
            });
        }
    });
});

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
describe('RasterTileSource provider', () => {
    const savedApiUrl = config.API_URL;
    let providerId = 0;
    let currentProvider;

    function nextProvider() {
        currentProvider = `test-raster-provider-${++providerId}`;
        return currentProvider;
    }

    afterEach(() => {
        vi.restoreAllMocks();
        if (currentProvider) {
            delete config.TILE_PROVIDER_URLS[currentProvider];
        }
        config.API_URL = savedApiUrl;
    });

    function createProviderSource(providerName, options = {}) {
        const moduleUrl = 'http://example.com/mock-provider.js';
        config.TILE_PROVIDER_URLS[providerName] = moduleUrl;

        const source = new RasterTileSource('id', {
            type: 'raster',
            ...options,
        }, {send() {}}, options.eventedParent);

        source.map = {
            transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
            _getMapId: () => 1,
            _requestManager: new RequestManager(),
            _refreshExpiredTiles: true,
            style: {
                clearSource: () => {},
                getLut: () => null,
                getBrightness: () => 0.0,
            },
            painter: {},
            getWorldview: () => undefined,
        };

        return source;
    }

    describe('provider resolution in load()', () => {
        test('auto-detects .pmtiles URL and calls loadTileJSONWithProvider', () => {
            // Auto-detection extracts 'pmtiles' extension from the URL
            currentProvider = 'pmtiles';
            const source = createProviderSource('pmtiles', {url: 'https://example.com/tiles.pmtiles'});
            const spy = vi.spyOn(source, 'loadTileJSONWithProvider').mockReturnValue({cancel: () => {}});

            source.load();

            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({name: 'pmtiles'}),
                expect.any(Function),
            );
        });

        test('provider: false disables auto-detection', async () => {
            currentProvider = 'pmtiles';
            const source = createProviderSource('pmtiles', {
                url: 'https://example.com/tiles.pmtiles',
                provider: false,
            });
            const spy = vi.spyOn(source, 'loadTileJSONWithProvider');

            mockFetch({
                'https://example.com/tiles.pmtiles': () => new Response(JSON.stringify({
                    tiles: ['https://example.com/{z}/{x}/{y}.png'],
                })),
            });

            source.load();
            await waitFor(source, 'data');

            expect(spy).not.toHaveBeenCalled();
            expect(source._tileProvider).toBeUndefined();
        });

        test('unregistered provider name fires error event', async () => {
            const name = nextProvider();
            delete config.TILE_PROVIDER_URLS[name];

            const source = new RasterTileSource('id', {
                type: 'raster',
                provider: name,
                tiles: ['http://example.com/{z}/{x}/{y}.png'],
            }, {send() {}}, undefined);

            source.map = {
                _requestManager: new RequestManager(),
                _refreshExpiredTiles: true,
                style: {clearSource: () => {}, getLut: () => null, getBrightness: () => 0.0},
                painter: {},
                getWorldview: () => undefined,
            };

            const errorPromise = new Promise(resolve => {
                source.on('error', (e) => resolve(e.error));
            });

            source.load();

            const error = await errorPromise;
            expect(error.message).toContain(`TileProvider "${name}" is not registered`);
        });

    });

    describe('provider tile loading', () => {
        function makeTile(z = 3, x = 1, y = 2) {
            return {
                tileID: new OverscaledTileID(z, 0, z, x, y),
                state: 'loading',
                setTexture: vi.fn(),
                setExpiryData: vi.fn(),
                request: null,
            };
        }

        function makeSourceWithProvider(loadTileFn) {
            // Skip the throw-on-error listener so error-path tests can run.
            const source = createSource({
                tiles: ['http://example.com/{z}/{x}/{y}.png'],
            }, undefined, false);
            // Set tiles directly so loadTile() can compute URLs
            source.tiles = ['http://example.com/{z}/{x}/{y}.png'];
            source._tileProvider = {
                loadTile: loadTileFn,
            };
            return source;
        }

        test('normal tile load: ArrayBuffer → createImageBitmap → setTexture', async () => {
            const tileData = new ArrayBuffer(16);
            const mockBitmap = {width: 256, height: 256};
            vi.spyOn(globalThis, 'createImageBitmap').mockResolvedValue(mockBitmap);

            const source = makeSourceWithProvider(vi.fn().mockResolvedValue({data: tileData}));
            const tile = makeTile();

            await new Promise(resolve => {
                source.loadTile(tile, (err) => {
                    expect(err).toBeNull();
                    expect(tile.state).toBe('loaded');
                    expect(tile.setTexture).toHaveBeenCalledWith(mockBitmap, source.map.painter);
                    expect(globalThis.createImageBitmap).toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('null response returns 404 error for overscaling', async () => {
            const source = makeSourceWithProvider(vi.fn().mockResolvedValue(null));
            const tile = makeTile();

            await new Promise(resolve => {
                source.loadTile(tile, (err) => {
                    expect(err).toBeInstanceOf(Error);
                    expect(err.message).toBe('Tile not found');
                    expect(err.status).toBe(404);
                    expect(tile.state).toBe('errored');
                    resolve();
                });
            });
        });

        test('{data: null} sets state to loaded (empty tile)', async () => {
            const source = makeSourceWithProvider(vi.fn().mockResolvedValue({data: null}));
            const tile = makeTile();

            await new Promise(resolve => {
                source.loadTile(tile, (err) => {
                    expect(err).toBeNull();
                    expect(tile.state).toBe('loaded');
                    expect(tile.setTexture).not.toHaveBeenCalled();
                    resolve();
                });
            });
        });

        test('abortTile aborts the controller signal', async () => {
            let capturedSignal;
            const source = makeSourceWithProvider(vi.fn().mockImplementation((_tile, options) => {
                capturedSignal = options.signal;
                return new Promise(() => {}); // never resolves
            }));
            const tile = makeTile();

            source.loadTile(tile, () => {});

            // Allow microtask to run
            // eslint-disable-next-line no-promise-executor-return
            await new Promise(r => setTimeout(r, 0));

            expect(capturedSignal).toBeDefined();
            expect(capturedSignal.aborted).toBe(false);

            source.abortTile(tile);

            expect(capturedSignal.aborted).toBe(true);
        });

    });
});
