// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import {PbfReader} from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {CollisionBoxArray} from '../../../src/data/array_types';
import {performSymbolLayout, postRasterizationSymbolLayout} from '../../../src/symbol/symbol_layout';
import {getProjection} from '../../../src/geo/projection/index';
import {createSymbolBucket} from '../../util/create_symbol_layer';
import {TilePlacementRelationsIndex} from '../../../src/placement/tile_placement_relations_index';
import SymbolBucket, {generatedSymbolId} from '../../../src/data/bucket/symbol_bucket';
import vectorStub from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';
import glyphData from '../../fixtures/fontstack-glyphs.json';

import type Tile from '../../../src/source/tile';

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const feature = new VectorTile(new PbfReader(vectorStub)).layers.place_label.feature(10);
const stacks = {'Test': glyphData};
const glyphPositions = {'Test': {}};
for (const id in glyphData.glyphs) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    glyphPositions['Test'][id] = glyphData.glyphs[id].rect;
}

let nextUid = 1;

function makeTile(overscaledZ: number, wrap: number, z: number, x: number, y: number, bucket?: SymbolBucket): Tile {
    const buckets = bucket ? {[bucket.layerIds[0]]: bucket} : {};
    return {uid: nextUid++, tileID: new OverscaledTileID(overscaledZ, wrap, z, x, y), buckets, holdingForFade: () => false} as unknown as Tile;
}

function holdForFade(tile: Tile) {
    tile.holdingForFade = () => true;
}

// A laid-out bucket of one symbol of the same label per anchor, moved to that anchor in its tile's
// space, so the same label can be placed at matching positions in tiles of different zoom levels
function makeBucketAt(anchors: Array<[number, number]>, text = 'abcde'): SymbolBucket {
    const bucket = createSymbolBucket('test', 'Test', text, new CollisionBoxArray());
    bucket.bucketInstanceId = ++SymbolBucket.maxBucketInstanceId;
    const projection = getProjection({name: 'mercator'});
    bucket.populate(anchors.map(() => ({feature})), {iconDependencies: {}, glyphDependencies: {}});
    const data = performSymbolLayout(bucket, stacks, glyphPositions, null, null, null, null, null, null, projection);
    postRasterizationSymbolLayout(bucket, data, null, null, null, null, projection, null, null, {});
    // SymbolInstanceArray elements are 80 bytes, starting with tileAnchorX and tileAnchorY
    anchors.forEach(([x, y], i) => {
        bucket.symbolInstances.float32[i * 20] = x;
        bucket.symbolInstances.float32[i * 20 + 1] = y;
    });
    return bucket;
}

function makeBucket(x: number, y: number, text = 'abcde'): SymbolBucket {
    return makeBucketAt([[x, y]], text);
}

function makeVisible(bucket: SymbolBucket, refTime: number, i = 0) {
    bucket.ensurePlacementState();
    bucket.showSymbolVariant({symbolId: generatedSymbolId(bucket.bucketInstanceId, i), variantIdx: 0}, refTime, 0);
}

function makeFadingOut(bucket: SymbolBucket, refTime: number, i = 0) {
    makeVisible(bucket, refTime, i);
    bucket.hideSymbolVariant({symbolId: generatedSymbolId(bucket.bucketInstanceId, i), variantIdx: 0}, refTime, 300);
}

test('TilePlacementRelationsIndex keeps the symbols of unrelated sibling tiles owned', () => {
    const index = new TilePlacementRelationsIndex();
    const bucketA = makeBucket(1000, 1000);
    const bucketB = makeBucket(1000, 1000);
    index.sync([makeTile(1, 0, 1, 0, 0, bucketA), makeTile(1, 0, 1, 1, 0, bucketB)]);
    expect(bucketA.nonOwnedSymbols).toEqual(new Uint8Array([0]));
    expect(bucketB.nonOwnedSymbols).toEqual(new Uint8Array([0]));
});

test('TilePlacementRelationsIndex marks a parent symbol under one of several rendered children as not owned', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(6000, 6000);
    index.sync([makeTile(1, 0, 1, 0, 0), makeTile(0, 0, 0, 0, 0, parentBucket), makeTile(1, 0, 1, 1, 1)]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));
});

