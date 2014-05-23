'use strict';

var Loader = require('./loader.js');

module.exports = {
    shape: shape
};

var stacks = Loader.stacks;

function shape(text, name) {
    var glyphs = stacks[name].glyphs;
    var shaping = [];

    var x = 0;
    var y = 0;
    var id;

    for (var i = 0; i < text.length; i++) {
        id = text.charCodeAt(i);

        if (id === 0) continue;

        shaping.push({
            fontstack: name,
            glyph: id,
            x: x,
            y: y
        });

        x += glyphs[id].advance;
    }

    return shaping;
}
