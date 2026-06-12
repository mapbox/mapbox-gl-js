// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi} from '../../util/vitest';
import WorkerTile from '../../../src/source/worker_tile';
import Wrapper from '../../../src/source/geojson_wrapper';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {RenderSourceType} from '../../../src/source/render_source_type';
import StyleLayerIndex from '../../../src/style/style_layer_index';
import {getProjection} from '../../../src/geo/projection/index';
import Point from '@mapbox/point-geometry';

function createWorkerTile(params = {}) {
    return new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        tileID: new OverscaledTileID(1, 0, 1, 1, 1),
        overscaling: 1,
        projection: getProjection({name: 'mercator'}),
        brightness: 0,
        ...params
    });
}

function createWrapper() {
    return new Wrapper({_geojsonTileLayer: [{
        type: 1,
        geometry: [0, 0],
        tags: {}
    }]});
}

function createActor() {
    return {
        send: vi.fn((_, __, callback) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            callback(null, {});
        })
    };
}

test('WorkerTile#parse', () => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        type: 'circle'
    }]);

    const tile = createWorkerTile();
    const actor = createActor();
    tile.parse(createWrapper(), layerIndex, [], [], actor, (err, result) => {
        expect(err).toBeFalsy();
        expect(result.buckets[0]).toBeTruthy();
    });
});

test('WorkerTile#parse skips hidden layers', () => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test-hidden',
        source: 'source',
        type: 'fill',
        layout: {visibility: 'none'}
    }]);

    const tile = createWorkerTile();
    const actor = createActor();
    tile.parse(createWrapper(), layerIndex, [], [], actor, (err, result) => {
        expect(err).toBeFalsy();
        expect(result.buckets.length).toEqual(0);
    });
});

test('WorkerTile#parse skips layers without a corresponding source layer', () => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'nonesuch',
        type: 'fill'
    }]);

    const tile = createWorkerTile();
    const actor = createActor();
    tile.parse({layers: {}}, layerIndex, [], [], actor, (err, result) => {
        expect(err).toBeFalsy();
        expect(result.buckets.length).toEqual(0);
    });
});

test('WorkerTile#parse warns once when encountering a v1 vector tile layer', () => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'test',
        type: 'fill'
    }]);

    const data = {
        layers: {
            test: {
                version: 1
            }
        }
    };

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tile = createWorkerTile();
    const actor = createActor();
    tile.parse(data, layerIndex, [], [], actor, (err) => {
        expect(err).toBeFalsy();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(console.warn.mock.calls[0][0]).toMatch(/does not use vector tile spec v2/);
    });
});

test('WorkerTile#parse adds $localized property and filters features based on the worldview', async () => {
    const vt = new Wrapper({_geojsonTileLayer: [
        {type: 1, geometry: [0, 0], tags: {worldview: 'all'}},
        {type: 1, geometry: [0, 0], tags: {worldview: 'CN'}},
        {type: 1, geometry: [0, 0], tags: {worldview: 'US,CN'}},
        {type: 1, geometry: [0, 0], tags: {worldview: 'JP,TR'}},
        {type: 1, geometry: [0, 0], tags: {worldview: 'US'}},
    ]});

    const bucketPopulateSpy = vi.fn();
    const layerIndex = new StyleLayerIndex([{id: '', source: 'source', type: 'symbol'}]);
    vi.spyOn(layerIndex.familiesBySource['source']['_geojsonTileLayer'][0][0], 'createBucket')
        .mockImplementation(() => ({
            populate: bucketPopulateSpy,
            isEmpty: () => false
        }));

    const actor = createActor();
    // no worldview
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => createWorkerTile({worldview: null}).parse(vt, layerIndex, [], [], actor, resolve));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const allFeatures = bucketPopulateSpy.mock.lastCall[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allFeatures.length).toEqual(5);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allFeatures[0].feature.properties).toMatchObject({worldview: 'all'});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allFeatures[1].feature.properties).toMatchObject({worldview: 'CN'});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allFeatures[2].feature.properties).toMatchObject({worldview: 'US,CN'});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allFeatures[3].feature.properties).toMatchObject({worldview: 'JP,TR'});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allFeatures[4].feature.properties).toMatchObject({worldview: 'US'});

    // worldview: 'US'
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => createWorkerTile({worldview: 'US', localizableLayerIds: new Set(['_geojsonTileLayer'])}).parse(vt, layerIndex, [], [], actor, resolve));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const usFeatures = bucketPopulateSpy.mock.lastCall[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(usFeatures.length).toEqual(3);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(usFeatures[0].feature.properties).toMatchObject({worldview: 'all', '$localized': true});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(usFeatures[1].feature.properties).toMatchObject({worldview: 'US', '$localized': true});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(usFeatures[2].feature.properties).toMatchObject({worldview: 'US', '$localized': true});
});