test('TilePlacementRelationsIndex marks a symbol under a rendered grandchild as not owned in every ancestor', () => {
    const index = new TilePlacementRelationsIndex();
    const grandparentBucket = makeBucket(1000, 1000);
    const parentBucket = makeBucket(2000, 2000);
    index.sync([makeTile(0, 0, 0, 0, 0, grandparentBucket), makeTile(1, 0, 1, 0, 0, parentBucket), makeTile(2, 0, 2, 0, 0)]);
    expect(grandparentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));
});

test('TilePlacementRelationsIndex marks a grandparent symbol as not owned once a tile is added between it and a rendered grandchild (zoom-out)', () => {
    const index = new TilePlacementRelationsIndex();
    // Under the parent's area but outside the grandchild's
    const grandparentBucket = makeBucket(3000, 3000);
    const grandparent = makeTile(0, 0, 0, 0, 0, grandparentBucket);
    const grandchild = makeTile(2, 0, 2, 0, 0);
    index.sync([grandparent, grandchild]);
    expect(grandparentBucket.nonOwnedSymbols).toEqual(new Uint8Array([0]));

    index.sync([grandparent, grandchild, makeTile(1, 0, 1, 0, 0)]);
    expect(grandparentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));
});

test('TilePlacementRelationsIndex keeps a grandparent symbol under a rendered grandchild not owned once the parent is removed', () => {
    const index = new TilePlacementRelationsIndex();
    const grandparentBucket = makeBucket(1000, 1000);
    const grandparent = makeTile(0, 0, 0, 0, 0, grandparentBucket);
    const grandchild = makeTile(2, 0, 2, 0, 0);
    index.sync([grandparent, makeTile(1, 0, 1, 0, 0), grandchild]);

    index.sync([grandparent, grandchild]);
    expect(grandparentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));
});

test('TilePlacementRelationsIndex keeps a symbol owned under a tile of a different world copy', () => {
    const index = new TilePlacementRelationsIndex();
    const wrap0Bucket = makeBucket(1000, 1000);
    index.sync([makeTile(0, 0, 0, 0, 0, wrap0Bucket), makeTile(1, 1, 1, 0, 0)]);
    expect(wrap0Bucket.nonOwnedSymbols).toEqual(new Uint8Array([0]));
});

test('TilePlacementRelationsIndex lets the more overscaled copy of a canonical tile own its area', () => {
    const index = new TilePlacementRelationsIndex();
    const lessOverscaledBucket = makeBucket(1000, 1000);
    const moreOverscaledBucket = makeBucket(1000, 1000);
    index.sync([makeTile(5, 0, 3, 1, 1, lessOverscaledBucket), makeTile(6, 0, 3, 1, 1, moreOverscaledBucket)]);
    expect(lessOverscaledBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));
    expect(moreOverscaledBucket.nonOwnedSymbols).toEqual(new Uint8Array([0]));
});

test('TilePlacementRelationsIndex marks a parent symbol under an added child as not owned', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([0]));

    index.sync([parent, makeTile(1, 0, 1, 0, 0)]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));
});

test('TilePlacementRelationsIndex keeps a parent symbol outside its rendered children owned', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent, makeTile(1, 0, 1, 1, 1)]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([0]));
});

test('TilePlacementRelationsIndex marks a parent symbol as owned again once the child is removed', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent, makeTile(1, 0, 1, 0, 0)]);

    index.sync([parent]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([0]));
});

test('TilePlacementRelationsIndex marks the symbol of a parent added above a rendered child as not owned (zoom-out)', () => {
    const index = new TilePlacementRelationsIndex();
    const child = makeTile(1, 0, 1, 0, 0);
    index.sync([child]);

    const parentBucket = makeBucket(1000, 1000);
    index.sync([child, makeTile(0, 0, 0, 0, 0, parentBucket)]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));
});

test('TilePlacementRelationsIndex marks the new bucket of a relaid out parent as not owned', () => {
    const index = new TilePlacementRelationsIndex();
    const parent = makeTile(0, 0, 0, 0, 0, makeBucket(1000, 1000));
    const child = makeTile(1, 0, 1, 0, 0);
    index.sync([parent, child]);

    const newBucket = makeBucket(1000, 1000);
    parent.buckets = {[newBucket.layerIds[0]]: newBucket};
    index.sync([parent, child]);
    expect(newBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));
});

