'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const Protobuf = require('pbf');
const VectorTile = require('@mapbox/vector-tile').VectorTile;
const SymbolBucket = require('../../../src/data/bucket/symbol_bucket');
const {CollisionBoxArray} = require('../../../src/data/array_types');
const SymbolStyleLayer = require('../../../src/style/style_layer/symbol_style_layer');
const util = require('../../../src/util/util');
const featureFilter = require('../../../src/style-spec/feature_filter');
const {performSymbolLayout} = require('../../../src/symbol/symbol_layout');
const Placement = require('../../../src/symbol/placement');
const Transform = require('../../../src/geo/transform');
const {OverscaledTileID} = require('../../../src/source/tile_id');
const Tile = require('../../../src/source/tile');
const CrossTileSymbolIndex = require('../../../src/symbol/cross_tile_symbol_index');

// Load a point feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.place_label.feature(10);
const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

/*eslint new-cap: 0*/
const collisionBoxArray = new CollisionBoxArray();
const transform = new Transform();
transform.width = 100;
transform.height = 100;
transform.cameraToCenterDistance = 100;

const stacks = { 'Test': glyphs };

function bucketSetup() {
    const layer = new SymbolStyleLayer({
        id: 'test',
        type: 'symbol',
        layout: { 'text-font': ['Test'], 'text-field': 'abcde' },
        filter: featureFilter()
    });
    layer.recalculate({zoom: 0, zoomHistory: {}});

    return new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray: collisionBoxArray,
        layers: [layer]
    });
}

test('SymbolBucket', (t) => {
    const bucketA = bucketSetup();
    const bucketB = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};
    const placement = new Placement(transform, 0);
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const crossTileSymbolIndex = new CrossTileSymbolIndex();

    // add feature from bucket A
    bucketA.populate([{feature}], options);
    performSymbolLayout(bucketA, stacks, {});
    const tileA = new Tile(tileID, 512);
    tileA.buckets = { test: bucketA };
    tileA.collisionBoxArray = collisionBoxArray;

    // add same feature from bucket B
    bucketB.populate([{feature}], options);
    performSymbolLayout(bucketB, stacks, {});
    const tileB = new Tile(tileID, 512);
    tileB.buckets = { test: bucketB };
    tileB.collisionBoxArray = collisionBoxArray;

    crossTileSymbolIndex.addLayer(bucketA.layers[0], [tileA, tileB]);

    const a = placement.collisionIndex.grid.keysLength();
    placement.placeLayerTile(bucketA.layers[0], tileA, false, {});
    const b = placement.collisionIndex.grid.keysLength();
    t.notEqual(a, b, 'places feature');

    const a2 = placement.collisionIndex.grid.keysLength();
    placement.placeLayerTile(bucketB.layers[0], tileB, false, {});
    const b2 = placement.collisionIndex.grid.keysLength();
    t.equal(b2, a2, 'detects collision and does not place feature');
    t.end();
});

test('SymbolBucket integer overflow', (t) => {
    t.stub(util, 'warnOnce');
    t.stub(SymbolBucket, 'MAX_GLYPHS').value(5);

    const bucket = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([{feature}], options);
    const fakeGlyph = { rect: { w: 10, h: 10 }, metrics: { left: 10, top: 10, advance: 10 } };
    performSymbolLayout(bucket, stacks, { 'Test': {97: fakeGlyph, 98: fakeGlyph, 99: fakeGlyph, 100: fakeGlyph, 101: fakeGlyph, 102: fakeGlyph} });

    t.ok(util.warnOnce.calledOnce);
    t.ok(util.warnOnce.getCall(0).calledWithMatch(/Too many glyphs being rendered in a tile./));
    t.end();
});
