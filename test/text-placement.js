'use strict';
var test = require('tape').test;
var Geometry = require('../js/geometry/geometry.js');
var Placement = require('../js/text/placement.js');
var Shaping = require('../js/text/shaping.js');
var GlyphAtlas = require('../js/text/glyphatlas');
var fs = require('fs');
var glyphs = JSON.parse(fs.readFileSync(__dirname + '/fixtures/fontstack-glyphs.json'));

test('Placement', function(t) {
    var geometry = new Geometry();
    var placement = new Placement(geometry, 12, 512);
    t.ok(placement);

    var atlas = new GlyphAtlas(1024,1024);
    var rects = {};
    for (var id in glyphs) {
        glyphs[id].bitmap = true;
        rects[id] = atlas.addGlyph(id, 'Test', glyphs[id], 3);
    }

    var stacks = { 'Test': {
        glyphs: glyphs,
        rects: rects
    }};
    var shaping = (function() {
        var oneEm = 24;
        var name = 'Test';
        return Shaping.shape('abcde', name, stacks, 15 * oneEm, oneEm, 0.5, 0 * oneEm);
    })();

    var a, b;

    // text-max-size is required here and is not defaulted.
    // Without it collision detection fails.
    a = JSON.stringify(placement.collision);
    placement.addFeature([{x:2048,y:2048}], { 'text-max-size':12 }, stacks, shaping);
    b = JSON.stringify(placement.collision);

    t.notEqual(a, b, 'places feature');

    a = JSON.stringify(placement.collision);
    placement.addFeature([{x:2048,y:2048}], { 'text-max-size':12 }, stacks, shaping);
    b = JSON.stringify(placement.collision);

    t.equal(a, b, 'detects collision and does not place feature');

    t.end();
});