test('TilePlacementRelationsIndex continues a parent symbol\'s state in an added child tile', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    makeVisible(parentBucket, 42);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent]);

    // Same label at the same world position, laid out in the child tile at twice the scale
    const childBucket = makeBucket(2000, 2000);
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBucket)]);
    expect(childBucket.placementVariantVisible).toEqual([true]);
    expect(childBucket.placementFadeRefTime[0]).toEqual(42);
    expect(childBucket.hasActiveFade()).toBe(true);
});

test('TilePlacementRelationsIndex continues a parent symbol\'s state directly in an added grandchild', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    makeVisible(parentBucket, 42);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent]);

    const grandchildBucket = makeBucket(4000, 4000);
    index.sync([parent, makeTile(1, 0, 1, 0, 0, makeBucket(2000, 2000)), makeTile(2, 0, 2, 0, 0, grandchildBucket)]);
    expect(grandchildBucket.placementVariantVisible).toEqual([true]);
    expect(grandchildBucket.placementFadeRefTime[0]).toEqual(42);
});

test('TilePlacementRelationsIndex leaves the copy of a child added together with a grandchild hidden', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    makeVisible(parentBucket, 42);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent]);

    const childBucket = makeBucket(2000, 2000);
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBucket), makeTile(2, 0, 2, 0, 0, makeBucket(4000, 4000))]);
    expect(childBucket.placementVariantVisible).toEqual([false]);
});

test('TilePlacementRelationsIndex hides the parent copy at once when an added child takes over its label', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    makeVisible(parentBucket, 42);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent]);

    index.sync([parent, makeTile(1, 0, 1, 0, 0, makeBucket(2000, 2000))]);
    expect(parentBucket.placementVariantVisible).toEqual([false]);
    expect(parentBucket.hasActiveFade()).toBe(false);
});

test('TilePlacementRelationsIndex does not continue the state of a different label', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000, 'abcde');
    makeVisible(parentBucket, 42);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent]);

    const childBucket = makeBucket(2000, 2000, 'edcba');
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBucket)]);
    expect(childBucket.placementVariantVisible).toEqual([false]);
});

test('TilePlacementRelationsIndex leaves a symbol under a rendered child hidden until the child stops rendering', () => {
    const index = new TilePlacementRelationsIndex();
    const grandparentBucket = makeBucket(500, 500);
    makeVisible(grandparentBucket, 3);
    const grandparent = makeTile(0, 0, 0, 0, 0, grandparentBucket);
    const childBucket = makeBucket(2000, 2000);
    const child = makeTile(2, 0, 2, 0, 0, childBucket);
    index.sync([grandparent, child]);
    // Placement has since moved on: the child's copy restarted its fade
    makeVisible(childBucket, 7);

    // Zoom-out: the child still owns the area, so the new parent's copy must not show as well
    const parentBucket = makeBucket(1000, 1000);
    const parent = makeTile(1, 0, 1, 0, 0, parentBucket);
    index.sync([grandparent, child, parent]);
    expect(parentBucket.placementVariantVisible).toEqual([false]);

    index.sync([grandparent, parent]);
    expect(parentBucket.placementVariantVisible).toEqual([true]);
    expect(parentBucket.placementFadeRefTime[0]).toEqual(7);
});

test('TilePlacementRelationsIndex continues a removed child symbol\'s state in its rendered ancestor', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    const childBucket = makeBucket(2000, 2000);
    makeVisible(childBucket, 13);
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBucket)]);

    index.sync([parent]);
    expect(parentBucket.placementVariantVisible).toEqual([true]);
    expect(parentBucket.placementFadeRefTime[0]).toEqual(13);
});

test('TilePlacementRelationsIndex does not continue a parent symbol\'s state in a child of another world copy', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    makeVisible(parentBucket, 42);
    const parent = makeTile(0, 1, 0, 0, 0, parentBucket);
    index.sync([parent]);

    const childBucket = makeBucket(2000, 2000);
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBucket)]);
    expect(childBucket.placementVariantVisible).toEqual([false]);
});

test('TilePlacementRelationsIndex does not continue a removed child symbol\'s state in a parent of another world copy', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    const childBucket = makeBucket(2000, 2000);
    makeVisible(childBucket, 13);
    index.sync([parent, makeTile(1, 1, 1, 0, 0, childBucket)]);

    index.sync([parent]);
    expect(parentBucket.placementVariantVisible).toEqual([false]);
});

