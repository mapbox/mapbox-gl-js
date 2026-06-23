// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {vi} from 'vitest';
import {describe, test, expect, waitFor, doneAsync, afterEach} from '../../util/vitest';
import {mockFetch} from '../../util/network';
import VectorTileSource from '../../../src/source/vector_tile_source';
import {OverscaledTileID, CanonicalTileID} from '../../../src/source/tile_id';
import {RenderSourceType} from '../../../src/source/render_source_type';
import {HD} from '../../../modules/hd_main';
import {ElevationFeature} from '../../../3d-style/elevation/elevation_feature';
import {ElevationCoverageSnapshot} from '../../../3d-style/source/elevation_coverage_snapshot';
import EXTENT from '../../../src/style-spec/data/extent';
import {Evented} from '../../../src/util/evented';
import {RequestManager} from '../../../src/util/mapbox';
import sourceFixture from '../../fixtures/source.json';
import config from '../../../src/util/config';
import Actor from '../../../src/util/actor';

const wrapDispatcher = (dispatcher) => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
    if (dispatcher.send && !dispatcher.sendCancelable) {
        const send = dispatcher.send.bind(dispatcher);
        dispatcher.send = (type, data, options) => Promise.resolve(send(type, data, options));
        dispatcher.sendCancelable = Actor.prototype.sendCancelable;
    }
    if (dispatcher.send && !dispatcher.notify) {
        dispatcher.notify = () => {};
    }
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
    return {
        getActor() {
            return dispatcher;
        },
        ready: true
    };
};

const mockDispatcher = wrapDispatcher({
    send() { return new Promise(() => {}); }
});

