// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {vi} from 'vitest';
import {describe, test, expect} from '../../util/vitest';
import {CanonicalTileID} from '../../../src/source/tile_id';
import EXTENT from '../../../src/style-spec/data/extent';
import {ElevationFeature} from '../../../3d-style/elevation/elevation_feature';
import {serialize, deserialize} from '../../../src/util/web_worker_transfer';
import {getElevationFeature} from '../../../3d-style/elevation/get_elevation_feature';
import {PROPERTY_ELEVATION_ID} from '../../../3d-style/elevation/elevation_constants';
import {
    ElevationCoverageSnapshot,
    buildElevationParamsForTile,
} from '../../../3d-style/source/elevation_coverage_snapshot';
import {ElevationCoverageManager} from '../../../3d-style/source/elevation_coverage_manager';
import {HdElevationState, layerHasMvtRoadElevation, setupAndUpdateElevationCoverage, updateElevationCoverage, reparseElevationConsumerTiles, needsCrossSourceElevation, crossSourceElevationEnabledForStyle, collectElevationProviderSourceFQIDs, collectElevationIngestSourceFQIDs, markElevationIngestSourceCachesUsed} from '../../../3d-style/style/elevation_coverage_style';
import {LineHDExtension} from '../../../3d-style/data/bucket/line_hd_extension';
import Point from '@mapbox/point-geometry';
import {makeFQID} from '../../../src/util/fqid';

function mkConstantFeature(id: number, height: number): ElevationFeature {
    return new ElevationFeature(id, {min: 0, max: EXTENT}, height);
}

let _mkGeneration = 0;
function mkCoverageTile(sourceFQID: string, tileId: CanonicalTileID, features: ElevationFeature[], generation = ++_mkGeneration) {
    return {sourceFQID, tileId, features, generation};
}

// Line layer with hd-road-markup elevation on the 'consumer' source.
function mkConsumerLayers() {
    return {
        'consumer-traffic': {
            type: 'line',
            source: 'consumer',
            scope: '',
            layout: {get: (k: string) => (k === 'line-elevation-reference' ? 'hd-road-markup' : undefined)},
        },
    };
}

function mkCrossSourceLayers() {
    return {
        ...mkConsumerLayers(),
        // Provider layer — readiness tests need a registered provider source.
        'provider-road-base': {
            type: 'line',
            source: 'provider',
            scope: '',
            sourceLayer: 'hd_road_centerlines',
            layout: {get: () => undefined},
        },
    };
}

function mkElevationConsumerLayer(type: 'line' | 'circle' | 'symbol' | 'fill', reference: string, source = 'consumer', scope = '') {
    const prop = `${type}-elevation-reference`;
    return {
        type,
        source,
        scope,
        layout: {get: (k: string) => (k === prop ? reference : undefined)},
    };
}

function mkCrossSourceState(ingestFQIDs: string[] = ['provider']) {
    const state = new HdElevationState();
    state._needsCrossSourceElevation = true;
    state._ingestFQIDs = new Set(ingestFQIDs);
    return state;
}

function mkSameSourceLayers() {
    return {
        'hd-road-markup': {
            type: 'line',
            source: 'hd-roads',
            scope: '',
            sourceLayer: 'hd_road_centerlines',
            layout: {get: (k: string) => (k === 'line-elevation-reference' ? 'hd-road-markup' : undefined)},
        },
    };
}

function mkBerlinLayers() {
    const scope = 'hd-roads-config';
    return {
        'hd-traffic': {
            type: 'line',
            source: 'hd-traffic',
            scope,
            sourceLayer: 'traffic',
            layout: {get: (k: string) => (k === 'line-elevation-reference' ? 'hd-road-markup' : undefined)},
        },
        'hd-coverage-helper': {
            type: 'fill',
            source: 'hd-roads',
            scope,
            sourceLayer: 'hd_road_coverage',
            layout: {get: () => undefined},
        },
    };
}

function mkFalsePositiveLayers() {
    return {
        ...mkSameSourceLayers(),
        'streets-road': {
            type: 'line',
            source: 'streets',
            scope: '',
            sourceLayer: 'road',
            layout: {get: () => undefined},
        },
    };
}