test('TilePlacementRelationsIndex continues a parent symbol\'s state in a child added after a wrap jump', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    makeVisible(parentBucket, 42);
    const parent = makeTile(0, 1, 0, 0, 0, parentBucket);
    index.sync([parent]);

    // A wrap jump renumbers every tile of the source: the child is in the parent's world copy
    parent.tileID = parent.tileID.unwrapTo(0);
    const childBucket = makeBucket(2000, 2000);
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBucket)]);
    expect(childBucket.placementFadeRefTime[0]).toEqual(42);
});

test('TilePlacementRelationsIndex continues a tile\'s own symbol state across a relayout', () => {
    const index = new TilePlacementRelationsIndex();
    const oldBucket = makeBucket(1000, 1000);
    makeVisible(oldBucket, 99);
    const tile = makeTile(0, 0, 0, 0, 0, oldBucket);
    index.sync([tile]);

    const newBucket = makeBucket(1000, 1000);
    tile.buckets = {[newBucket.layerIds[0]]: newBucket};
    index.sync([tile]);
    expect(newBucket.placementVariantVisible).toEqual([true]);
    expect(newBucket.placementFadeRefTime[0]).toEqual(99);
});

test('TilePlacementRelationsIndex leaves state untouched when the rendered set is unchanged', () => {
    const index = new TilePlacementRelationsIndex();
    const parent = makeTile(0, 0, 0, 0, 0, makeBucket(1000, 1000));
    const childBucket = makeBucket(2000, 2000);
    const child = makeTile(1, 0, 1, 0, 0, childBucket);
    index.sync([parent, child]);

    const parentBucket = parent.buckets[childBucket.layerIds[0]];
    makeVisible(parentBucket, 5);
    index.sync([parent, child]);
    expect(childBucket.placementVariantVisible).toEqual([false]);
});

test('TilePlacementRelationsIndex continues a held child symbol\'s state in its rendered ancestor (zoom-out)', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    const childBucket = makeBucket(2000, 2000);
    makeVisible(childBucket, 13);
    const child = makeTile(1, 0, 1, 0, 0, childBucket);
    index.sync([parent, child]);

    holdForFade(child);
    index.sync([parent, child]);
    expect(parentBucket.placementVariantVisible).toEqual([true]);
    expect(parentBucket.placementFadeRefTime[0]).toEqual(13);
});

test('TilePlacementRelationsIndex marks a parent symbol under a held child as owned', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    const child = makeTile(1, 0, 1, 0, 0, makeBucket(2000, 2000));
    index.sync([parent, child]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1]));

    holdForFade(child);
    index.sync([parent, child]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([0]));
});

test('TilePlacementRelationsIndex leaves the state of a held tile\'s symbol missing from its ancestor in the held tile', () => {
    const index = new TilePlacementRelationsIndex();
    const parent = makeTile(0, 0, 0, 0, 0, makeBucket(1000, 1000, 'abcde'));
    const childBucket = makeBucket(2000, 2000, 'edcba');
    makeVisible(childBucket, 13);
    const child = makeTile(1, 0, 1, 0, 0, childBucket);
    index.sync([parent, child]);

    holdForFade(child);
    index.sync([parent, child]);
    expect(childBucket.placementVariantVisible).toEqual([true]);
});

test('TilePlacementRelationsIndex continues a held parent symbol\'s state in a child that gets it in a relayout (zoom-in)', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000, 'abcde');
    makeVisible(parentBucket, 21);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    const child = makeTile(1, 0, 1, 0, 0, makeBucket(2000, 2000, 'edcba'));
    holdForFade(parent);
    index.sync([parent, child]);

    const newBucket = makeBucket(2000, 2000, 'abcde');
    child.buckets = {[newBucket.layerIds[0]]: newBucket};
    index.sync([parent, child]);
    expect(newBucket.placementVariantVisible).toEqual([true]);
    expect(newBucket.placementFadeRefTime[0]).toEqual(21);
});