describe('WorkerTile frcCoverage / modularization gate', () => {
    // Build a minimal frcCoverage params object. resolved=false + frcMask=null is the
    // "coverage tile not yet loaded" state that triggers road/structure deferral.
    function frcParams(overrides = {}) {
        return {
            frcMask: null,
            resolved: false,
            sourceLayers: ['road'],
            polygons: null,
            tileZoom: null,
            ...overrides,
        };
    }

    // Most modularization-gate tests only care about the defer flag, not bucket data.
    // Use a fill StyleLayerIndex matching source/source-layer 'road'.
    function makeRoadLayerIndex() {
        return new StyleLayerIndex([{
            id: 'road',
            type: 'fill',
            source: 'source',
            'source-layer': 'road',
        }]);
    }

    test('constructor copies frcCoverage from params', () => {
        const params = frcParams({sourceLayers: ['road', 'structure']});
        const tile = createWorkerTile({frcCoverage: params});
        expect(tile.frcCoverage).toBe(params);
        expect(tile.deferRoadStructure).toBe(false); // not set until parse runs
    });

    test('constructor defaults frcCoverage to null when omitted', () => {
        expect(createWorkerTile().frcCoverage).toBeNull();
    });

    test('frcCoverage non-null is the modularization signal: needsHD path is reachable', () => {
        // This test documents the gate input: when frcCoverage is set, the parse() gate at
        // worker_tile.ts uses `needsHD = !!this.indoor || !!this.frcCoverage` to force HD load.
        // In test (UMD) env HD is statically loaded so the gate is already satisfied — we
        // verify the input state, not the dynamic-import side effect.
        const tile = createWorkerTile({frcCoverage: frcParams()});
        expect(Boolean(tile.frcCoverage)).toBe(true);
    });

    test('deferRoadStructure=true when resolved=false, frcMask=null, source layer matches', () => {
        const layerIndex = makeRoadLayerIndex();
        const tile = createWorkerTile({frcCoverage: frcParams()});
        return new Promise((resolve) => {
            tile.parse({layers: {}}, layerIndex, [], [], createActor(), (err, result) => {
                expect(err).toBeFalsy();
                expect(tile.deferRoadStructure).toBe(true);
                expect(result.hasDeferredRoadStructure).toBe(true);
                resolve();
            });
        });
    });

    test('deferRoadStructure=false when resolved=true (coverage arrived)', () => {
        const layerIndex = makeRoadLayerIndex();
        const tile = createWorkerTile({frcCoverage: frcParams({resolved: true})});
        return new Promise((resolve) => {
            tile.parse({layers: {}}, layerIndex, [], [], createActor(), (err, result) => {
                expect(err).toBeFalsy();
                expect(tile.deferRoadStructure).toBe(false);
                expect(result.hasDeferredRoadStructure).toBe(false);
                resolve();
            });
        });
    });

    test('deferRoadStructure=false when frcMask is set (full coverage known)', () => {
        const layerIndex = makeRoadLayerIndex();
        const tile = createWorkerTile({frcCoverage: frcParams({frcMask: 0b1})});
        return new Promise((resolve) => {
            tile.parse({layers: {}}, layerIndex, [], [], createActor(), (err) => {
                expect(err).toBeFalsy();
                expect(tile.deferRoadStructure).toBe(false);
                resolve();
            });
        });
    });

    test('deferRoadStructure=false when source layer does NOT match sourceLayers list', () => {
        // StyleLayerIndex has source-layer 'building' but FRC sourceLayers = ['road']
        const layerIndex = new StyleLayerIndex([{
            id: 'building',
            type: 'fill',
            source: 'source',
            'source-layer': 'building',
        }]);
        const tile = createWorkerTile({frcCoverage: frcParams({sourceLayers: ['road']})});
        return new Promise((resolve) => {
            tile.parse({layers: {}}, layerIndex, [], [], createActor(), (err) => {
                expect(err).toBeFalsy();
                expect(tile.deferRoadStructure).toBe(false);
                resolve();
            });
        });
    });

    test('deferRoadStructure=false for HdRoadCoverage tiles even when frcCoverage indicates not-resolved', () => {
        // Coverage tiles themselves must never defer their own road layer.
        const layerIndex = makeRoadLayerIndex();
        const tile = createWorkerTile({
            renderSourceType: RenderSourceType.HdRoadCoverage,
            frcCoverage: frcParams(),
        });
        return new Promise((resolve) => {
            tile.parse({layers: {}}, layerIndex, [], [], createActor(), (err) => {
                expect(err).toBeFalsy();
                expect(tile.deferRoadStructure).toBe(false);
                resolve();
            });
        });
    });

    test('HdRoadCoverage tile parses hd_road_coverage layer into frcCoveragePolygons', () => {
        const layerIndex = makeRoadLayerIndex();
        // Build a stand-in for the hd_road_coverage VectorTileLayer that the parser consumes.
        const partialRing = [
            new Point(100, 100),
            new Point(1000, 100),
            new Point(1000, 1000),
            new Point(100, 1000),
            new Point(100, 100),
        ];
        const coverageLayer = {
            length: 1,
            feature(_) {
                return {
                    // eslint-disable-next-line camelcase
                    properties: {frc_mask: 0b101},
                    loadGeometry() { return [partialRing]; },
                };
            },
        };
        const tile = createWorkerTile({
            renderSourceType: RenderSourceType.HdRoadCoverage,
        });
        return new Promise((resolve) => {
            // eslint-disable-next-line camelcase
            tile.parse({layers: {hd_road_coverage: coverageLayer}}, layerIndex, [], [], createActor(), (err, result) => {
                expect(err).toBeFalsy();
                expect(Array.isArray(result.frcCoveragePolygons)).toBe(true);
                expect(result.frcCoveragePolygons.length).toBe(1);
                expect(result.frcCoveragePolygons[0].frcMask).toBe(0b101);
                resolve();
            });
        });
    });

    test('non-coverage tile does not parse frcCoveragePolygons (undefined in result)', () => {
        const layerIndex = makeRoadLayerIndex();
        const tile = createWorkerTile(); // default renderSourceType is undefined
        return new Promise((resolve) => {
            tile.parse({layers: {}}, layerIndex, [], [], createActor(), (err, result) => {
                expect(err).toBeFalsy();
                expect(result.frcCoveragePolygons).toBeUndefined();
                resolve();
            });
        });
    });
});
