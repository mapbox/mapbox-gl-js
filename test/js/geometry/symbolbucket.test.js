'use strict';

var test = require('tape').test;

var fs = require('fs');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var SymbolBucket = require('../../../js/geometry/symbolbucket.js');
var GlyphVertexBuffer = require('../../../js/geometry/glyphvertexbuffer.js');
var IconVertexBuffer = require('../../../js/geometry/iconvertexbuffer.js');
var Collision = require('../../../js/text/collision.js');
var GlyphAtlas = require('../../../js/text/glyphatlas');
var RenderProperties = require('../../../js/style/renderproperties.js');

// Load a point feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(__dirname + '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
var feature = vt.layers.place_label.feature(10);
var glyphs = JSON.parse(fs.readFileSync(__dirname + '/../../fixtures/fontstack-glyphs.json'));

test('SymbolBucket', function(t) {
    var info = new RenderProperties.symbol({ type: 'symbol', 'text-font': 'Test' });
    var buffers = {
        glyphVertex: new GlyphVertexBuffer(),
        iconVertex: new IconVertexBuffer()
    };
    var collision = new Collision(6, 4096, 512);
    var bucket = new SymbolBucket(info, buffers, collision);
    t.ok(bucket);
    bucket.textFeatures = ['abcde'];

    var atlas = new GlyphAtlas(1024,1024);
    var rects = {};
    for (var id in glyphs) {
        glyphs[id].bitmap = true;
        rects[id] = atlas.addGlyph(id, 'Test', glyphs[id], 3);
    }
    bucket.stacks = { 'Test': {
        glyphs: glyphs,
        rects: rects
    }};

    var a = JSON.stringify(collision);
    bucket.features = [feature];
    t.equal(bucket.addFeatures(), undefined);
    var b = JSON.stringify(collision);

    t.notEqual(a, b, 'places feature');

    a = JSON.stringify(collision);
    // try adding again
    t.equal(bucket.addFeatures(), undefined);
    b = JSON.stringify(collision);

    t.equal(a, b, 'detects collision and does not place feature');

    t.end();
});