test('TilePlacementRelationsIndex continues a held child symbol\'s state in a parent added after the hold (zoom-out)', () => {
    const index = new TilePlacementRelationsIndex();
    const childBucket = makeBucket(2000, 2000);
    makeVisible(childBucket, 13);
    const child = makeTile(1, 0, 1, 0, 0, childBucket);
    index.sync([child]);
    holdForFade(child);
    index.sync([child]);

    const parentBucket = makeBucket(1000, 1000);
    index.sync([child, makeTile(0, 0, 0, 0, 0, parentBucket)]);
    expect(parentBucket.placementVariantVisible).toEqual([true]);
    expect(parentBucket.placementFadeRefTime[0]).toEqual(13);
    expect(childBucket.placementVariantVisible).toEqual([false]);
});

test('TilePlacementRelationsIndex keeps a held tile\'s own symbol state when it is retained again', () => {
    const index = new TilePlacementRelationsIndex();
    const childBucket = makeBucket(2000, 2000);
    makeVisible(childBucket, 13);
    const child = makeTile(1, 0, 1, 0, 0, childBucket);
    holdForFade(child);
    index.sync([child]);

    child.holdingForFade = () => false;
    index.sync([child]);
    expect(childBucket.placementVariantVisible).toEqual([true]);
    expect(childBucket.placementFadeRefTime[0]).toEqual(13);
});

test('TilePlacementRelationsIndex continues the owner\'s state in a held tile retained again', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    const childBucket = makeBucket(2000, 2000);
    const child = makeTile(1, 0, 1, 0, 0, childBucket);
    holdForFade(child);
    index.sync([parent, child]);
    makeVisible(parentBucket, 34);

    child.holdingForFade = () => false;
    index.sync([parent, child]);
    expect(childBucket.placementVariantVisible).toEqual([true]);
    expect(childBucket.placementFadeRefTime[0]).toEqual(34);
});

test('TilePlacementRelationsIndex does not continue a parent symbol\'s state in a child symbol outside its cell', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucket(1000, 1000);
    makeVisible(parentBucket, 42);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent]);

    // The parent's cell 1000 covers the child's cells 2000 and 2001 only
    const childBucket = makeBucket(2002, 2000);
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBucket)]);
    expect(childBucket.placementVariantVisible).toEqual([false]);
});

test('TilePlacementRelationsIndex continues the state of each of two same label parent symbols in the same cell once', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucketAt([[1000, 1000], [1000, 1000]]);
    makeVisible(parentBucket, 42, 0);
    makeVisible(parentBucket, 7, 1);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent]);

    const childBucket = makeBucketAt([[2000, 2000], [2001, 2001]]);
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBucket)]);
    expect(Array.from(childBucket.placementFadeRefTime)).toEqual([42, 7]);
});

test('TilePlacementRelationsIndex continues the state of each of two same label child symbols in its parent once', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucketAt([[1000, 1000], [1000, 1000]]);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    const childBucket = makeBucketAt([[2000, 2000], [2001, 2001]]);
    makeVisible(childBucket, 13, 0);
    makeVisible(childBucket, 5, 1);
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBucket)]);

    index.sync([parent]);
    expect(Array.from(parentBucket.placementFadeRefTime)).toEqual([13, 5]);
});

test('TilePlacementRelationsIndex continues the parent symbols\' state in the loaded children of a parent kept for a missing child', () => {
    const index = new TilePlacementRelationsIndex();
    // One label per quadrant: NW, NE, SW and SE
    const parentBucket = makeBucketAt([[1000, 1000], [5096, 1000], [1000, 5096], [5096, 5096]]);
    for (let i = 0; i < 4; i++) makeVisible(parentBucket, 10 + i, i);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    index.sync([parent]);

    // 1/1/1 is missing, so the parent stays rendered for the SE quadrant
    const childBuckets = [makeBucket(2000, 2000), makeBucket(2000, 2000), makeBucket(2000, 2000)];
    index.sync([parent, makeTile(1, 0, 1, 0, 0, childBuckets[0]), makeTile(1, 0, 1, 1, 0, childBuckets[1]), makeTile(1, 0, 1, 0, 1, childBuckets[2])]);
    expect(childBuckets.map((bucket) => bucket.placementVariantVisible[0])).toEqual([true, true, true]);
    expect(childBuckets.map((bucket) => bucket.placementFadeRefTime[0])).toEqual([10, 11, 12]);
    expect(parentBucket.placementVariantVisible).toEqual([false, false, false, true]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1, 1, 1, 0]));
});

