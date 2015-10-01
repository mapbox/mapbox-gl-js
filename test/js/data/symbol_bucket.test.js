'use strict';

var test = require('prova');
var fs = require('fs');
var path = require('path');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var SymbolBucket = require('../../../js/data/symbol_bucket');
var BufferSet = require('../../../js/data/buffer_set');
var Collision = require('../../../js/symbol/collision_tile');
var GlyphAtlas = require('../../../js/symbol/glyph_atlas');
var LayoutProperties = require('../../../js/style/layout_properties');

// Load a point feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
var feature = vt.layers.place_label.feature(10);
var glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

test('SymbolBucket', function(t) {
    /*eslint new-cap: 0*/
    var info = new LayoutProperties.symbol({ type: 'symbol', 'text-font': ['Test'] });
    var buffers = new BufferSet();
    var collision = new Collision(0, 0);
    var atlas = new GlyphAtlas(1024, 1024);
    for (var id in glyphs) {
        glyphs[id].bitmap = true;
        glyphs[id].rect = atlas.addGlyph(id, 'Test', glyphs[id], 3);
    }

    function bucketSetup() {
        var bucket = new SymbolBucket(buffers, info, 1, 0);
        bucket.textFeatures = ['abcde'];
        bucket.stacks = { 'Test': glyphs };
        bucket.features = [feature];
        t.ok(bucket, 'bucketSetup');
        return bucket;
    }

    var bucketA = bucketSetup();
    var bucketB = bucketSetup();

    // add feature from bucket A
    var a = JSON.stringify(collision);
    t.equal(bucketA.addFeatures(collision), undefined);
    var b = JSON.stringify(collision);
    t.notEqual(a, b, 'places feature');

    // add same feature from bucket B
    a = JSON.stringify(collision);
    t.equal(bucketB.addFeatures(collision), undefined);
    b = JSON.stringify(collision);
    t.equal(a, b, 'detects collision and does not place feature');

    t.end();
});
