import {describe, test, beforeAll, beforeEach, afterEach, afterAll, expect, waitFor, vi} from "../../util/vitest.js";
import {getNetworkWorker, http, HttpResponse, getPNGResponse} from '../../util/network.js';
import RasterDEMTileSource from '../../../src/source/raster_dem_tile_source.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import {RequestManager} from '../../../src/util/mapbox.js';
import {extend} from '../../../src/util/util.js';

function createSource(options, transformCallback) {
    const source = new RasterDEMTileSource('id', options, {send() {}}, options.eventedParent);
    source.onAdd({
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback)
    });

    source.on('error', (e) => {
        expect.unreachable(e.error.message);
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
    test('create and serialize source', async () => {
        networkWorker.use(
            http.get('/source.json', () => {
                return HttpResponse.json({});
            }),
        );
        const transformSpy = vi.fn((url) => {
            return {url};
        });
        const options = {
            url: "/source.json",
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5],
            encoding: "terrarium",
            tileSize: 512,
            volatile: false
        };
        const source = createSource(options, transformSpy);
        source.load();
        expect(source.serialize()).toEqual(extend({type: "raster-dem"}, options));
        await waitFor(source, 'data');
    });

    test('transforms request for TileJSON URL', async () => {
        networkWorker.use(
            http.get('/source.json', async () => {
                return HttpResponse.json({
                    minzoom: 0,
                    maxzoom: 22,
                    attribution: "Mapbox",
                    tiles: ["http://example.com/{z}/{x}/{y}.pngraw"],
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

        await new Promise(resolve => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {
                    expect(transformSpy).toHaveBeenCalledTimes(1);
                    expect(transformSpy.mock.calls[0][0]).toEqual('http://example.com/10/5/5.png');
                    expect(transformSpy.mock.calls[0][1]).toEqual('Tile');
                    resolve();
                });
            }
        });
    });

    describe('getNeighboringTiles', () => {
        let source;
        beforeEach(async () => {
            networkWorker.use(
                http.get('/source.json', async () => {
                    return HttpResponse.json({
                        minzoom: 0,
                        maxzoom: 22,
                        attribution: "Mapbox",
                        tiles: ["http://example.com/{z}/{x}/{y}.png"]
                    });
                })
            );
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