test('TilePlacementRelationsIndex continues the child symbols\' state in the grandchildren of a grandparent kept for a missing child and grandchild', () => {
    const index = new TilePlacementRelationsIndex();
    const parentBucket = makeBucketAt([[1000, 1000], [5096, 1000], [1000, 5096], [5096, 5096]]);
    makeVisible(parentBucket, 13, 3);
    const parent = makeTile(0, 0, 0, 0, 0, parentBucket);
    const childBuckets = [makeBucket(2000, 2000), makeBucket(2000, 2000), makeBucket(2000, 2000)];
    childBuckets.forEach((bucket, i) => makeVisible(bucket, 10 + i));
    const children = [makeTile(1, 0, 1, 0, 0, childBuckets[0]), makeTile(1, 0, 1, 1, 0, childBuckets[1]), makeTile(1, 0, 1, 0, 1, childBuckets[2])];
    index.sync([parent, ...children]);

    // Zoom-in: the children are held for fading, and with 1/1/1 and 2/2/2 missing the parent stays
    // rendered for the SE quadrant
    for (const child of children) holdForFade(child);
    const grandchildBuckets = [makeBucket(4000, 4000), makeBucket(4000, 4000), makeBucket(4000, 4000)];
    const grandchildren = [makeTile(2, 0, 2, 0, 0, grandchildBuckets[0]), makeTile(2, 0, 2, 2, 0, grandchildBuckets[1]), makeTile(2, 0, 2, 0, 2, grandchildBuckets[2])];
    index.sync([parent, ...children, ...grandchildren]);
    expect(grandchildBuckets.map((bucket) => bucket.placementVariantVisible[0])).toEqual([true, true, true]);
    expect(grandchildBuckets.map((bucket) => bucket.placementFadeRefTime[0])).toEqual([10, 11, 12]);
    expect(parentBucket.placementVariantVisible).toEqual([false, false, false, true]);
    expect(parentBucket.nonOwnedSymbols).toEqual(new Uint8Array([1, 1, 1, 0]));
});

test('TilePlacementRelationsIndex continues a rendered grandparent symbol\'s fade-out in a grandchild when the child between lacks the label', () => {
    const index = new TilePlacementRelationsIndex();
    const grandparentBucket = makeBucket(1000, 1000);
    makeVisible(grandparentBucket, 7);
    const grandparent = makeTile(0, 0, 0, 0, 0, grandparentBucket);
    index.sync([grandparent]);

    // The child doesn't have the label, so placement fades out the grandparent's copy
    const child = makeTile(1, 0, 1, 0, 0);
    index.sync([grandparent, child]);
    makeFadingOut(grandparentBucket, 42);
    const refTime = grandparentBucket.placementFadeRefTime[0];

    const grandchildBucket = makeBucket(4000, 4000);
    index.sync([grandparent, child, makeTile(2, 0, 2, 0, 0, grandchildBucket)]);
    expect(grandchildBucket.placementFadeRefTime[0]).toEqual(refTime);
    expect(grandchildBucket.hasActiveFade()).toBe(true);
    expect(grandparentBucket.hasActiveFade()).toBe(false);
});

test('TilePlacementRelationsIndex continues a held grandchild symbol\'s state rather than a rendered grandparent\'s hidden copy in a child that gets it in a relayout', () => {
    const index = new TilePlacementRelationsIndex();
    const grandparent = makeTile(0, 0, 0, 0, 0, makeBucket(1000, 1000));
    const child = makeTile(1, 0, 1, 0, 0);
    const grandchildBucket = makeBucket(4000, 4000);
    makeVisible(grandchildBucket, 13);
    const grandchild = makeTile(2, 0, 2, 0, 0, grandchildBucket);
    index.sync([grandparent, child, grandchild]);

    // Zoom-out: the grandchild is held, and placement fades out its copy
    holdForFade(grandchild);
    index.sync([grandparent, child, grandchild]);
    makeFadingOut(grandchildBucket, 21);
    const refTime = grandchildBucket.placementFadeRefTime[0];

    const newBucket = makeBucket(2000, 2000);
    child.buckets = {[newBucket.layerIds[0]]: newBucket};
    index.sync([grandparent, child, grandchild]);
    expect(newBucket.placementFadeRefTime[0]).toEqual(refTime);
    expect(newBucket.hasActiveFade()).toBe(true);
    expect(grandchildBucket.hasActiveFade()).toBe(false);
});
