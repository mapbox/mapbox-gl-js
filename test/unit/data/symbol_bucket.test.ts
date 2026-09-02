// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi} from '../../util/vitest';
import {PbfReader} from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {CollisionBoxArray} from '../../../src/data/array_types';
import {performSymbolLayout, postRasterizationSymbolLayout, SymbolBucketConstants} from '../../../src/symbol/symbol_layout';
import {Placement} from '../../../src/symbol/placement';
import Transform from '../../../src/geo/transform';
import {OverscaledTileID} from '../../../src/source/tile_id';
import Tile from '../../../src/source/tile';
import CrossTileSymbolIndex from '../../../src/symbol/cross_tile_symbol_index';
import FeatureIndex from '../../../src/data/feature_index';
import {createSymbolBucket} from '../../util/create_symbol_layer';
import {getProjection} from '../../../src/geo/projection/index';
import vectorStub from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';
import glyphData from '../../fixtures/fontstack-glyphs.json';
import SegmentVector from '../../../src/data/segment';
import SymbolBucket from '../../../src/data/bucket/symbol_bucket';
import SymbolStyleLayer from '../../../src/style/style_layer/symbol_style_layer';
import featureFilter from '../../../src/style-spec/feature_filter/index';
import {GlobalPlacement} from '../../../src/placement/global_placement';
import {SymbolIdRangeAllocator} from '../../../src/placement/symbol_id_range_allocator';
import {getSymbolPlacementTileProjectionMatrix} from '../../../src/geo/projection/projection_util';
import EXTENT from '../../../src/style-spec/data/extent';
import {makeFQID} from '../../../src/util/fqid';
import {subgroupOrderForLayerPosition} from '../../../src/placement/symbol_placement_parameters';

import type CollisionIndex from '../../../src/symbol/collision_index';
import type {BucketPart} from '../../../src/symbol/placement';

// Load a point feature from fixture tile.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const vt = new VectorTile(new PbfReader(vectorStub));
const feature = vt.layers.place_label.feature(10);

/*eslint new-cap: 0*/
const collisionBoxArray = new CollisionBoxArray();
const transform = new Transform();
transform.width = 100;
transform.height = 100;
transform.cameraToCenterDistance = 100;

const stacks = {'Test': glyphData};
const glyphPositions = {'Test': {}};
const glyphPositonMap = glyphPositions['Test'];
for (const id in glyphData.glyphs) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    glyphPositonMap[id] = glyphData.glyphs[id].rect;
}

function bucketSetup(text = 'abcde') {
    return createSymbolBucket('test', 'Test', text, collisionBoxArray);
}

