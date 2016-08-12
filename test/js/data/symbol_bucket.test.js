'use strict';

var test = require('tap').test;
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

// Load a point feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
var feature = vt.layers.place_label.feature(10);
var glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

test('SymbolBucket', function(t) {
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

    var bucketA = bucketSetup();
    var bucketB = bucketSetup();
    var bucketC = bucketSetup();

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

    // Use a custom console.warn to count warnings
    var numWarnings = 0;
    var warn = console.warn;
    console.warn = function(warning) {
        if (warning.includes("Too many symbols being rendered in a tile.") || warning.includes("Too many glyphs being rendered in a tile.")) {
            numWarnings++;
        }
    };

    bucketC.MAX_QUADS = 14;
    t.equal(bucketC.populateArrays(collision, stacks), undefined);
    t.equal(numWarnings, 2, 'integer overflow warning is triggered when glyph and/or symbol quad exceeds MAX_QUADS');
    // Put it back
    console.warn = warn;
    t.end();
});
