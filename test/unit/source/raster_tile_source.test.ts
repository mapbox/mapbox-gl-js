// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor, vi} from '../../util/vitest';
import {getPNGResponse, mockFetch} from '../../util/network';
import RasterTileSource from '../../../src/source/raster_tile_source';
import config from '../../../src/util/config';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {RequestManager} from '../../../src/util/mapbox';
import sourceFixture from '../../fixtures/source.json';

function createSource(options, transformCallback) {
    const source = new RasterTileSource('id', options, {send() {}}, options.eventedParent);

    source.onAdd({
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback),
        style: {
            clearSource: () => {},
            getLut: () => { return null; },
            getBrightness: () => { return 0.0; },
        },
        getWorldview: () => undefined
    });

    source.on('error', (e) => {
        throw e.error;
    });

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
                config.ACCESS_TOKEN = accessToken;
            }

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
