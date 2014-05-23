'use strict';

// var Loader = require('./loader.js');

module.exports = {
    shape: shape
};

// var stacks = Loader.stacks;

function shape(text, name, rects) {
    // var glyphs = stacks[name].glyphs;
    var glyphs = rects[name];
    var glyph;

    var shaping = [];

    var x = 0;
    var y = 0;
    var id;

    for (var i = 0; i < text.length; i++) {
        id = text.charCodeAt(i);
        glyph = glyphs[id];

        if (id === 0 || !glyph) continue;

        shaping.push({
            fontstack: name,
            glyph: id,
            x: x,
            y: y
        });

        // x += glyphs[id].advance;
        x += glyph.w;
    }

    return shaping;
}
