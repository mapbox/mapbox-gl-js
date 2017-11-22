'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const Protobuf = require('pbf');
const VectorTile = require('@mapbox/vector-tile').VectorTile;
const SymbolBucket = require('../../../src/data/bucket/symbol_bucket');
const CollisionIndex = require('../../../src/symbol/collision_index');
const CollisionBoxArray = require('../../../src/symbol/collision_box');
const SymbolStyleLayer = require('../../../src/style/style_layer/symbol_style_layer');
const util = require('../../../src/util/util');
const featureFilter = require('../../../src/style-spec/feature_filter');
const {performSymbolLayout} = require('../../../src/symbol/symbol_layout');
const {performSymbolPlacement} = require('../../../src/symbol/symbol_placement');
const Transform = require('../../../src/geo/transform');

const mat4 = require('@mapbox/gl-matrix').mat4;

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
const labelPlaneMatrix = mat4.identity(new Float64Array(16));
// This is a bogus projection matrix: all it does is make tile coordinates
// project to somewhere within the viewport, assuming a tile extent of 8192.
mat4.scale(labelPlaneMatrix, labelPlaneMatrix, [1 / 8192, 1 / 8192, 1]);
const collision = new CollisionIndex(transform);
const showCollisionBoxes = false;
const zoom = 0;
const pixelRatio = 1;
const tileID = 0;
const sourceID = "source";

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

    // add feature from bucket A
    const a = collision.grid.keysLength();
    bucketA.populate([{feature}], options);
    performSymbolLayout(bucketA, stacks, {});
    performSymbolPlacement(bucketA, collision, showCollisionBoxes, zoom, pixelRatio, labelPlaneMatrix, labelPlaneMatrix, tileID, sourceID, collisionBoxArray);

    const b = collision.grid.keysLength();
    t.notEqual(a, b, 'places feature');

    // add same feature from bucket B
    const a2 = collision.grid.keysLength();
    bucketB.populate([{feature}], options);
    performSymbolLayout(bucketB, stacks, {});
    performSymbolPlacement(bucketB, collision, showCollisionBoxes, zoom, pixelRatio, labelPlaneMatrix, labelPlaneMatrix, tileID, sourceID, collisionBoxArray);
    const b2 = collision.grid.keysLength();
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

test('SymbolBucket redo placement', (t) => {
    const bucket = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([{feature}], options);
    performSymbolLayout(bucket, stacks, {});
    performSymbolPlacement(bucket, collision, showCollisionBoxes, zoom, pixelRatio, labelPlaneMatrix, labelPlaneMatrix, tileID, sourceID, collisionBoxArray);
    performSymbolPlacement(bucket, collision, showCollisionBoxes, zoom, pixelRatio, labelPlaneMatrix, labelPlaneMatrix, tileID, sourceID, collisionBoxArray);

    t.end();
});
