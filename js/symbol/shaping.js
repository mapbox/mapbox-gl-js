'use strict';

module.exports = {
    shape: shape
};

function shape(text, name, stacks, maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacing, translate) {
    var glyphs = stacks[name].glyphs;
    var glyph;

    var shaping = [];

    var x = translate[0];
    var y = translate[1];
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

    if (!shaping.length) return false;

    shaping = linewrap(shaping, glyphs, lineHeight, maxWidth, horizontalAlign, verticalAlign, justify);

    return shaping;
}

var breakable = { 32: true }; // Currently only breaks at regular spaces

function linewrap(shaping, glyphs, lineHeight, maxWidth, horizontalAlign, verticalAlign, justify) {
    var lastSafeBreak = null;

    var lengthBeforeCurrentLine = 0;
    var lineStartIndex = 0;
    var line = 0;

    var maxLineLength = 0;

    if (maxWidth) {
        for (var i = 0; i < shaping.length; i++) {
            var shape = shaping[i];

            shape.x -= lengthBeforeCurrentLine;
            shape.y += lineHeight * line;

            if (shape.x > maxWidth && lastSafeBreak !== null) {

                var lineLength = shaping[lastSafeBreak + 1].x;
                maxLineLength = Math.max(lineLength, maxLineLength);

                for (var k = lastSafeBreak + 1; k <= i; k++) {
                    shaping[k].y += lineHeight;
                    shaping[k].x -= lineLength;
                }

                if (justify) {
                    justifyLine(shaping, glyphs, lineStartIndex, lastSafeBreak - 1, justify);
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
    }

    maxLineLength = maxLineLength || shaping[shaping.length - 1].x;

    justifyLine(shaping, glyphs, lineStartIndex, shaping.length - 1, justify);
    align(shaping, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, line);
    return shaping;
}

function justifyLine(shaping, glyphs, start, end, justify) {
    var lastAdvance = glyphs[shaping[end].glyph].advance;
    var lineIndent = (shaping[end].x + lastAdvance) * justify;

    for (var j = start; j <= end; j++) {
        shaping[j].x -= lineIndent;
    }

}

function align(shaping, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, line) {
    var shiftX = (justify - horizontalAlign) * maxLineLength;
    var shiftY = (-verticalAlign * (line + 1) + 0.5) * lineHeight;

    for (var j = 0; j < shaping.length; j++) {
        shaping[j].x += shiftX;
        shaping[j].y += shiftY;
    }
}
