import {test, expect, vi} from "../../util/vitest.js";
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {CollisionBoxArray} from '../../../src/data/array_types.js';
import {performSymbolLayout, SymbolBucketConstants} from '../../../src/symbol/symbol_layout.js';
import {Placement} from '../../../src/symbol/placement.js';
import Transform from '../../../src/geo/transform.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import Tile from '../../../src/source/tile.js';
import CrossTileSymbolIndex from '../../../src/symbol/cross_tile_symbol_index.js';
import FeatureIndex from '../../../src/data/feature_index.js';
import {createSymbolBucket} from '../../util/create_symbol_layer.js';
import {getProjection} from '../../../src/geo/projection/index.js';
// eslint-disable-next-line import/no-unresolved
import vectorStub from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';
import glyphData from '../../fixtures/fontstack-glyphs.json';

// Load a point feature from fixture tile.
const vt = new VectorTile(new Protobuf(vectorStub));
const feature = vt.layers.place_label.feature(10);

/*eslint new-cap: 0*/
const collisionBoxArray = new CollisionBoxArray();
const transform = new Transform();
transform.width = 100;
transform.height = 100;
transform.cameraToCenterDistance = 100;

const stacks = {'Test': glyphData};
const glyphPositions = {'Test' : {}};
const glyphPositonMap = glyphPositions['Test'];
for (const id in glyphData.glyphs) {
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
    performSymbolLayout(bucketA, stacks, glyphPositions, null, null, null, null, null, null, projection);
    const tileA = new Tile(tileID, 512, 0, painter);
    tileA.latestFeatureIndex = new FeatureIndex(tileID);
    tileA.buckets = {test: bucketA};
    tileA.collisionBoxArray = collisionBoxArray;

    // add same feature from bucket B
    bucketB.populate([{feature}], options);
    performSymbolLayout(bucketB, stacks, glyphPositions, null, null, null, null, null, null, projection);
    const tileB = new Tile(tileID, 512, 0, painter);
    tileB.buckets = {test: bucketB};
    tileB.collisionBoxArray = collisionBoxArray;

    crossTileSymbolIndex.addLayer(bucketA.layers[0], [tileA, tileB], 0.0, projection);

    const place = (layer, tile) => {
        const parts = [];
        placement.getBucketParts(parts, layer, tile, false);
        for (const part of parts) {
            placement.placeLayerBucketPart(part, new Set(), false);
        }
    };
    const a = placement.collisionIndex.grid.keysLength();
    place(bucketA.layers[0], tileA);
    const b = placement.collisionIndex.grid.keysLength();
    expect(a).not.toEqual(b);

    const a2 = placement.collisionIndex.grid.keysLength();
    place(bucketB.layers[0], tileB);
    const b2 = placement.collisionIndex.grid.keysLength();
    expect(b2).toEqual(a2);
});

test('SymbolBucket integer overflow', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(SymbolBucketConstants, 'MAX_GLYPHS', 'get').mockImplementation(() => 5);

    const bucket = bucketSetup();
    const projection = getProjection({name: 'mercator'});
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([{feature}], options);
    const fakeRect = {w: 10, h: 10};
    performSymbolLayout(bucket, stacks, {'Test':  {97: fakeRect, 98: fakeRect, 99: fakeRect, 100: fakeRect, 101: fakeRect, 102: fakeRect}}, null, null, null, null, null, null, projection);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(
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