function mkLineHdBucket() {
    return {
        terrainEnabled: false,
        layoutVertexArray: {length: 0, int16: []},
        addLine: vi.fn(),
        fillNonElevatedRoadSegment: vi.fn(),
        showElevationIdDebug: false,
        zOffsetVertexArray: {float32: [], length: 0},
        elevationIdColVertexArray: {float32: []},
    };
}

describe('ElevationCoverageSnapshot.equals', () => {
    const tileId = new CanonicalTileID(14, 8800, 5373);
    const featuresA = [mkConstantFeature(1, 10.0)];
    const featuresB = [mkConstantFeature(1, 12.0)];

    test('identical tile id set → equal', () => {
        const tile = mkCoverageTile('roads', tileId, featuresA);
        const snapshot = new ElevationCoverageSnapshot([tile]);
        expect(snapshot.equals([{...tile}])).toBe(true);
    });

    test('same tile id, different generation → not equal (any reparse advances the generation)', () => {
        const tileA = mkCoverageTile('roads', tileId, featuresA, 1);
        const tileB = mkCoverageTile('roads', tileId, featuresB, 2);
        const snapshot = new ElevationCoverageSnapshot([tileA]);
        expect(snapshot.equals([tileB])).toBe(false);
    });

    test('same tile id and generation → equal (no reparse, regardless of feature content)', () => {
        const tileA = mkCoverageTile('roads', tileId, featuresA, 1);
        const tileB = mkCoverageTile('roads', tileId, featuresB, 1);
        const snapshot = new ElevationCoverageSnapshot([tileA]);
        expect(snapshot.equals([tileB])).toBe(true);
    });

    test('different tile id set → not equal', () => {
        const tileA = mkCoverageTile('roads', tileId, featuresA);
        const tileB = mkCoverageTile('roads', new CanonicalTileID(14, 8800, 5374), featuresA);
        const snapshot = new ElevationCoverageSnapshot([tileA]);
        expect(snapshot.equals([tileB])).toBe(false);
    });
});

describe('ElevationCoverageManager', () => {
    test('tile id set change sets snapshotChanged flag', () => {
        const manager = new ElevationCoverageManager();
        const tileId = new CanonicalTileID(14, 1, 1);
        manager.addTileElevation('roads', tileId, [mkConstantFeature(1, 1.0)], 1);
        manager.updateSnapshotIfNeeded();
        expect(manager.consumeSnapshotChanged()).toBe(true);

        manager.clear();
        // Same generation — no change.
        manager.addTileElevation('roads', tileId, [mkConstantFeature(1, 1.0)], 1);
        manager.updateSnapshotIfNeeded();
        expect(manager.consumeSnapshotChanged()).toBe(false);
    });
});

describe('buildElevationParamsForTile', () => {
    test('no covering tile → empty registry', () => {
        const snapshot = new ElevationCoverageSnapshot([]);
        const featureTile = new CanonicalTileID(14, 1, 1);
        expect(buildElevationParamsForTile(snapshot, featureTile, true)).toEqual({
            registry: [],
            hasCoveringTile: false,
            allProvidersReady: true,
        });
    });

    test('covering tile → registry references snapshot features (pre-send)', () => {
        const tileId = new CanonicalTileID(14, 1, 1);
        const elevation = mkConstantFeature(42, 5.0);
        const snapshot = new ElevationCoverageSnapshot([mkCoverageTile('roads', tileId, [elevation])]);
        const params = buildElevationParamsForTile(snapshot, tileId, true);
        expect(params.registry.length).toBe(1);
        expect(params.hasCoveringTile).toBe(true);
        expect(params.allProvidersReady).toBe(true);
        expect(params.registry[0].feature.id).toBe(42);
        expect(params.registry[0].feature).toBe(elevation);
    });

    test('ElevationParams round-trip via worker serialize produces independent features', () => {
        const tileId = new CanonicalTileID(14, 1, 1);
        const elevation = mkConstantFeature(42, 5.0);
        const snapshot = new ElevationCoverageSnapshot([mkCoverageTile('roads', tileId, [elevation])]);
        const params = buildElevationParamsForTile(snapshot, tileId, false);
        const roundTripped = deserialize(serialize(params));

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(roundTripped.registry[0].feature).not.toBe(params.registry[0].feature);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(roundTripped.registry[0].feature.constantHeight).toBe(5.0);
        expect(elevation.constantHeight).toBe(5.0);
    });

});