test('SymbolBucket', () => {
    const bucketA = bucketSetup();
    const bucketB = bucketSetup();
    const projection = getProjection({name: 'mercator'});
    const options = {iconDependencies: {}, glyphDependencies: {}};
    const placement = new Placement(transform, 0, true);
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const crossTileSymbolIndex = new CrossTileSymbolIndex();
    const painter = {transform: {projection}};

    // add feature from bucket A
    bucketA.populate([{feature}], options);
    const bucketAData = performSymbolLayout(bucketA, stacks, glyphPositions, null, null, null, null, null, null, projection);

    postRasterizationSymbolLayout(bucketA, bucketAData, null, null, null, null, projection, null, null, {});

    const tileA = new Tile(tileID, 512, 0, painter);
    tileA.latestFeatureIndex = new FeatureIndex(tileID);
    tileA.buckets = {test: bucketA};
    tileA.collisionBoxArray = collisionBoxArray;

    // add same feature from bucket B
    bucketB.populate([{feature}], options);
    const bucketBData = performSymbolLayout(bucketB, stacks, glyphPositions, null, null, null, null, null, null, projection);

    postRasterizationSymbolLayout(bucketB, bucketBData, null, null, null, null, projection, null, null, {});
    const tileB = new Tile(tileID, 512, 0, painter);
    tileB.buckets = {test: bucketB};
    tileB.collisionBoxArray = collisionBoxArray;

    crossTileSymbolIndex.addLayer(bucketA.layers[0], [tileA, tileB], 0.0, projection);

    const place = (layer, tile) => {
        const parts: BucketPart[] = [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        placement.getBucketParts(parts, layer, tile, false);
        for (const part of parts) {
            placement.placeLayerBucketPart(part, new Set(), false);
        }
    };
    const ci = placement.collisionIndex as CollisionIndex;
    const a = ci.grid.keysLength();
    place(bucketA.layers[0], tileA);
    const b = ci.grid.keysLength();
    expect(a).not.toEqual(b);

    const a2 = ci.grid.keysLength();
    place(bucketB.layers[0], tileB);
    const b2 = ci.grid.keysLength();
    expect(b2).toEqual(a2);
});

test('SymbolBucket#addToPlacement places a real symbol via the new placement pipeline', () => {
    const bucket = bucketSetup();
    const projection = getProjection({name: 'mercator'});
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([{feature}], options);
    const bucketData = performSymbolLayout(bucket, stacks, glyphPositions, null, null, null, null, null, null, projection);
    postRasterizationSymbolLayout(bucket, bucketData, null, null, null, null, projection, null, null, {});

    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const placementTransform = new Transform();
    placementTransform.resize(100, 100);

    const posMatrix = getSymbolPlacementTileProjectionMatrix(tileID, projection, placementTransform, 'mercator');
    const textPixelRatio = 512 / EXTENT;
    const tile = {tileID, collisionBoxArray, latestFeatureIndex: null};

    const globalPlacement = new GlobalPlacement();
    const idRangeAllocator = new SymbolIdRangeAllocator();
    const showSymbolVariantSpy = vi.spyOn(bucket, 'showSymbolVariant');

    globalPlacement.startPlacement(0, 100, 100);
    globalPlacement.startSymbolSourceProcessing(bucket);
    bucket.addToPlacement(globalPlacement, idRangeAllocator, 1, posMatrix, placementTransform, textPixelRatio, tile, null, new Map(), 0);

    // addToPlacement seeds the (until now empty) opacity buffer with one hidden entry per glyph
    // quad, since new placement never runs Placement#updateBucketOpacities to build it from scratch.
    expect(bucket.text.opacityVertexArray.length).toBeGreaterThan(0);
    for (let i = 0; i < bucket.text.opacityVertexArray.length; i++) {
        expect(bucket.text.opacityVertexArray.uint32[i]).toEqual(0);
    }

    globalPlacement.finishSourceProcessing();
    globalPlacement.finishPlacementRun();

    // The fixture's single point feature has no colliding neighbor, so it should place successfully
    // (was invisible -> now visible), proving id allocation, size evaluation, anchor projection and
    // the collision grid all agree end to end.
    expect(showSymbolVariantSpy).toHaveBeenCalledOnce();
    // showSymbolVariant wrote full opacity (packed 0xFFFFFFFF) into the placed text's glyph quads.
    for (let i = 0; i < bucket.text.opacityVertexArray.length; i++) {
        expect(bucket.text.opacityVertexArray.uint32[i]).toEqual(4294967295);
    }
    // Recorded so the next run feeds this instance's priority back as VARIANT_VISIBLE.
    expect(bucket.placementVariantVisible).toEqual([true]);

    // A second run with the same (still non-colliding) symbol should keep it visible without a
    // redundant showSymbolVariant call, since there is no visibility transition.
    showSymbolVariantSpy.mockClear();
    globalPlacement.startPlacement(1, 100, 100);
    globalPlacement.startSymbolSourceProcessing(bucket);
    bucket.addToPlacement(globalPlacement, idRangeAllocator, 1, posMatrix, placementTransform, textPixelRatio, tile, null, new Map(), 0);
    globalPlacement.finishSourceProcessing();
    globalPlacement.finishPlacementRun();

    expect(showSymbolVariantSpy).not.toHaveBeenCalled();

    // A tile returning from the cache drops new placement's decisions: everything hides and the
    // per-instance visibility record clears, so a stale "visible" doesn't outrank on-screen symbols.
    bucket.resetPlacementVisibility();

    expect(bucket.placementVariantVisible).toEqual([false]);
    for (let i = 0; i < bucket.text.opacityVertexArray.length; i++) {
        expect(bucket.text.opacityVertexArray.uint32[i]).toEqual(0);
    }
});

const PLACE_LABEL_SOURCE_LAYER_INDEX = 3;
const PLACE_LABEL_FEATURE_INDEX = 10;

function bucketSetupWithPlacementProps(placementPriority?: unknown, placementGroup?: unknown): SymbolBucket {
    const paint: Record<string, unknown> = {};
    if (placementPriority !== undefined) paint['placement-priority'] = placementPriority;
    if (placementGroup !== undefined) paint['placement-group'] = placementGroup;
    const layer = new SymbolStyleLayer({
        id: 'test',
        type: 'symbol',
        layout: {'text-font': ['Test'], 'text-field': 'abcde'},
        paint,
        filter: featureFilter()
    }, 'scope');
    layer.recalculate({zoom: 0});
    return new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray,
        layers: [layer],
        sourceLayerIndex: PLACE_LABEL_SOURCE_LAYER_INDEX,
        projection: {name: 'mercator'}
    });
}

