'use strict';

var opentype = require('opentype.js');

module.exports = {
    loaded: ready,
    shape: shape
};

var fonturl = '/debug/fonts/ubuntu-font-family-0.80/Ubuntu-C.ttf';

var loaded = false;
var onload = [];
var font;

opentype.load(fonturl, function(err, f) {
    if (err) throw('handle this properly');

    loaded = true;
    font = f;

    for (var i = 0; i < onload.length; i++) {
        self.setImmediate(onload[i]);
    }
});

function ready(callback) {
    if (loaded) return callback();
    else onload.push(callback);
}

function shape(text, faces) {
    var x = 0;
    var y = 0;
    var fontSize = 24;

    var shaping = [];
    var fontScale = fontSize / font.unitsPerEm;

    var family = 'ubuntu'; // TODO unhardcode
    if (faces[family] === undefined) {
        faces[family] = { glyphs: {}, rects: {} };
    }

    font.forEachGlyph(text, x, y, fontSize, undefined, function(glyph, x) {
        if (glyph.id === 0) return;
        faces[family].glyphs[glyph.index] = {
            left: glyph.xMin * fontScale,
            top: glyph.yMin * fontScale, // Ymax?
            width: (glyph.xMax - glyph.xMin) * fontScale,
            height: (glyph.yMax - glyph.yMin) * fontScale,
            advance: glyph.advanceWidth * fontScale
        };
        shaping.push({
            face: family,
            glyph: glyph.index,
            glyph_: glyph,
            x: x,
            y: 0,
        });
    });

    return shaping;
}