describe('getElevationFeature cross-source lookup', () => {
    test('registry resolves id when same-tile lookup misses', () => {
        const featureTile = new CanonicalTileID(14, 10, 20);
        const elevationTile = new CanonicalTileID(14, 11, 21);
        const elevation = mkConstantFeature(7, 3.0);
        const bucketFeature = {
            properties: {[PROPERTY_ELEVATION_ID]: 7},
        };
        const registry = [{tileId: elevationTile, feature: elevation}];
        const hit = getElevationFeature(bucketFeature, [], registry, featureTile);
        expect(hit).toMatchObject({tileId: elevationTile, feature: {id: 7}});
    });

    test('same-tile lookup wins over registry', () => {
        const featureTile = new CanonicalTileID(14, 10, 20);
        const sameTile = mkConstantFeature(7, 1.0);
        const otherTile = mkConstantFeature(7, 9.0);
        const bucketFeature = {
            properties: {[PROPERTY_ELEVATION_ID]: 7},
        };
        const registry = [{tileId: new CanonicalTileID(14, 99, 99), feature: otherTile}];
        const hit = getElevationFeature(bucketFeature, [sameTile], registry, featureTile);
        expect(hit).toMatchObject({tileId: featureTile, feature: {id: 7}});
        expect(hit.feature.constantHeight).toBe(1.0);
    });
});

describe('crossSourceElevationEnabledForStyle', () => {
    test('reads the cached gate without walking layers', () => {
        const style = {_mergedLayers: mkSameSourceLayers(), _crossSourceElevationActive: true};
        expect(crossSourceElevationEnabledForStyle(style)).toBe(true);
    });

    test('returns false when the cached gate is false, regardless of layers', () => {
        // Cached flag is authoritative — not re-derived from layers.
        const style = {_mergedLayers: mkBerlinLayers(), _crossSourceElevationActive: false};
        expect(crossSourceElevationEnabledForStyle(style)).toBe(false);
    });

    test('defaults to false when the gate was never computed', () => {
        const style = {_mergedLayers: mkBerlinLayers()};
        expect(crossSourceElevationEnabledForStyle(style)).toBe(false);
    });
});

describe('needsCrossSourceElevation', () => {
    test('same-source 3d-intersections shape → false', () => {
        const style = {_mergedLayers: mkSameSourceLayers()};
        expect(needsCrossSourceElevation(style)).toBe(false);
        expect(collectElevationProviderSourceFQIDs(style).size).toBe(0);
    });

    test('Berlin import shape → true', () => {
        const style = {_mergedLayers: mkBerlinLayers()};
        expect(needsCrossSourceElevation(style)).toBe(true);
        expect(collectElevationProviderSourceFQIDs(style)).toEqual(new Set([makeFQID('hd-roads', 'hd-roads-config')]));
        expect(collectElevationIngestSourceFQIDs(style)).toEqual(new Set([makeFQID('hd-roads', 'hd-roads-config')]));
    });

    test('hd-roads consumer + unrelated streets vector source → false', () => {
        const style = {_mergedLayers: mkFalsePositiveLayers()};
        expect(needsCrossSourceElevation(style)).toBe(false);
    });
});
describe('layerHasMvtRoadElevation', () => {
    test('returns true for each layer type with hd-road-markup', () => {
        expect(layerHasMvtRoadElevation(mkElevationConsumerLayer('line', 'hd-road-markup'))).toBe(true);
        expect(layerHasMvtRoadElevation(mkElevationConsumerLayer('circle', 'hd-road-markup'))).toBe(true);
        expect(layerHasMvtRoadElevation(mkElevationConsumerLayer('symbol', 'hd-road-markup'))).toBe(true);
        expect(layerHasMvtRoadElevation(mkElevationConsumerLayer('fill', 'hd-road-markup'))).toBe(true);
    });

    test('returns false when layout is missing', () => {
        expect(layerHasMvtRoadElevation({type: 'line', layout: null})).toBe(false);
    });

    test('returns false for non-markup elevation references', () => {
        expect(layerHasMvtRoadElevation(mkElevationConsumerLayer('line', 'ground'))).toBe(false);
        expect(layerHasMvtRoadElevation(mkElevationConsumerLayer('circle', 'none'))).toBe(false);
        expect(layerHasMvtRoadElevation(mkElevationConsumerLayer('symbol', 'ground'))).toBe(false);
        expect(layerHasMvtRoadElevation(mkElevationConsumerLayer('fill', 'hd-road-base'))).toBe(false);
    });
});