function fixtureFeatureIndex(tileID: OverscaledTileID, promoteId?: string): FeatureIndex {
    const featureIndex = new FeatureIndex(tileID, promoteId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    featureIndex.rawTileData = vectorStub;
    return featureIndex;
}

function placeAndCapturePriority(bucket: SymbolBucket, groupOrders: Map<string, number>, styleLayerOrder: number, withFeatureIndex = false, featureStates = {}, promoteId?: string) {
    const projection = getProjection({name: 'mercator'});
    const options = {iconDependencies: {}, glyphDependencies: {}};
    bucket.populate([{feature, index: PLACE_LABEL_FEATURE_INDEX, sourceLayerIndex: PLACE_LABEL_SOURCE_LAYER_INDEX}], options);
    const bucketData = performSymbolLayout(bucket, stacks, glyphPositions, null, null, null, null, null, null, projection);
    postRasterizationSymbolLayout(bucket, bucketData, null, null, null, null, projection, null, null, {});

    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const placementTransform = new Transform();
    placementTransform.resize(100, 100);
    const posMatrix = getSymbolPlacementTileProjectionMatrix(tileID, projection, placementTransform, 'mercator');
    const textPixelRatio = 512 / EXTENT;
    const tile = {tileID, collisionBoxArray, latestFeatureIndex: withFeatureIndex ? fixtureFeatureIndex(tileID, promoteId) : null};

    const globalPlacement = new GlobalPlacement();
    const idRangeAllocator = new SymbolIdRangeAllocator();
    const startVariantSpy = vi.spyOn(globalPlacement, 'startSymbolVariantProcessing');

    globalPlacement.startPlacement(0, 100, 100);
    globalPlacement.startSymbolSourceProcessing(bucket);
    bucket.addToPlacement(globalPlacement, idRangeAllocator, 1, posMatrix, placementTransform, textPixelRatio, tile, null, groupOrders, styleLayerOrder, featureStates);
    globalPlacement.finishSourceProcessing();
    globalPlacement.finishPlacementRun();

    expect(startVariantSpy).toHaveBeenCalledOnce();
    return startVariantSpy.mock.calls[0][1];
}

test('SymbolBucket#addToPlacement feeds placement-priority and a matched placement-group order', () => {
    const bucket = bucketSetupWithPlacementProps(5, 'group-a');
    const groupOrders = new Map([[makeFQID('group-a', 'scope'), 42]]);

    const priority = placeAndCapturePriority(bucket, groupOrders, 7);

    expect(priority.symbolPlacementPriority).toEqual(5);
    expect(priority.placementSubgroupOrder).toEqual(42);
    expect(priority.styleLayerOrder).toEqual(7);
});

test('SymbolBucket#addToPlacement falls back to the layer\'s implicit group when placement-group is unset', () => {
    const bucket = bucketSetupWithPlacementProps(undefined, undefined);

    const priority = placeAndCapturePriority(bucket, new Map(), 7);

    expect(priority.symbolPlacementPriority).toEqual(0);
    expect(priority.placementSubgroupOrder).toEqual(subgroupOrderForLayerPosition(7));
});

test('SymbolBucket#addToPlacement falls back to the layer\'s implicit group when placement-group matches no layer', () => {
    const bucket = bucketSetupWithPlacementProps(undefined, 'no-such-group');

    const priority = placeAndCapturePriority(bucket, new Map(), 7);

    expect(priority.symbolPlacementPriority).toEqual(0);
    expect(priority.placementSubgroupOrder).toEqual(subgroupOrderForLayerPosition(7));
});

// The fixture feature (`place_label` #10, Rochester) carries scalerank 4 and type "city".
test('SymbolBucket#addToPlacement evaluates a data-driven placement-priority per feature', () => {
    const bucket = bucketSetupWithPlacementProps(['get', 'scalerank'], undefined);

    const priority = placeAndCapturePriority(bucket, new Map(), 7, true);

    expect(priority.symbolPlacementPriority).toEqual(4);
});

test('SymbolBucket#addToPlacement resolves a data-driven placement-group per feature', () => {
    const bucket = bucketSetupWithPlacementProps(undefined, ['get', 'type']);
    const groupOrders = new Map([[makeFQID('city', 'scope'), 42]]);

    const priority = placeAndCapturePriority(bucket, groupOrders, 7, true);

    expect(priority.placementSubgroupOrder).toEqual(42);
});

test('SymbolBucket#addToPlacement falls back to the implicit group when a data-driven placement-group matches no layer', () => {
    const bucket = bucketSetupWithPlacementProps(undefined, ['get', 'type']);

    const priority = placeAndCapturePriority(bucket, new Map(), 7, true);

    expect(priority.placementSubgroupOrder).toEqual(subgroupOrderForLayerPosition(7));
});

test('SymbolBucket#addToPlacement resolves a feature-state-driven placement-group per feature', () => {
    const bucket = bucketSetupWithPlacementProps(undefined, ['feature-state', 'grp']);
    const groupOrders = new Map([[makeFQID('stateful-group', 'scope'), 42]]);
    const featureStates = {[String(feature.id)]: {grp: 'stateful-group'}};

    const priority = placeAndCapturePriority(bucket, groupOrders, 7, true, featureStates);

    expect(priority.placementSubgroupOrder).toEqual(42);
});

test('SymbolBucket#addToPlacement evaluates a feature-state-driven placement-priority per feature', () => {
    const bucket = bucketSetupWithPlacementProps(['feature-state', 'prio'], undefined);
    const featureStates = {[String(feature.id)]: {prio: 9}};

    const priority = placeAndCapturePriority(bucket, new Map(), 7, true, featureStates);

    expect(priority.symbolPlacementPriority).toEqual(9);
});

test('SymbolBucket#addToPlacement resolves feature state by the promoted id when promoteId is configured', () => {
    const bucket = bucketSetupWithPlacementProps(['feature-state', 'prio'], undefined);
    // `osm_id` on the fixture feature (-1517267225) differs from its raw vector-tile `feature.id`
    // (18446744072192285000); feature state must be looked up under the promoted value.
    const featureStates = {[String(feature.properties.osm_id)]: {prio: 9}};

    const priority = placeAndCapturePriority(bucket, new Map(), 7, true, featureStates, 'osm_id');

    expect(priority.symbolPlacementPriority).toEqual(9);
});

test('SymbolBucket#addToPlacement ignores feature state keyed by the raw vector-tile id when promoteId is configured', () => {
    const bucket = bucketSetupWithPlacementProps(['feature-state', 'prio'], undefined);
    // Keyed by the raw `feature.id` rather than the promoted `osm_id` -- must not match, proving
    // the lookup uses the promoted id (via FeatureIndex#getId) and not `feature.id` directly.
    const featureStates = {[String(feature.id)]: {prio: 9}};

    const priority = placeAndCapturePriority(bucket, new Map(), 7, true, featureStates, 'osm_id');

    expect(priority.symbolPlacementPriority).toEqual(0);
});

test('SymbolBucket#addToPlacement falls back to the implicit group when no feature state is set for the feature', () => {
    const bucket = bucketSetupWithPlacementProps(undefined, ['coalesce', ['feature-state', 'grp'], 'group-a']);
    const groupOrders = new Map([[makeFQID('group-a', 'scope'), 11], [makeFQID('stateful-group', 'scope'), 42]]);

    const priority = placeAndCapturePriority(bucket, groupOrders, 7, true, {});

    expect(priority.placementSubgroupOrder).toEqual(11);
});

test('SymbolBucket#addToPlacement falls back to the implicit group when a data-driven placement-group has no feature', () => {
    const bucket = bucketSetupWithPlacementProps(undefined, ['get', 'type']);
    const groupOrders = new Map([[makeFQID('city', 'scope'), 42]]);

    const priority = placeAndCapturePriority(bucket, groupOrders, 7, false);

    expect(priority.placementSubgroupOrder).toEqual(subgroupOrderForLayerPosition(7));
});

test('SymbolBucket#resetPlacementVisibility is a no-op before the bucket has ever been fed to new placement', () => {
    const bucket = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};
    const projection = getProjection({name: 'mercator'});

    bucket.populate([{feature}], options);
    const bucketData = performSymbolLayout(bucket, stacks, glyphPositions, null, null, null, null, null, null, projection);
    postRasterizationSymbolLayout(bucket, bucketData, null, null, null, null, projection, null, null, {});

    expect(() => bucket.resetPlacementVisibility()).not.toThrow();
    expect(bucket.text.opacityVertexArray.length).toEqual(0);
});

