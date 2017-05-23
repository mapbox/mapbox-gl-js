'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const Protobuf = require('pbf');
const VectorTile = require('vector-tile').VectorTile;
const SymbolBucket = require('../../../src/data/bucket/symbol_bucket');
const CollisionTile = require('../../../src/symbol/collision_tile');
const CollisionBoxArray = require('../../../src/symbol/collision_box');
const GlyphAtlas = require('../../../src/symbol/glyph_atlas');
const StyleLayer = require('../../../src/style/style_layer');
const util = require('../../../src/util/util');
const featureFilter = require('../../../src/style-spec/feature_filter');
const AnimationLoop = require('../../../src/style/animation_loop');

// Load a point feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.place_label.feature(10);
const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

/*eslint new-cap: 0*/
const collisionBoxArray = new CollisionBoxArray();
const collision = new CollisionTile(0, 0, 1, 1, { minimum: 1, maximum: 1 }, collisionBoxArray);
const atlas = new GlyphAtlas();
for (const id in glyphs) {
    glyphs[id].bitmap = true;
    glyphs[id].rect = atlas.addGlyph(id, 'Test', glyphs[id], 3);
}

const stacks = { 'Test': glyphs };
const pitchScaling = { minimum: 1, maximum: 1};

function bucketSetup() {
    const layer = new StyleLayer({
        id: 'test',
        type: 'symbol',
        layout: { 'text-font': ['Test'], 'text-field': 'abcde' },
        filter: featureFilter()
    });

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
    const a = collision.grid.keys.length;
    bucketA.populate([feature], options);
    bucketA.prepare(stacks, {}, pitchScaling);
    bucketA.place(collision);

    const b = collision.grid.keys.length;
    t.notEqual(a, b, 'places feature');

    // add same feature from bucket B
    const a2 = collision.grid.keys.length;
    bucketB.populate([feature], options);
    bucketB.prepare(stacks, {}, pitchScaling);
    bucketB.place(collision);
    const b2 = collision.grid.keys.length;
    t.equal(a2, b2, 'detects collision and does not place feature');
    t.end();
});


test('SymbolBucket integer overflow', (t) => {
    t.stub(util, 'warnOnce');
    t.stub(SymbolBucket, 'MAX_INSTANCES', 5);

    const bucket = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([feature], options);
    bucket.prepare(stacks, {}, pitchScaling);
    bucket.place(collision);

    t.ok(util.warnOnce.calledTwice);
    t.ok(util.warnOnce.getCall(0).calledWithMatch(/Too many (symbols|glyphs) being rendered in a tile./));
    t.ok(util.warnOnce.getCall(1).calledWithMatch(/Too many (symbols|glyphs) being rendered in a tile./));
    t.end();
});

test('SymbolBucket redo placement', (t) => {
    const bucket = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([feature], options);
    bucket.prepare(stacks, {}, pitchScaling);
    bucket.place(collision);
    bucket.place(collision);

    t.end();
});


test('SymbolBucket#getPaintPropertyStatistics()', (t) => {
    const layer = new StyleLayer({
        id: 'test',
        type: 'symbol',
        layout: {
            'text-font': ['Test'],
            'text-field': 'abcde',
            'icon-image': 'dot',
            'icon-allow-overlap': true,
            'text-allow-overlap': true
        },
        paint: {
            'text-halo-width': { property: 'scalerank', type: 'identity' },
            'icon-halo-width': { property: 'foo', type: 'identity', default: 5 }
        },
        filter: featureFilter()
    });

    layer.updatePaintTransitions([], {}, { zoom: 5 }, new AnimationLoop(), {});

    const bucket = new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray: collisionBoxArray,
        layers: [layer]
    });
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([feature], options);
    bucket.prepare(stacks, {
        dot: { width: 10, height: 10, pixelRatio: 1, rect: { w: 10, h: 10 } }
    }, pitchScaling);
    bucket.place(collision);

    t.deepEqual(bucket.getPaintPropertyStatistics(), {
        test: {
            'text-halo-width': { max: 4 },
            'icon-halo-width': { max: 5 }
        }
    });

    t.end();
});