describe('setupAndUpdateElevationCoverage', () => {
    test('early exit when _mergedLayers has no elevation consumers', () => {
        const mergeSources = vi.fn();
        const forEachFragmentStyle = vi.fn();
        const style = {
            _mergedLayers: {},
            mergeSources,
            forEachFragmentStyle,
        };

        setupAndUpdateElevationCoverage(style);

        expect(mergeSources).not.toHaveBeenCalled();
        expect(forEachFragmentStyle).not.toHaveBeenCalled();
        expect(style._hdElevation).toBeUndefined();
    });

    test('uses root _mergedLayers for consumer detection, not fragment-local _layers', () => {
        const mergeSources = vi.fn();
        const style = {
            _mergedLayers: {},
            _layers: mkConsumerLayers(),
            mergeSources,
            forEachFragmentStyle: vi.fn(),
        };

        setupAndUpdateElevationCoverage(style);

        expect(mergeSources).not.toHaveBeenCalled();
    });

    test('same-source early exit clears snapshot machinery', () => {
        const mergeSources = vi.fn();
        const painter = {elevationCoverageSnapshot: {stale: true}};
        const style = {
            _mergedLayers: mkSameSourceLayers(),
            mergeSources,
            forEachFragmentStyle: vi.fn(),
            map: {painter},
        };

        setupAndUpdateElevationCoverage(style);

        expect(mergeSources).not.toHaveBeenCalled();
        expect(style._hdElevation).toBeUndefined();
        expect(painter.elevationCoverageSnapshot).toBe(null);
    });

    test('cross-source → same-source clears stale HdElevationState gate', () => {
        const providerCache = {used: false, _tiles: {}, _sourceLoaded: true};
        const state = mkCrossSourceState(['provider']);
        const painter = {elevationCoverageSnapshot: {stale: true}};
        const style = {
            _mergedLayers: mkSameSourceLayers(),
            _hdElevation: state,
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {provider: providerCache},
            _mergedSymbolSourceCaches: {},
            mergeSources: vi.fn(),
            forEachFragmentStyle: vi.fn(),
            map: {painter},
        };

        setupAndUpdateElevationCoverage(style);

        expect(state._needsCrossSourceElevation).toBe(false);
        expect(state._ingestFQIDs.size).toBe(0);
        expect(painter.elevationCoverageSnapshot).toBe(null);

        markElevationIngestSourceCachesUsed(style);
        expect(providerCache.used).toBe(false);
    });

    test('deactivateCrossSourceElevation is a no-op when state is already clean', () => {
        const state = new HdElevationState();
        const clearSpy = vi.spyOn(state.manager, 'clear');
        const style = {
            _mergedLayers: mkSameSourceLayers(),
            _hdElevation: state,
            map: {painter: {elevationCoverageSnapshot: null}},
        };
        setupAndUpdateElevationCoverage(style);
        clearSpy.mockClear();
        setupAndUpdateElevationCoverage(style);
        expect(clearSpy).not.toHaveBeenCalled();
    });

    test('cross-source ingests from consumer cache without dedicated elevation cache', () => {
        const scope = 'hd-roads-config';
        const providerFqid = makeFQID('hd-roads', scope);
        const vectorSource = {type: 'vector', id: 'hd-roads', on: vi.fn(), off: vi.fn()};
        const mergeSources = vi.fn();
        const painter = {elevationCoverageSnapshot: 'stale'};
        const fragmentStyle = {
            scope,
            _otherSourceCaches: {'hd-roads': {}},
            _sourceCaches: {},
            _hdElevation: undefined,
            map: {style: {}},
            getOwnSource: (id: string) => (id === 'hd-roads' ? vectorSource : null),
        };
        const style = {
            _mergedLayers: mkBerlinLayers(),
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {},
            _mergedSymbolSourceCaches: {},
            _hdElevation: undefined,
            _sourceCaches: {},
            scope: '',
            map: {painter},
            mergeSources,
            forEachFragmentStyle: (fn: (s: typeof fragmentStyle) => void) => fn(fragmentStyle),
        };

        setupAndUpdateElevationCoverage(style);

        expect(style._hdElevation).toBeInstanceOf(HdElevationState);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(style._hdElevation._needsCrossSourceElevation).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        expect(style._hdElevation._ingestFQIDs.has(providerFqid)).toBe(true);
        expect(fragmentStyle._sourceCaches['hd-road-elevation:hd-roads']).toBeUndefined();
        expect(mergeSources).toHaveBeenCalled();
        expect(painter.elevationCoverageSnapshot).toBe(null);
    });
});

