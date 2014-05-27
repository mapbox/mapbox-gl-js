'use strict';

module.exports = {
    shape: shape
};

function shape(text, name, stacks) {
    var glyphs = stacks[name].glyphs;
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

        x += glyph.advance;
    }

    return shaping;
}
