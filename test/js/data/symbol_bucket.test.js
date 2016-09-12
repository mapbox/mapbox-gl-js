'use strict';

var test = require('tap').test;
var sinon = require('sinon');
var fs = require('fs');
var path = require('path');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var SymbolBucket = require('../../../js/data/bucket/symbol_bucket');
var Collision = require('../../../js/symbol/collision_tile');
var CollisionBoxArray = require('../../../js/symbol/collision_box');
var SymbolInstancesArray = require('../../../js/symbol/symbol_instances');
var SymbolQuadsArray = require('../../../js/symbol/symbol_quads');
var GlyphAtlas = require('../../../js/symbol/glyph_atlas');
var StyleLayer = require('../../../js/style/style_layer');
var util = require('../../../js/util/util');

// Load a point feature from fixture tile.
var vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
var feature = vt.layers.place_label.feature(10);
var glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

/*eslint new-cap: 0*/
var buffers = {};
var collisionBoxArray = new CollisionBoxArray();
var symbolQuadsArray = new SymbolQuadsArray();
var symbolInstancesArray = new SymbolInstancesArray();
var collision = new Collision(0, 0, collisionBoxArray);
var atlas = new GlyphAtlas();
for (var id in glyphs) {
    glyphs[id].bitmap = true;
    glyphs[id].rect = atlas.addGlyph(id, 'Test', glyphs[id], 3);
}

var stacks = { 'Test': glyphs };

function bucketSetup() {
    var layer = new StyleLayer({
        id: 'test',
        type: 'symbol',
        layout: { 'text-font': ['Test'] }
    });

    var bucket = new SymbolBucket({
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
    var bucketA = bucketSetup();
    var bucketB = bucketSetup();

    // add feature from bucket A
    var a = collision.grid.keys.length;
    t.equal(bucketA.populateArrays(collision, stacks), undefined);
    var b = collision.grid.keys.length;
    t.notEqual(a, b, 'places feature');

    // add same feature from bucket B
    var a2 = collision.grid.keys.length;
    t.equal(bucketB.populateArrays(collision, stacks), undefined);
    var b2 = collision.grid.keys.length;
    t.equal(a2, b2, 'detects collision and does not place feature');
    t.end();
});


test('SymbolBucket integer overflow', function(t) {
    var bucket = bucketSetup();
    var numWarnings = 0;
    sinon.stub(util, 'warnOnce', function(warning) {
        if (warning.includes('Too many symbols being rendered in a tile.') || warning.includes('Too many glyphs being rendered in a tile.')) numWarnings++;
    });
    // save correct value of MAX_QUADS
    var maxquads = SymbolBucket.MAX_QUADS;

    // reduce MAX_QUADS to test warning
    SymbolBucket.MAX_QUADS = 5;
    bucket.populateArrays(collision, stacks);
    t.equal(numWarnings, 2);

    // reset MAX_QUADS to its original value
    SymbolBucket.MAX_QUADS = maxquads;
    t.end();
});