describe('PureProviderElevationCacheGetsUpdatedTest', () => {
    test('updateElevationCoverage marks ingest source caches used', () => {
        const providerCache = {used: false, _tiles: {}, _sourceLoaded: true};
        const state = mkCrossSourceState(['provider']);
        const style = {
            _hdElevation: state,
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {provider: providerCache},
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkConsumerLayers(),
            map: {painter: {elevationCoverageSnapshot: null}},
        };
        updateElevationCoverage(style, state);
        expect(providerCache.used).toBe(true);
    });
});

describe('updateElevationCoverage reparse (covering tile)', () => {
    test('reloads consumer tile when its covering provider tile appears', () => {
        const canonical = new CanonicalTileID(14, 8800, 5373);
        const providerTile = {
            tileID: {canonical},
            loaded: () => true,
            parsedElevationFeatures: [mkConstantFeature(1, 10.0)],
            parsedElevationGeneration: 1,
        };
        const consumerTile = {
            tileID: {canonical},
            hasDeferredElevationFeatures: false,
        };
        const reloadSpy = vi.fn();
        const style = {
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {
                provider: {_tiles: {'1': providerTile}, used: false, _sourceLoaded: true},
                consumer: {_tiles: {'1': consumerTile}, _reloadTile: reloadSpy},
            },
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkConsumerLayers(),
            map: {painter: {elevationCoverageSnapshot: null}},
        };

        updateElevationCoverage(style, mkCrossSourceState(['provider']));

        expect(reloadSpy).toHaveBeenCalledWith(1, 'reloading');
        expect(consumerTile.hasDeferredElevationFeatures).toBe(false);
    });

    test('reloads deferred consumer tile when snapshot updates', () => {
        const canonical = new CanonicalTileID(14, 8800, 5373);
        const providerTile = {
            tileID: {canonical},
            loaded: () => true,
            parsedElevationFeatures: [mkConstantFeature(1, 10.0)],
            parsedElevationGeneration: 1,
        };
        const consumerTile = {
            tileID: {canonical},
            hasDeferredElevationFeatures: true,
        };
        const reloadSpy = vi.fn();
        const style = {
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {
                provider: {_tiles: {'1': providerTile}, used: false, _sourceLoaded: true},
                consumer: {_tiles: {'1': consumerTile}, _reloadTile: reloadSpy},
            },
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkConsumerLayers(),
            map: {painter: {elevationCoverageSnapshot: null}},
        };

        updateElevationCoverage(style, mkCrossSourceState(['provider']));

        expect(reloadSpy).toHaveBeenCalledWith(1, 'reloading');
        expect(consumerTile.hasDeferredElevationFeatures).toBe(false);
    });

    test('does not reload when the tile id set is unchanged', () => {
        const canonical = new CanonicalTileID(14, 8800, 5373);
        const providerTile = {
            tileID: {canonical},
            loaded: () => true,
            parsedElevationFeatures: [mkConstantFeature(1, 10.0)],
            parsedElevationGeneration: 1,
        };
        const consumerTile = {
            tileID: {canonical},
            hasDeferredElevationFeatures: false,
        };
        const reloadSpy = vi.fn();
        const style = {
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {
                provider: {_tiles: {'1': providerTile}, used: false, _sourceLoaded: true},
                consumer: {_tiles: {'1': consumerTile}, _reloadTile: reloadSpy},
            },
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkConsumerLayers(),
            map: {painter: {elevationCoverageSnapshot: null}},
        };
        const state = mkCrossSourceState(['provider']);

        updateElevationCoverage(style, state);
        reloadSpy.mockClear();

        updateElevationCoverage(style, state);
        expect(reloadSpy).not.toHaveBeenCalled();
    });

    test('reloads consumer when the covering tile content grows from empty to loaded', () => {
        // Provider tile going from empty to loaded must reparse consumers.
        const canonical = new CanonicalTileID(14, 8800, 5373);
        const providerTile = {
            tileID: {canonical},
            loaded: () => true,
            parsedElevationFeatures: [],
            parsedElevationGeneration: 1,
        };
        const consumerTile = {
            tileID: {canonical},
            hasDeferredElevationFeatures: false,
        };
        const reloadSpy = vi.fn();
        const style = {
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {
                provider: {_tiles: {'1': providerTile}, used: false, _sourceLoaded: true},
                consumer: {_tiles: {'1': consumerTile}, _reloadTile: reloadSpy},
            },
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkConsumerLayers(),
            map: {painter: {elevationCoverageSnapshot: null}},
        };
        const state = mkCrossSourceState(['provider']);

        updateElevationCoverage(style, state);
        reloadSpy.mockClear();

        providerTile.parsedElevationFeatures = [mkConstantFeature(1, 10.0)];
        providerTile.parsedElevationGeneration = 2;
        updateElevationCoverage(style, state);
        expect(reloadSpy).toHaveBeenCalledWith(1, 'reloading');
    });

    test('does not reload non-consumer sources under the coverage area', () => {
        // Non-consumer sources (e.g. terrain) must not be reparsed.
        const canonical = new CanonicalTileID(14, 8800, 5373);
        const providerTile = {
            tileID: {canonical},
            loaded: () => true,
            parsedElevationFeatures: [mkConstantFeature(1, 10.0)],
            parsedElevationGeneration: 1,
        };
        const nonConsumerTile = {
            tileID: {canonical},
            hasDeferredElevationFeatures: false,
        };
        const reloadSpy = vi.fn();
        const style = {
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {
                provider: {_tiles: {'1': providerTile}, used: false, _sourceLoaded: true},
                terrain: {_tiles: {'1': nonConsumerTile}, _reloadTile: reloadSpy},
            },
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkConsumerLayers(),
            map: {painter: {elevationCoverageSnapshot: null}},
        };

        updateElevationCoverage(style, mkCrossSourceState(['provider']));

        expect(reloadSpy).not.toHaveBeenCalled();
    });

    test('reparses a deferred consumer when providers settle even if snapshot content is unchanged', () => {
        const canonical = new CanonicalTileID(14, 8800, 5373);
        const providerTile = {
            tileID: {canonical},
            loaded: () => true,
            parsedElevationFeatures: [],
            parsedElevationGeneration: 1,
            state: 'loading',
        };
        const consumerTile = {tileID: {canonical}, hasDeferredElevationFeatures: true};
        const reloadSpy = vi.fn();
        const style = {
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {
                provider: {_tiles: {'1': providerTile}, used: false, _sourceLoaded: true},
                consumer: {_tiles: {'1': consumerTile}, _reloadTile: reloadSpy},
            },
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkCrossSourceLayers(),
            map: {painter: {elevationCoverageSnapshot: null}},
        };
        const state = mkCrossSourceState(['provider']);

        updateElevationCoverage(style, state);
        reloadSpy.mockClear();
        consumerTile.hasDeferredElevationFeatures = true;

        updateElevationCoverage(style, state);
        expect(reloadSpy).not.toHaveBeenCalled();

        providerTile.state = 'loaded';
        updateElevationCoverage(style, state);
        expect(reloadSpy).toHaveBeenCalledWith(1, 'reloading');
        expect(consumerTile.hasDeferredElevationFeatures).toBe(false);
        expect(style.map.painter.elevationProvidersReady).toBe(true);
    });

    test('readiness waits for loaded ingest tiles to have their elevation parsed', () => {
        // Readiness waits for parsedElevationFeatures, not just loaded().
        const canonical = new CanonicalTileID(14, 8800, 5373);
        const providerTile = {
            tileID: {canonical},
            loaded: () => true,
            parsedElevationFeatures: undefined,
            parsedElevationGeneration: 1,
            state: 'loaded',
        };
        const consumerTile = {tileID: {canonical}, hasDeferredElevationFeatures: false};
        const style = {
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {
                provider: {_tiles: {'1': providerTile}, used: false, _sourceLoaded: true},
                consumer: {_tiles: {'1': consumerTile}, _reloadTile: vi.fn()},
            },
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkCrossSourceLayers(),
            map: {painter: {elevationCoverageSnapshot: null}},
        };
        const state = mkCrossSourceState(['provider']);

        // Tile loaded but elevation not parsed yet.
        updateElevationCoverage(style, state);
        expect(style.map.painter.elevationProvidersReady).toBe(false);

        // Elevation parsed (even if empty) → ready.
        providerTile.parsedElevationFeatures = [];
        updateElevationCoverage(style, state);
        expect(style.map.painter.elevationProvidersReady).toBe(true);
    });

});