test('SymbolBucket integer overflow', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(SymbolBucketConstants, 'MAX_GLYPHS', 'get').mockImplementation(() => 5);

    const bucket = bucketSetup();
    const projection = getProjection({name: 'mercator'});
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([{feature}], options);
    const fakeRect = {w: 10, h: 10};
    const bucketData = performSymbolLayout(bucket, stacks, {'Test': {97: fakeRect, 98: fakeRect, 99: fakeRect, 100: fakeRect, 101: fakeRect, 102: fakeRect}}, null, null, null, null, null, null, projection);
    postRasterizationSymbolLayout(bucket, bucketData, null, null, null, null, projection, null, null, {});

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.warn.mock.calls[0][0]
    ).toMatch(/Too many glyphs being rendered in a tile./);
});

test('SymbolBucket detects rtl text', () => {
    const rtlBucket = bucketSetup('مرحبا');
    const ltrBucket = bucketSetup('hello');
    const options = {iconDependencies: {}, glyphDependencies: {}};
    rtlBucket.populate([{feature}], options);
    ltrBucket.populate([{feature}], options);

    expect(rtlBucket.hasRTLText).toBeTruthy();
    expect(ltrBucket.hasRTLText).toBeFalsy();
});

// Test to prevent symbol bucket with rtl from text being culled by worker serialization.
test('SymbolBucket with rtl text is NOT empty even though no symbol instances are created', () => {
    const rtlBucket = bucketSetup('مرحبا');
    const options = {iconDependencies: {}, glyphDependencies: {}};
    rtlBucket.createArrays();
    rtlBucket.populate([{feature}], options);

    expect(rtlBucket.isEmpty()).toBeFalsy();
    expect(rtlBucket.symbolInstances.length).toEqual(0);
});