function createSource(options, {transformCallback, customAccessToken} = {}) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const source = new VectorTileSource('id', options, mockDispatcher, options.eventedParent);

    source.onAdd({
        getWorldview() { },
        getScaleFactor() { return 1; },
        getIndoorTileOptions: () => null,
        transform: {showCollisionBoxes: false},
        _getMapId: () => 1,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        _requestManager: new RequestManager(transformCallback, customAccessToken),
        style: {
            clearSource: () => {},
            getLut: () => { return null; },
            getBrightness: () => { return 0.0; },
            getIndoorVectorTileOptions: () => { return null; },
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (e.sourceDataType === 'metadata') {
                if (!dataloadingFired) expect.unreachable();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
            const {wait, doneRef} = doneAsync();
            const source = createSource({
                minzoom: 1,
                maxzoom: 10,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"],
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                scheme
            });

            source.dispatcher = wrapDispatcher({
                send(type, params) {
                    expect(type).toEqual('loadTile');
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    expect(expectedURL).toEqual(params.request.url);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    doneRef.resolve();
                    return new Promise(() => {});
                }
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                '/source.json': () => new Response(JSON.stringify({...sourceFixture, scheme}))
            });

            const source = createSource({url: "/source.json"});

            source.dispatcher = wrapDispatcher({
                send(type, params) {
                    expect(type).toEqual('loadTile');
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    expect(expectedURL).toEqual(params.request.url);
                    return new Promise(() => {});
                }
            });

            source.on('data', withAsync((e, doneRef) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (e.sourceDataType === 'metadata') {
                    expect(source.scheme).toEqual(scheme);
                    source.loadTile({
                        tileID: new OverscaledTileID(10, 0, 10, 5, 5)
                    }, () => {});
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    doneRef.resolve();
                }
            }));
            await wait;
        });
    }

    testRemoteScheme('xyz', 'http://example.com/10/5/5.png');
    testRemoteScheme('tms', 'http://example.com/10/5/1018.png');

    // Captures the `frcCoverage` block of params sent to the worker for a given painter state.
    // Builds a real VectorTileSource and intercepts dispatcher.send before metadata loads,
    // then drives a loadTile() and resolves with the captured params.
    function captureFrcCoverageParams({painter, mapZoom, tileID}) {
        return new Promise((resolve) => {
            const source = createSource({
                minzoom: 0,
                maxzoom: 22,
                tiles: ["http://example.com/{z}/{x}/{y}.png"]
            });

            // Augment the map stub with painter + transform.zoom so the inline IIFE
            // in loadTile can read them. Existing helper only stubs the bare minimum.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            source.map.painter = painter;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            source.map.transform = {...source.map.transform, zoom: mapZoom};

            source.dispatcher = wrapDispatcher({
                send(type, params) {
                    if (type === 'loadTile') {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        resolve(params.frcCoverage);
                    }
                }
            });

            source.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    source.loadTile({
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        tileID,
                        uid: 0,
                        renderSourceType: 0,
                    }, () => {});
                }
            });
        });
    }

    describe('frcCoverage params', () => {
        test('painter.frcCoverageFadeRange=null → frcCoverage=null (feature disabled)', async () => {
            const frc = await captureFrcCoverageParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    frcCoverageFadeRange: null,
                    frcCoverageSnapshot: null,
                    frcCoverageSourceLayers: [],
                },
                mapZoom: 15,
                tileID: new OverscaledTileID(15, 0, 15, 1, 1),
            });
            expect(frc).toBeNull();
        });

        test('mapZoom < fadeRange[0] → resolved=true (below coverage, no defer)', async () => {
            const frc = await captureFrcCoverageParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    frcCoverageFadeRange: [14, 15],
                    frcCoverageSnapshot: null,
                    frcCoverageSourceLayers: ['road'],
                },
                mapZoom: 12, // below 14
                tileID: new OverscaledTileID(12, 0, 12, 1, 1),
            });
            expect(frc).not.toBeNull();
            expect(frc.resolved).toBe(true);
            expect(frc.frcMask).toBeNull();
        });

        test('mapZoom >= fadeRange[0], snapshot=null → resolved=false (coverage still loading)', async () => {
            const frc = await captureFrcCoverageParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    frcCoverageFadeRange: [14, 15],
                    frcCoverageSnapshot: null,
                    frcCoverageSourceLayers: ['road'],
                },
                mapZoom: 14.5,
                tileID: new OverscaledTileID(14, 0, 14, 1, 1),
            });
            expect(frc.resolved).toBe(false);
            expect(frc.frcMask).toBeNull();
        });

        test('tileZ < ceil(fadeRange[1]) → frcMask=null even with snapshot', async () => {
            const snapshot = {
                getFullCoverageMask: () => 0b1,
                getTileOrParent: () => null,
            };
            const frc = await captureFrcCoverageParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    frcCoverageFadeRange: [14, 15],
                    frcCoverageSnapshot: snapshot,
                    frcCoverageSourceLayers: ['road'],
                },
                mapZoom: 14.5,
                tileID: new OverscaledTileID(14, 0, 14, 1, 1),
            });
            expect(frc.frcMask).toBeNull();
            // snapshot present means resolved=true
            expect(frc.resolved).toBe(true);
        });

        test('tileZ >= ceil(fadeRange[1]), full coverage → frcMask from getFullCoverageMask()', async () => {
            const snapshot = {
                getFullCoverageMask: () => 0b101,
                getTileOrParent: () => ({tileId: {z: 14, x: 0, y: 0}, polygons: [], frcMask: 0b101}),
            };
            const frc = await captureFrcCoverageParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    frcCoverageFadeRange: [14, 15],
                    frcCoverageSnapshot: snapshot,
                    frcCoverageSourceLayers: ['road'],
                },
                mapZoom: 15,
                tileID: new OverscaledTileID(15, 0, 15, 1, 1),
            });
            expect(frc.frcMask).toBe(0b101);
        });

        test('tileZ >= ceil(fadeRange[1]), partial coverage → frcMask=null, polygons present', async () => {
            const partialPolys = [{frcMask: 0b1, rings: []}];
            const snapshot = {
                getFullCoverageMask: () => null,
                getTileOrParent: () => ({tileId: {z: 14, x: 0, y: 0}, polygons: partialPolys, frcMask: 0b1}),
            };
            const frc = await captureFrcCoverageParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    frcCoverageFadeRange: [14, 15],
                    frcCoverageSnapshot: snapshot,
                    frcCoverageSourceLayers: ['road'],
                },
                mapZoom: 15,
                tileID: new OverscaledTileID(15, 0, 15, 1, 1),
            });
            expect(frc.frcMask).toBeNull();
            expect(frc.polygons).toBe(partialPolys);
            expect(frc.tileZoom).toBe(14);
        });

        test('integer endpoint: fadeRange=[14,15], tileZ=15 → frcMask applied (ceil edge)', async () => {
            // Without ceil(), tileZ >= 15 wouldn't be enforced — this verifies the comment in
            // vector_tile_source.ts that integer endpoints use >= via Math.ceil(max).
            const snapshot = {
                getFullCoverageMask: () => 0b1,
                getTileOrParent: () => ({tileId: {z: 14, x: 0, y: 0}, polygons: [], frcMask: 0b1}),
            };
            const frc = await captureFrcCoverageParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    frcCoverageFadeRange: [14, 15],
                    frcCoverageSnapshot: snapshot,
                    frcCoverageSourceLayers: ['road'],
                },
                mapZoom: 15,
                tileID: new OverscaledTileID(15, 0, 15, 1, 1),
            });
            expect(frc.frcMask).toBe(0b1);
        });

        test('non-integer endpoint: fadeRange=[14,14.9], tileZ=15 → frcMask applied (ceil(14.9)=15)', async () => {
            const snapshot = {
                getFullCoverageMask: () => 0b1,
                getTileOrParent: () => ({tileId: {z: 14, x: 0, y: 0}, polygons: [], frcMask: 0b1}),
            };
            const frc = await captureFrcCoverageParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    frcCoverageFadeRange: [14, 14.9],
                    frcCoverageSnapshot: snapshot,
                    frcCoverageSourceLayers: ['road'],
                },
                mapZoom: 15,
                tileID: new OverscaledTileID(15, 0, 15, 1, 1),
            });
            expect(frc.frcMask).toBe(0b1);
        });

        test('sourceLayers comes from painter.frcCoverageSourceLayers', async () => {
            const frc = await captureFrcCoverageParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    frcCoverageFadeRange: [14, 15],
                    frcCoverageSnapshot: null,
                    frcCoverageSourceLayers: ['(sd-traffic)traffic'],
                },
                mapZoom: 14.5,
                tileID: new OverscaledTileID(14, 0, 14, 1, 1),
            });
            expect(frc.sourceLayers).toEqual(['(sd-traffic)traffic']);
        });
    });

    function captureElevationParams({painter, tileID, renderSourceType, crossSourceEnabled}) {
        return new Promise((resolve) => {
            const source = createSource({
                minzoom: 0,
                maxzoom: 22,
                tiles: ["http://example.com/{z}/{x}/{y}.png"]
            });

            if (crossSourceEnabled) {
                source.map.style._crossSourceElevationActive = true;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            source.map.painter = painter;
            source.map.transform = {...source.map.transform, zoom: 14};

            source.dispatcher = wrapDispatcher({
                send(type, params) {
                    if (type === 'loadTile') {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        resolve(params.elevation);
                    }
                }
            });

            source.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    source.loadTile({
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        tileID,
                        uid: 0,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        renderSourceType: renderSourceType != null ? renderSourceType : RenderSourceType.Other,
                    }, () => {});
                }
            });
        });
    }

    describe('elevation params', () => {
        test('painter.elevationCoverageSnapshot=null → elevation=null', async () => {
            const elevation = await captureElevationParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    elevationCoverageSnapshot: null,
                },
                tileID: new OverscaledTileID(14, 0, 14, 8800, 5373),
            });
            expect(elevation).toBeNull();
        });

        test('HdRoadElevation render source → elevation=null', async () => {
            const tileId = new CanonicalTileID(14, 8800, 5373);
            const snapshot = new ElevationCoverageSnapshot([{
                sourceFQID: 'roads',
                tileId,
                features: [new ElevationFeature(1, {min: 0, max: EXTENT}, 5.0)],
            }]);
            const elevation = await captureElevationParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    elevationCoverageSnapshot: snapshot,
                },
                tileID: new OverscaledTileID(14, 0, 14, 8800, 5373),
                renderSourceType: RenderSourceType.HdRoadElevation,
            });
            expect(elevation).toBeNull();
        });

        test('style.terrain set → terrainEnabled=true and elevation=null', async () => {
            // Under terrain, HD road-markup lines drape flat: the worker is
            // told terrain is on and no snapshot is shipped, even when one exists on the painter.
            const tileId = new CanonicalTileID(14, 8800, 5373);
            const snapshot = new ElevationCoverageSnapshot([{
                sourceFQID: 'roads',
                tileId,
                features: [new ElevationFeature(42, {min: 0, max: EXTENT}, 8.0)],
            }]);
            const params = await new Promise((resolve) => {
                const source = createSource({
                    minzoom: 0,
                    maxzoom: 22,
                    tiles: ["http://example.com/{z}/{x}/{y}.png"]
                });
                source.map.painter = {_debugParams: {showElevationIdDebug: false}, elevationCoverageSnapshot: snapshot};
                source.map.style.terrain = {};
                source.map.transform = {...source.map.transform, zoom: 14};
                source.dispatcher = wrapDispatcher({
                    send(type, p) { if (type === 'loadTile') resolve(p); }
                });
                source.on('data', (e) => {
                    if (e.sourceDataType === 'metadata') {
                        source.loadTile({tileID: new OverscaledTileID(14, 0, 14, 8800, 5373), uid: 0, renderSourceType: RenderSourceType.Other}, () => {});
                    }
                });
            });
            expect(params.terrainEnabled).toBe(true);
            expect(params.elevation).toBeNull();
        });

        test('snapshot present → buildElevationRequestParams payload attached', async () => {
            expect(typeof HD.buildElevationRequestParams).toBe('function');
            const tileId = new CanonicalTileID(14, 8800, 5373);
            const feature = new ElevationFeature(42, {min: 0, max: EXTENT}, 8.0);
            const snapshot = new ElevationCoverageSnapshot([{
                sourceFQID: 'roads',
                tileId,
                features: [feature],
            }]);
            const elevation = await captureElevationParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    elevationCoverageSnapshot: snapshot,
                },
                tileID: new OverscaledTileID(14, 0, 14, 8800, 5373),
                crossSourceEnabled: true,
            });
            expect(elevation).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(elevation.registry.length).toBe(1);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(elevation.registry[0].feature.id).toBe(42);
        });

        test('cross-source enabled but no snapshot → empty-registry stub', async () => {
            // Every feature renders flat; once a covering provider tile loads the snapshot
            // changes and this tile reparses.
            const elevation = await captureElevationParams({
                painter: {
                    _debugParams: {showElevationIdDebug: false},
                    elevationCoverageSnapshot: null,
                },
                tileID: new OverscaledTileID(14, 0, 14, 8800, 5373),
                crossSourceEnabled: true,
            });
            expect(elevation).toEqual({registry: [], hasCoveringTile: false, allProvidersReady: false});
        });
    });

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
                loadVectorData() {},
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
                loadVectorData() {},
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
            send(type) {
                events.push(type);
                return Promise.resolve({});
            }
        });

        source.once('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData() {
                        this.state = 'loaded';
                        events.push('tileLoaded');
                    },
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {});
                expect(tile.state).toEqual('loading');
                source.loadTile(tile, withAsync((_, __, doneRef) => {
                    // `enforceCacheSizeLimit` is now fire-and-forget (notify), so the send-spy no longer records it.
                    expect(events).toStrictEqual(['loadTile', 'tileLoaded', 'reloadTile', 'tileLoaded']);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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

    test('respects TileJSON.extra_bounds', async () => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            // eslint-disable-next-line camelcase
            extra_bounds: [
                [-18.716583, 34.608345, 48.080292, 73.128931],  // Europe/Northern Africa region
                [122.871094, 26.431228, 158.730469, 46.800059], // East Asia region
                [-129.550781, 19.642588, -64.335938, 53.540307] // North America region
            ]
        });
        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            // Tile in South America - should be outside all bounds
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 133, 177))).toBeFalsy();

            // Tile in Europe (part of extra_bounds[0])
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 136, 87))).toBeTruthy();

            // Tile in East Asia (part of extra_bounds[1])
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 217, 98))).toBeTruthy();

            // Tile in North America (part of extra_bounds[2])
            expect(source.hasTile(new OverscaledTileID(8, 0, 8, 75, 96))).toBeTruthy();
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

    test('respects collectResourceTiming parameter on source', async () => {
        const source = createSource({
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            collectResourceTiming: true
        });
        source.dispatcher = wrapDispatcher({
            send(type, params) {
                if (type === 'loadTile') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    expect(params.request.collectResourceTiming).toBeTruthy();
                    source.dispatcher = mockDispatcher;
                }
                return new Promise(() => {});
            }
        });

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            const tile = {
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                state: 'loading',
                loadVectorData() {},
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

    test('non-AJAX error propagates through loadTile callback', async () => {
        const source = createSource({
            tiles: ["http://example.com/{z}/{x}/{y}.pbf"]
        });

        source.dispatcher = wrapDispatcher({
            send(type) {
                if (type === 'loadTile') {
                    source.dispatcher = mockDispatcher;
                    return Promise.reject(new Error('parse failed'));
                }
                return new Promise(() => {});
            }
        });

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            const tile = {
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                state: 'loading',
                loadVectorData() {},
                setExpiryData() {}
            };
            await new Promise((resolve) => {
                source.loadTile(tile, (err) => {
                    expect(err).toBeTruthy();
                    expect(err.message).toEqual('parse failed');
                    resolve();
                });
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

    test('aborting a tile while its transform is pending issues no worker message', async () => {
        let resolveTransform;
        const transformCallback = vi.fn(() => new Promise((resolve) => { resolveTransform = resolve; }));

        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        }, {transformCallback});

        let sendCalled = false;
        source.dispatcher = wrapDispatcher({
            send(type) {
                if (type === 'loadTile' || type === 'reloadTile') sendCalled = true;
                return new Promise(() => {});
            }
        });

        source.tiles = ["http://example.com/{z}/{x}/{y}.png"];
        const tile = {tileID: new OverscaledTileID(10, 0, 10, 5, 5), state: 'loading'};
        let callbackErr = 'unset';
        source.loadTile(tile, (err) => { callbackErr = err; });

        expect(transformCallback).toHaveBeenCalledTimes(1);
        expect(tile.request).toBeTruthy();

        // Abort mid-transform, then let the transform resolve.
        tile.aborted = true;
        source.abortTile(tile);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        resolveTransform({url: 'http://example.com/10/5/5.png'});

        await new Promise(resolve => { setTimeout(resolve, 0); });

        expect(sendCalled).toEqual(false);
        expect(callbackErr).toEqual(null);
    });
});

describe('VectorTileSource provider', () => {
    let providerId = 0;
    let currentProvider: string;
    function nextProvider() { currentProvider = `test-provider-${++providerId}`; return currentProvider; }

    afterEach(() => {
        vi.restoreAllMocks();
        delete config.TILE_PROVIDER_URLS[currentProvider];
    });

    function createProviderSource(
        providerName: string,
        options: Record<string, unknown>,
        overrides: {dispatcherOverrides?: object; mapOverrides?: object; sendResult?: unknown[]} = {},
    ) {
        const {dispatcherOverrides, mapOverrides, sendResult} = overrides;
        const sendSpy = vi.fn((_type: string, _data: unknown, _signal?: AbortSignal) => {
            return Promise.resolve(sendResult !== undefined ? sendResult : [null]);
        });
        const dispatcher = {
            getActor() { return {send() { return new Promise(() => {}); }}; },
            ready: true,
            send: sendSpy,
            ...dispatcherOverrides,
        };

        const source = new VectorTileSource(
            'id',
            ({type: 'vector' as const, provider: providerName, ...options}) as unknown as Parameters<typeof VectorTileSource['prototype']['onAdd']>[0] extends never ? never : ConstructorParameters<typeof VectorTileSource>[1],
            dispatcher as unknown as ConstructorParameters<typeof VectorTileSource>[2],
            options.eventedParent as ConstructorParameters<typeof VectorTileSource>[3],
        );

        source.onAdd({
            _language: null,
            getWorldview() {},
            getScaleFactor() { return 1; },
            getIndoorTileOptions: () => null,
            transform: {showCollisionBoxes: false},
            _getMapId: () => 1,
            _requestManager: new RequestManager(),
            style: {
                clearSource: () => {},
                getLut: () => null,
                getBrightness: () => 0.0,
            },
            ...mapOverrides,
        } as unknown as Parameters<typeof source.onAdd>[0]);

        return {source, sendSpy, dispatcher};
    }

    test('fires error when provider is not registered', async () => {
        const name = nextProvider();
        // Don't register — config.TILE_PROVIDER_URLS[name] is undefined

        const source = new VectorTileSource('id', {
            type: 'vector',
            provider: name,
            tiles: ['http://example.com/{z}/{x}/{y}.mvt'],
        }, {
            getActor() { return {send() {}}; },
            ready: true,
            send: vi.fn(),
        }, null);

        // Listen before onAdd since the error fires synchronously
        const errorPromise = waitFor(source, 'error');

        source.onAdd({
            _language: null,
            getWorldview() {},
            getScaleFactor() { return 1; },
            getIndoorTileOptions: () => null,
            transform: {showCollisionBoxes: false},
            _getMapId: () => 1,
            _requestManager: new RequestManager(),
            style: {
                clearSource: () => {},
                getLut: () => null,
                getBrightness: () => 0.0,
            },
        });

        const e = await errorPromise as {error: Error};
        expect(e.error.message).toMatch(new RegExp(`TileProvider "${name}" is not registered`));
    });

    test('sends loadTileProvider to workers', async () => {
        const name = nextProvider();
        const moduleUrl = 'http://example.com/provider.js';
        config.TILE_PROVIDER_URLS[name] = moduleUrl;

        const {source, sendSpy} = createProviderSource(name, {
            tiles: ['http://example.com/{z}/{x}/{y}.mvt'],
        });

        await waitFor(source, 'data');
        expect(sendSpy).toHaveBeenCalledWith(
            'loadTileProvider',
            expect.objectContaining({name, url: moduleUrl, source: 'id', type: 'vector'}),
            expect.anything()
        );
        expect(source.tiles).toEqual(['http://example.com/{z}/{x}/{y}.mvt']);
    });

    test('uses provider TileJSON when workers return it', async () => {
        const name = nextProvider();
        const tileJSON = {
            tiles: ['http://provider.example.com/{z}/{x}/{y}.mvt'],
            minzoom: 2,
            maxzoom: 16,
        };
        config.TILE_PROVIDER_URLS[name] = 'http://example.com/provider.js';

        const {source} = createProviderSource(name, {url: 'pmtiles://my-archive.pmtiles'}, {
            sendResult: [tileJSON],
        });

        await waitFor(source, 'data');
        expect(source.tiles).toEqual(['http://provider.example.com/{z}/{x}/{y}.mvt']);
        expect(source.minzoom).toEqual(2);
        expect(source.maxzoom).toEqual(16);
    });

});

describe('VectorTileSource provider autodetection', () => {
    const savedApiUrl = config.API_URL;

    afterEach(() => {
        vi.restoreAllMocks();
        delete config.TILE_PROVIDER_URLS['pmtiles'];
        config.API_URL = savedApiUrl;
    });

    function createAutodetectSource(
        options: Record<string, unknown>,
        overrides: {sendResult?: unknown[]} = {},
    ) {
        const {sendResult} = overrides;
        const sendSpy = vi.fn((_type: string, _data: unknown, _signal?: AbortSignal) => {
            return Promise.resolve(sendResult !== undefined ? sendResult : [null]);
        });
        const dispatcher = {
            getActor() { return {send() { return new Promise(() => {}); }}; },
            ready: true,
            send: sendSpy,
        };

        const source = new VectorTileSource(
            'id',
            ({type: 'vector' as const, ...options}) as unknown as ConstructorParameters<typeof VectorTileSource>[1],
            dispatcher as unknown as ConstructorParameters<typeof VectorTileSource>[2],
            options.eventedParent as ConstructorParameters<typeof VectorTileSource>[3],
        );

        source.onAdd({
            _language: null,
            getWorldview() {},
            getScaleFactor() { return 1; },
            getIndoorTileOptions: () => null,
            transform: {showCollisionBoxes: false},
            _getMapId: () => 1,
            _requestManager: new RequestManager(),
            style: {
                clearSource: () => {},
                getLut: () => null,
                getBrightness: () => 0.0,
            },
        } as unknown as Parameters<typeof source.onAdd>[0]);

        return {source, sendSpy, dispatcher};
    }

    test('autodetects provider from .pmtiles URL extension', async () => {
        config.TILE_PROVIDER_URLS['pmtiles'] = '/mapbox-gl-js/mock-provider.js';

        const {sendSpy} = createAutodetectSource({
            url: 'https://example.com/tiles.pmtiles',
        });

        await new Promise(resolve => { setTimeout(resolve, 0); });
        expect(sendSpy).toHaveBeenCalledWith(
            'loadTileProvider',
            expect.objectContaining({name: 'pmtiles'}),
            expect.anything()
        );
    });

    test('does not autodetect when provider is false', () => {
        config.TILE_PROVIDER_URLS['pmtiles'] = '/mapbox-gl-js/mock-provider.js';

        const {sendSpy} = createAutodetectSource({
            url: 'https://example.com/tiles.pmtiles',
            provider: false,
        });

        expect(sendSpy).not.toHaveBeenCalled();
    });

    test('does not autodetect when provider is explicitly set', async () => {
        config.TILE_PROVIDER_URLS['pmtiles'] = '/mapbox-gl-js/mock-provider.js';
        config.TILE_PROVIDER_URLS['custom'] = 'https://example.com/custom.js';

        const {sendSpy} = createAutodetectSource({
            url: 'https://example.com/tiles.pmtiles',
            provider: 'custom',
        });

        await new Promise(resolve => { setTimeout(resolve, 0); });
        expect(sendSpy).toHaveBeenCalledWith(
            'loadTileProvider',
            expect.objectContaining({name: 'custom', url: 'https://example.com/custom.js'}),
            expect.anything()
        );
        delete config.TILE_PROVIDER_URLS['custom'];
    });

    test('does not autodetect when URL has no matching extension', () => {
        const {sendSpy} = createAutodetectSource({
            url: 'https://example.com/tilejson.json',
        });

        expect(sendSpy).not.toHaveBeenCalled();
    });

    test('resolves relative provider URL against API_URL', async () => {
        config.TILE_PROVIDER_URLS['pmtiles'] = '/mapbox-gl-js/mock-provider.js';
        config.API_URL = 'https://api.mapbox.cn';

        const {sendSpy} = createAutodetectSource({
            url: 'https://example.com/tiles.pmtiles',
        });

        await new Promise(resolve => { setTimeout(resolve, 0); });
        expect(sendSpy).toHaveBeenCalledWith(
            'loadTileProvider',
            expect.objectContaining({url: 'https://api.mapbox.cn/mapbox-gl-js/mock-provider.js'}),
            expect.anything()
        );
    });

});