describe('updateElevationCoverage under terrain', () => {
    test('is a no-op that nulls the snapshot when terrain is enabled', () => {
        const canonical = new CanonicalTileID(14, 8800, 5373);
        const providerTile = {
            tileID: {canonical},
            loaded: () => true,
            parsedElevationFeatures: [mkConstantFeature(1, 10.0)],
            parsedElevationGeneration: 1,
        };
        const consumerTile = {
            tileID: {canonical},
            hasDeferredElevationFeatures: true,
        };
        const reloadSpy = vi.fn();
        const style = {
            _mergedHdRoadElevationSourceCaches: {},
            _mergedOtherSourceCaches: {
                provider: {_tiles: {'1': providerTile}, used: false, _sourceLoaded: true},
                consumer: {_tiles: {'1': consumerTile}, _reloadTile: reloadSpy},
            },
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkConsumerLayers(),
            terrain: {},
            map: {painter: {terrain: {}, elevationCoverageSnapshot: {stale: true}}},
        };

        updateElevationCoverage(style, mkCrossSourceState(['provider']));

        expect(reloadSpy).not.toHaveBeenCalled();
        expect(style.map.painter.elevationCoverageSnapshot).toBe(null);
    });
});

describe('LineHDExtension defer, hide and flat-on-miss', () => {
    const canonical = new CanonicalTileID(14, 1, 1);
    const geometry = [[new Point(0, 0), new Point(100, 0)]];

    const mkFeature = () => ({
        properties: {[PROPERTY_ELEVATION_ID]: 999},
        type: 2,
        index: 0,
        sourceLayerIndex: 0,
        geometry,
        patterns: {},
    });

    test('cross-source with providers not ready → defer (no geometry)', () => {
        const ext = new LineHDExtension(true, false);
        const bucket = mkLineHdBucket();

        ext.handleFeature(mkFeature(), geometry, canonical, [], {registry: [], hasCoveringTile: false, allProvidersReady: false}, true, 'miter', 'butt', 2, 0.4, bucket);

        expect(ext.hasDeferredElevationFeatures).toBe(true);
        expect(bucket.fillNonElevatedRoadSegment).not.toHaveBeenCalled();
        expect(bucket.addLine).not.toHaveBeenCalled();
    });

    test('cross-source with providers ready, covering tile present and no match → hide (no geometry)', () => {
        const ext = new LineHDExtension(true, false);
        const bucket = mkLineHdBucket();

        ext.handleFeature(mkFeature(), geometry, canonical, [], {registry: [], hasCoveringTile: true, allProvidersReady: true}, true, 'miter', 'butt', 2, 0.4, bucket);

        expect(ext.hasDeferredElevationFeatures).toBe(false);
        expect(bucket.fillNonElevatedRoadSegment).not.toHaveBeenCalled();
        expect(bucket.addLine).not.toHaveBeenCalled();
    });

    test('cross-source with providers ready and no covering tile → flat segment', () => {
        const ext = new LineHDExtension(true, false);
        const bucket = mkLineHdBucket();

        ext.handleFeature(mkFeature(), geometry, canonical, [], {registry: [], hasCoveringTile: false, allProvidersReady: true}, true, 'miter', 'butt', 2, 0.4, bucket);

        expect(ext.hasDeferredElevationFeatures).toBe(false);
        expect(bucket.fillNonElevatedRoadSegment).toHaveBeenCalled();
        expect(bucket.addLine).toHaveBeenCalled();
    });

    test('same-source (cross-source disabled) with no match → flat segment', () => {
        const ext = new LineHDExtension(true, false);
        const bucket = mkLineHdBucket();

        ext.handleFeature(mkFeature(), geometry, canonical, [], null, false, 'miter', 'butt', 2, 0.4, bucket);

        expect(ext.hasDeferredElevationFeatures).toBe(false);
        expect(bucket.fillNonElevatedRoadSegment).toHaveBeenCalled();
        expect(bucket.addLine).toHaveBeenCalled();
    });
});