test('SymbolBucket detects rtl text mixed with ltr text', () => {
    const mixedBucket = bucketSetup('مرحبا translates to hello');
    const options = {iconDependencies: {}, glyphDependencies: {}};
    mixedBucket.populate([{feature}], options);

    expect(mixedBucket.hasRTLText).toBeTruthy();
});

test('sortFeatures multi-segment: disables sorting when multiple segments exist', () => {
    // When a tile has enough symbols to overflow MAX_VERTEX_ARRAY_LENGTH, multiple render
    // segments are created. Viewport-y sorting across segment boundaries is unsupported
    // so sortFeatures must disable sorting by setting sortFeaturesByY to false and returning early
    const projection = getProjection({name: 'mercator'});
    const originalMax = SegmentVector.MAX_VERTEX_ARRAY_LENGTH;
    SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 20;

    try {
        const layer = new SymbolStyleLayer({
            id: 'test-multi-seg',
            type: 'symbol',
            layout: {
                'text-font': ['Test'],
                'text-field': 'abcdefghij',
                'symbol-z-order': 'viewport-y',
                'text-allow-overlap': true
            },
            filter: featureFilter()
        }, '');
        layer.recalculate({zoom: 0});

        const collisionBoxArrayLocal = new CollisionBoxArray();
        const bucket = new SymbolBucket({
            overscaling: 1,
            zoom: 0,
            collisionBoxArray: collisionBoxArrayLocal,
            layers: [layer],
            projection: {name: 'mercator'}
        });

        bucket.populate([{feature}, {feature}, {feature}, {feature}, {feature}], {iconDependencies: {}, glyphDependencies: {}});

        const glyphMap = {'Test': {}};
        for (const id in glyphData.glyphs) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            glyphMap['Test'][id] = glyphData.glyphs[id].rect;
        }

        const bucketData = performSymbolLayout(bucket, {'Test': glyphData}, glyphMap, null, null, null, null, null, null, projection);
        postRasterizationSymbolLayout(bucket, bucketData, null, null, null, null, projection, null, null, {});

        // Verify precondition: sortFeaturesByY must be true before calling sortFeatures.
        expect(bucket.sortFeaturesByY).toBe(true);

        bucket.sortFeatures(Math.PI / 4);

        // Multiple segments must have been created by the reduced MAX_VERTEX_ARRAY_LENGTH.
        expect(bucket.text.segments.get().length).toBeGreaterThan(1);

        // The guard must have disabled sorting to prevent cross-segment index corruption.
        expect(bucket.sortFeaturesByY).toBe(false);
    } finally {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = originalMax;
    }
});

