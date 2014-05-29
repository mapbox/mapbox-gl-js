'use strict';

module.exports = {
    shape: shape
};

function shape(text, name, stacks, maxWidth, lineHeight, alignment, spacing) {
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

        x += glyph.advance + spacing;
    }

    shaping = linewrap(shaping, glyphs, lineHeight, maxWidth, alignment);

    return shaping;
}

var breakable = { 32: true }; // Currently only breaks at regular spaces

function linewrap(shaping, glyphs, lineHeight, maxWidth, alignment) {
    var lastSafeBreak = null;

    var lengthBeforeCurrentLine = 0;
    var lineStartIndex = 0;
    var line = 0;

    for (var i = 0; i < shaping.length; i++) {
        var shape = shaping[i];

        shape.x -= lengthBeforeCurrentLine;
        shape.y += lineHeight * line;

        if (shape.x > maxWidth && lastSafeBreak !== null) {

            var lineLength = shaping[lastSafeBreak + 1].x;

            for (var k = lastSafeBreak + 1; k <= i; k++) {
                shaping[k].y += lineHeight;
                shaping[k].x -= lineLength;
            }

            if (alignment) {
                horizontalAlign(shaping, glyphs, lineStartIndex, lastSafeBreak - 1, alignment);
            }

            lineStartIndex = lastSafeBreak + 1;
            lastSafeBreak = null;
            lengthBeforeCurrentLine += lineLength;
            line++;
        }

        if (breakable[shape.glyph]) {
            lastSafeBreak = i;
        }
    }

    horizontalAlign(shaping, glyphs, lineStartIndex, shaping.length - 1, alignment);
    return shaping;
}

function horizontalAlign(shaping, glyphs, start, end, alignment) {
    var lastAdvance = glyphs[shaping[end].glyph].advance;
    var lineIndent = (shaping[end].x + lastAdvance) * alignment;

    for (var j = start; j <= end; j++) {
        shaping[j].x -= lineIndent;
    }

}