describe('reparseElevationConsumerTiles (terrain toggle)', () => {
    test('reloads every consumer tile but not non-consumer sources', () => {
        const canonical = new CanonicalTileID(14, 8800, 5373);
        const consumerTile = {tileID: {canonical}, hasDeferredElevationFeatures: false};
        const nonConsumerTile = {tileID: {canonical}, hasDeferredElevationFeatures: false};
        const consumerReload = vi.fn();
        const nonConsumerReload = vi.fn();
        const style = {
            _mergedOtherSourceCaches: {
                consumer: {_tiles: {'1': consumerTile}, _reloadTile: consumerReload},
                terrain: {_tiles: {'1': nonConsumerTile}, _reloadTile: nonConsumerReload},
            },
            _mergedSymbolSourceCaches: {},
            _mergedLayers: mkConsumerLayers(),
        };

        reparseElevationConsumerTiles(style);

        expect(consumerReload).toHaveBeenCalledWith(1, 'reloading');
        expect(nonConsumerReload).not.toHaveBeenCalled();
    });
});

// Elevation exports are lazy until prepareHD(). Uses hd_main_esm directly because
// the normal test env loads HD synchronously via UMD.

describe('HD elevation eager/lazy split (hd_main_esm)', () => {
    test('elevation exports are undefined before prepareHD()', async () => {
        const mod = await import('../../../modules/hd_main_esm');
        const {HD, prepareHD} = mod;

        expect(typeof HD.updateFrcCoverageFadeRange).toBe('function');
        expect(HD.loaded).toBeFalsy();
        expect(HD.setupAndUpdateElevationCoverage).toBeUndefined();
        expect(HD.buildElevationRequestParams).toBeUndefined();
        expect(HD.HdElevationState).toBeUndefined();
        expect(HD.updateElevationCoverage).toBeUndefined();
        expect(HD.updateHdElevationSourceCache).toBeUndefined();
        expect(HD.updateCrossSourceElevationGate).toBeUndefined();
        expect(HD.handleTerrainToggle).toBeUndefined();

        await prepareHD();
        expect(HD.loaded).toBe(true);
        expect(typeof HD.setupAndUpdateElevationCoverage).toBe('function');
        expect(typeof HD.buildElevationRequestParams).toBe('function');
        expect(typeof HD.HdElevationState).toBe('function');
        expect(typeof HD.updateElevationCoverage).toBe('function');
        expect(typeof HD.updateHdElevationSourceCache).toBe('function');
        expect(typeof HD.updateCrossSourceElevationGate).toBe('function');
        expect(typeof HD.handleTerrainToggle).toBe('function');
    });

    test('prepareHD() is idempotent — second call leaves elevation exports stable', async () => {
        const mod = await import('../../../modules/hd_main_esm');
        const {HD, prepareHD} = mod;

        await prepareHD();
        const setup = HD.setupAndUpdateElevationCoverage;
        const buildParams = HD.buildElevationRequestParams;
        await prepareHD();
        expect(HD.setupAndUpdateElevationCoverage).toBe(setup);
        expect(HD.buildElevationRequestParams).toBe(buildParams);
    });
});
