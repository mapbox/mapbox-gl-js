import {describe, test, beforeAll, afterEach, afterAll, expect, waitFor, vi} from "../../util/vitest.js";
import {getNetworkWorker, http, HttpResponse, getPNGResponse} from '../../util/network.js';
import RasterTileSource from '../../../src/source/raster_tile_source.js';
import config from '../../../src/util/config.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import {RequestManager} from '../../../src/util/mapbox.js';
import sourceFixture from '../../fixtures/source.json';

function createSource(options, transformCallback) {
    const source = new RasterTileSource('id', options, {send() {}}, options.eventedParent);

    source.onAdd({
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback),
        style: {
            clearSource: () => {},
            getBrightness: () => { return 0.0; },
        }
    });

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

let networkWorker;

beforeAll(async () => {
    networkWorker = await getNetworkWorker(window);
});

afterEach(() => {
    networkWorker.resetHandlers();
});

afterAll(() => {
    networkWorker.stop();
});

describe('RasterTileSource', () => {
    test('transforms request for TileJSON URL', async () => {
        networkWorker.use(
            http.get('/source.json', async () => {
                return HttpResponse.json({
                    minzoom: 0,
                    maxzoom: 22,
                    attribution: "Mapbox",
                    tiles: ["http://example.com/{z}/{x}/{y}.png"],
                    bounds: [-47, -7, -45, -5]
                });
            }),
        );
        const transformSpy = vi.fn((url) => {
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
            expect(source.tileBounds.bounds).toEqual({_sw:{lng: -47, lat: -7}, _ne:{lng: -45, lat: 90}});
        }
    });

    test('respects TileJSON.bounds when loaded from TileJSON', async () => {
        networkWorker.use(
            http.get('/source.json', async () => {
                return HttpResponse.json({
                    minzoom: 0,
                    maxzoom: 22,
                    attribution: "Mapbox",
                    tiles: ["http://example.com/{z}/{x}/{y}.png"],
                    bounds: [-47, -7, -45, -5]
                });
            }),
        );
        const source = createSource({url: "/source.json"});

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
        }
    });

    test('transforms tile urls before requesting', async () => {
        networkWorker.use(
            http.get('/source.json', async () => {
                return HttpResponse.json({
                    minzoom: 0,
                    maxzoom: 22,
                    attribution: "Mapbox",
                    tiles: ["http://example.com/{z}/{x}/{y}.png"],
                    bounds: [-47, -7, -45, -5]
                });
            }),
            http.get('http://example.com/10/5/5.png', async () => {
                return new HttpResponse(await getPNGResponse());
            }),
        );
        const source = createSource({url: "/source.json"});
        const transformSpy = vi.spyOn(source.map._requestManager, 'transformRequest');
        const e = await waitFor(source, "data");

        if (e.sourceDataType === 'metadata') {
            const tile = {
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                state: 'loading',
                loadVectorData () {},
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
            networkWorker.use(
                http.get('/source.json', async () => {
                    return HttpResponse.json(sourceFixture);
                }),
                http.get('http://path.png/v4/path.png.json', async () => {
                    return HttpResponse.json({});
                }),
                http.get('http://path.png/v4/10/5/5@2x.png', async () => {
                    return new HttpResponse(await getPNGResponse());
                }),
                http.get('http://path.png/v4/10/5/5@2x.png32', async () => {
                    return new HttpResponse(await getPNGResponse());
                }),
                http.get('http://path.png/v4/10/5/5@2x.jpg70', async () => {
                    return new HttpResponse(await getPNGResponse());
                })
            );
            window.devicePixelRatio = 2;
            config.API_URL = 'http://path.png';
            config.REQUIRE_ACCESS_TOKEN = !!accessToken;
            if (accessToken) {
                config.ACCESS_TOKEN = accessToken;
            }

            const source = createSource({url});
            source.tiles = [`${url}/{z}/{x}/{y}.${extension}`];
            const urlNormalizerSpy = vi.spyOn(source.map._requestManager, 'normalizeTileURL');
            const tile = {
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                state: 'loading',
                loadVectorData () {},
                setExpiryData() {}
            };

            await new Promise((resolve) => {
                source.loadTile(tile, () => {
                    loadCb(urlNormalizerSpy);
                    resolve();
                });
            });
        }

        test('png extension', async () => {
            await makeMapboxSource('mapbox://path.png', 'png', (spy) => {
                expect(spy).toHaveBeenCalledTimes(1);
                expect(spy.mock.calls[0][0]).toEqual('mapbox://path.png/10/5/5.png');
                expect(spy.mock.calls[0][1]).toEqual(true);
            });
        });
        test('png32 extension', async () => {
            await makeMapboxSource('mapbox://path.png', 'png32', (spy) => {
                expect(spy).toHaveBeenCalledTimes(1);
                expect(spy.mock.calls[0][0]).toEqual('mapbox://path.png/10/5/5.png32');
                expect(spy.mock.calls[0][1]).toEqual(true);
            });
        });
        test('jpg70 extension', async () => {
            await makeMapboxSource('mapbox://path.png', 'jpg70', (spy) => {
                expect(spy).toHaveBeenCalledTimes(1);
                expect(spy.mock.calls[0][0]).toEqual('mapbox://path.png/10/5/5.jpg70');
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
        networkWorker.use(
            http.get('/source.json', async () => {
                return HttpResponse.json(sourceFixture);
            }),
        );
        const source = createSource({url: '/source.json'});

        const loadSpy = vi.spyOn(source, 'load');
        const clearSourceSpy = vi.spyOn(source.map.style, 'clearSource');

        await waitFor(source, 'data');
        networkWorker.resetHandlers();

        const responseSpy = vi.fn();

        networkWorker.use(
            http.get('/source.json', async ({request}) => {
                responseSpy.call(request);
                return HttpResponse.json({...sourceFixture, maxzoom: 22});
            }),
        );

        source.attribution = 'OpenStreetMap';
        source.reload();

        await waitFor(source, 'data');

        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(responseSpy).toHaveBeenCalledTimes(1);
        expect(clearSourceSpy).toHaveBeenCalledTimes(1);
        expect(clearSourceSpy).toHaveBeenCalledAfter(responseSpy);
    });

    test('supports url property updates', async () => {
        networkWorker.use(
            http.get('/source.json', async () => {
                return HttpResponse.json(sourceFixture);
            }),
            http.get('/new-source.json', async () => {
                return HttpResponse.json({...sourceFixture, minzoom: 0, maxzoom: 22});
            })
        );

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
