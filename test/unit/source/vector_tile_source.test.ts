// @ts-nocheck
import {describe, test, expect, waitFor, vi, doneAsync} from '../../util/vitest';
import {mockFetch} from '../../util/network';
import VectorTileSource from '../../../src/source/vector_tile_source';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {Evented} from '../../../src/util/evented';
import {RequestManager} from '../../../src/util/mapbox';
import sourceFixture from '../../fixtures/source.json';

const wrapDispatcher = (dispatcher) => {
    return {
        getActor() {
            return dispatcher;
        },
        ready: true
    };
};

const mockDispatcher = wrapDispatcher({
    send () {}
});

function createSource(options, {transformCallback, customAccessToken} = {}) {
    const source = new VectorTileSource('id', options, mockDispatcher, options.eventedParent);

    source.onAdd({
        getWorldview() { },
        getScaleFactor() { return 1; },
        transform: {showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback, customAccessToken),
        style: {
            clearSource: () => {},
            getLut: () => { return null; },
            getBrightness: () => { return 0.0; },
        }
    });

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

describe('VectorTileSource', () => {
    test('can be constructed from TileJSON', async () => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.tiles).toEqual(["http://example.com/{z}/{x}/{y}.png"]);
            expect(source.minzoom).toEqual(1);
            expect(source.maxzoom).toEqual(10);
            expect(source.attribution).toEqual("Mapbox");
        }
    });

    test('can be constructed from a TileJSON URL', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture))
        });

        const source = createSource({url: "/source.json"});

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.tiles).toEqual(["http://example.com/{z}/{x}/{y}.png"]);
            expect(source.minzoom).toEqual(1);
            expect(source.maxzoom).toEqual(10);
            expect(source.attribution).toEqual("Mapbox");
        }
    });

    test('transforms the request for TileJSON URL', () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture))
        });
        const transformSpy = vi.fn((url) => {
            return {url};
        });

        createSource({url: "/source.json"}, {transformCallback: transformSpy});
        expect(transformSpy.mock.calls[0][0]).toEqual('/source.json');
        expect(transformSpy.mock.calls[0][1]).toEqual('Source');
    });

    test('fires event with metadata property', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture))
        });
        const source = createSource({url: "/source.json"});
        await new Promise(resolve => {
            source.on('data', (e) => {
                if (e.sourceDataType === 'content') {
                    resolve();
                }
            });
        });
    });

    test('fires "dataloading" event', async () => {
        const {wait, withAsync} = doneAsync();
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture))
        });
        const evented = new Evented();
        let dataloadingFired = false;
        evented.on('dataloading', () => {
            dataloadingFired = true;
        });
        const source = createSource({url: "/source.json", eventedParent: evented});
        source.on('data', withAsync((e, doneRef) => {
            if (e.sourceDataType === 'metadata') {
                if (!dataloadingFired) expect.unreachable();
                doneRef.resolve();
            }
        }));

        await wait;
    });

    test('serialize URL', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture))
        });
        const source = createSource({
            url: "http://localhost:2900/source.json"
        });

        expect(source.serialize()).toEqual({
            type: 'vector',
            url: "http://localhost:2900/source.json"
        });

        await waitFor(source, 'data');
    });

    test('serialize TileJSON', () => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        expect(source.serialize()).toEqual({
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
    });

    function testScheme(scheme, expectedURL) {
        test(`scheme "${scheme}"`, async () => {
            const {wait, withAsync} = doneAsync();
            const source = createSource({
                minzoom: 1,
                maxzoom: 10,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"],
                scheme
            });

            source.dispatcher = wrapDispatcher({
                send: withAsync((type, params, _, __, ___, doneRef) => {
                    expect(type).toEqual('loadTile');
                    expect(expectedURL).toEqual(params.request.url);
                    doneRef.resolve();
                })
            });

            source.on('data', (e) => {
                if (e.sourceDataType === 'metadata') source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5)
                }, () => {});
            });

            await wait;
        });
    }

    testScheme('xyz', 'http://example.com/10/5/5.png');
    testScheme('tms', 'http://example.com/10/5/1018.png');

    function testRemoteScheme(scheme, expectedURL) {
        test(`remote scheme "${scheme}"`, async () => {
            const {wait, withAsync} = doneAsync();
            mockFetch({
                '/source.json': () => new Response(JSON.stringify({...sourceFixture, scheme}))
            });

            const source = createSource({url: "/source.json"});

            source.dispatcher = wrapDispatcher({
                send(type, params) {
                    expect(type).toEqual('loadTile');
                    expect(expectedURL).toEqual(params.request.url);
                }
            });

            source.on('data', withAsync((e, doneRef) => {
                if (e.sourceDataType === 'metadata') {
                    expect(source.scheme).toEqual(scheme);
                    source.loadTile({
                        tileID: new OverscaledTileID(10, 0, 10, 5, 5)
                    }, () => {});
                    doneRef.resolve();
                }
            }));
            await wait;
        });
    }

    testRemoteScheme('xyz', 'http://example.com/10/5/5.png');
    testRemoteScheme('tms', 'http://example.com/10/5/1018.png');

    test('transforms tile urls before requesting', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture))
        });

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
            source.loadTile(tile, () => {});
            expect(transformSpy).toHaveBeenCalledTimes(1);
            expect(transformSpy.mock.calls[0][0]).toEqual('http://example.com/10/5/5.png');
            expect(transformSpy.mock.calls[0][1]).toEqual('Tile');
        }
    });

    test('canonicalizes tile URLs in inline TileJSON', async () => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["https://api.mapbox.com/v4/user.map/{z}/{x}/{y}.png?access_token=key"]
        });
        const transformSpy = vi.spyOn(source.map._requestManager, 'transformRequest');
        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.tiles).toEqual(["mapbox://tiles/user.map/{z}/{x}/{y}.png?access_token=key"]);
            const tile = {
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                state: 'loading',
                loadVectorData () {},
                setExpiryData() {}
            };
            source.loadTile(tile, () => {});
            expect(transformSpy).toHaveBeenCalledTimes(1);
            expect(transformSpy.mock.calls[0][0]).toEqual(
                `https://api.mapbox.com/v4/user.map/10/5/5.png?sku=${source.map._requestManager._skuToken}&access_token=key`
            );
            expect(transformSpy.mock.calls[0][1]).toEqual('Tile');
        }
    });

    test('reloads a loading tile properly', async () => {
        const {wait, withAsync} = doneAsync();
        const source = createSource({
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        const events: Array<any> = [];
        source.dispatcher = wrapDispatcher({
            send(type, params, cb) {
                events.push(type);
                if (cb) setTimeout(() => cb(), 0);
                return 1;
            }
        });

        source.once('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {
                        this.state = 'loaded';
                        events.push('tileLoaded');
                    },
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {});
                expect(tile.state).toEqual('loading');
                source.loadTile(tile, withAsync((_, doneRef) => {
                    expect(events).toStrictEqual(['loadTile', 'tileLoaded', 'enforceCacheSizeLimit', 'reloadTile', 'tileLoaded']);
                    doneRef.resolve();
                }));
            }
        });

        await wait;
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

    test('respects collectResourceTiming parameter on source', async () => {
        const source = createSource({
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            collectResourceTiming: true
        });
        source.dispatcher = wrapDispatcher({
            send(type, params, cb) {
                expect(params.request.collectResourceTiming).toBeTruthy();
                setTimeout(() => cb(), 0);

                // do nothing for cache size check dispatch
                source.dispatcher = mockDispatcher;

                return 1;
            }
        });

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            const tile = {
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                state: 'loading',
                loadVectorData () {},
                setExpiryData() {}
            };
            source.loadTile(tile, () => {});
        }
    });

    test('cancels TileJSON request if removed', () => {
        const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
        const source = createSource({url: "/source.json"});
        source.onRemove();
        expect(abortSpy).toHaveBeenCalledTimes(1);
    });

    test('supports property updates', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture))
        });
        const source = createSource({url: '/source.json'});

        const loadSpy = vi.spyOn(source, 'load');
        const clearSourceSpy = vi.spyOn(source.map.style, 'clearSource');
        const responseSpy = vi.fn();

        await waitFor(source, 'data');

        mockFetch({
            '/source.json': (request) => {
                responseSpy(request);
                return new Response(JSON.stringify({...sourceFixture, maxzoom: 22}));
            }
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
            expect(source.serialize()).toEqual({type: 'vector', url: '/new-source.json'});
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
                type: 'vector',
                minzoom: 1,
                maxzoom: 10,
                attribution: 'Mapbox',
                tiles: ['http://example.com/v2/{z}/{x}/{y}.png']
            });
        }
    });

    test('prefers TileJSON tiles, if both URL and tiles options are set', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture))
        });

        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: 'Mapbox',
            tiles: ['http://example.com/old/{z}/{x}/{y}.png']
        });

        source.setUrl('/source.json');

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.tiles).toEqual(['http://example.com/{z}/{x}/{y}.png']);

            expect(source.serialize()).toEqual({
                type: 'vector',
                url: '/source.json',
                minzoom: 1,
                maxzoom: 10,
                attribution: 'Mapbox'
            });
        }
    });
});
