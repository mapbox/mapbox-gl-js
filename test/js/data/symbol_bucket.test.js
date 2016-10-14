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

// Load a point feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.place_label.feature(10);
const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

/*eslint new-cap: 0*/
const buffers = {};
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
        layout: { 'text-font': ['Test'] }
    });

    const bucket = new SymbolBucket({
        buffers: buffers,
        overscaling: 1,
        zoom: 0,
        collisionBoxArray: collisionBoxArray,
        symbolInstancesArray: symbolInstancesArray,
        symbolQuadsArray: symbolQuadsArray,
        layer: layer,
        childLayers: [layer],
        tileExtent: 4096
    });
    bucket.createArrays();
    bucket.textFeatures = ['abcde'];
    bucket.features = [feature];
    return bucket;
}


test('SymbolBucket', function(t) {
    const bucketA = bucketSetup();
    const bucketB = bucketSetup();

    // add feature from bucket A
    const a = collision.grid.keys.length;
    t.equal(bucketA.populateArrays(collision, stacks), undefined);
    const b = collision.grid.keys.length;
    t.notEqual(a, b, 'places feature');

    // add same feature from bucket B
    const a2 = collision.grid.keys.length;
    t.equal(bucketB.populateArrays(collision, stacks), undefined);
    const b2 = collision.grid.keys.length;
    t.equal(a2, b2, 'detects collision and does not place feature');
    t.end();
});


test('SymbolBucket integer overflow', function(t) {
    const bucket = bucketSetup();
    let numWarnings = 0;
    t.stub(util, 'warnOnce', function(warning) {
        if (warning.includes('Too many symbols being rendered in a tile.') || warning.includes('Too many glyphs being rendered in a tile.')) numWarnings++;
    });
    // save correct value of MAX_QUADS
    const maxquads = SymbolBucket.MAX_QUADS;

    // reduce MAX_QUADS to test warning
    SymbolBucket.MAX_QUADS = 5;
    bucket.populateArrays(collision, stacks);
    t.equal(numWarnings, 2);

    // reset MAX_QUADS to its original value
    SymbolBucket.MAX_QUADS = maxquads;
    t.end();
});

