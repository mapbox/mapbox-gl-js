'use strict';
var Benchmark = require('benchmark');
var suite = new Benchmark.Suite();
var Geometry = require('../js/geometry/geometry.js');
var Placement = require('../js/symbol/placement.js');
var Shaping = require('../js/symbol/shaping.js');
var GlyphAtlas = require('../js/symbol/glyphatlas');
var glyphs = require('../test/fixtures/fontstack-glyphs.json');

var geometry = new Geometry();
var placement = new Placement(geometry, 12, 512);
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


suite.add('symbol/placement', function() {
    var x = Math.floor(Math.random() * 4096);
    var y = Math.floor(Math.random() * 4096);
    placement.addFeature([{x:x,y:y}], { 'text-max-size':12 }, stacks, shaping);
})
.on('cycle', function(event) {
    console.log(String(event.target));
})
.run();
