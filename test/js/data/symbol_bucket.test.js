'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const Protobuf = require('pbf');
const VectorTile = require('vector-tile').VectorTile;
const SymbolBucket = require('../../../js/data/bucket/symbol_bucket');
const Collision = require('../../../js/symbol/collision_tile');
const CollisionBoxArray = require('../../../js/symbol/collision_box');
const SymbolInstancesArray = require('../../../js/symbol/symbol_instances');
const SymbolQuadsArray = require('../../../js/symbol/symbol_quads');
const GlyphAtlas = require('../../../js/symbol/glyph_atlas');
const StyleLayer = require('../../../js/style/style_layer');
const util = require('../../../js/util/util');
const featureFilter = require('feature-filter');

// Load a point feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.place_label.feature(10);
const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

/*eslint new-cap: 0*/
const collisionBoxArray = new CollisionBoxArray();
const symbolQuadsArray = new SymbolQuadsArray();
const symbolInstancesArray = new SymbolInstancesArray();
const collision = new Collision(0, 0, collisionBoxArray);
const atlas = new GlyphAtlas();
for (const id in glyphs) {
    glyphs[id].bitmap = true;
    glyphs[id].rect = atlas.addGlyph(id, 'Test', glyphs[id], 3);
}

const stacks = { 'Test': glyphs };

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
        symbolInstancesArray: symbolInstancesArray,
        symbolQuadsArray: symbolQuadsArray,
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
    bucketA.prepare(stacks, {});
    bucketA.place(collision);

    const b = collision.grid.keys.length;
    t.notEqual(a, b, 'places feature');

    // add same feature from bucket B
    const a2 = collision.grid.keys.length;
    bucketB.populate([feature], options);
    bucketB.prepare(stacks, {});
    bucketB.place(collision);
    const b2 = collision.grid.keys.length;
    t.equal(a2, b2, 'detects collision and does not place feature');
    t.end();
});


test('SymbolBucket integer overflow', (t) => {
    t.stub(util, 'warnOnce');
    t.stub(SymbolBucket, 'MAX_QUADS', 5);

    const bucket = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([feature], options);
    bucket.prepare(stacks, {});
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
    bucket.prepare(stacks, {});
    bucket.place(collision);
    bucket.place(collision);

    t.end();
});
