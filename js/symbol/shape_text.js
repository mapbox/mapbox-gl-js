'use strict';

var invisible = {
    0x20:   true, // space
    0x200b: true  // zero-width space
};

var breakable = {
    0x0020: true, // space
    0x0022: true, // quotation mark
    0x0024: true, // dollar sign
    0x0026: true, // ampersand
    0x0028: true, // left parenthesis
    0x002b: true, // plus sign
    0x002d: true, // hyphen-minus
    0x002f: true, // solidus
    0x00a3: true, // pound sign
    0x00a5: true, // yen sign
    0x00ad: true, // soft hyphen
    0x00b7: true, // middle dot
    0x200b: true, // zero-width space
    0x2010: true, // hyphen
    0x2013: true, // en dash
    0x2018: true, // left single quotation mark
    0x3002: true, // ideographic full stop
    0x3008: true, // left angle bracket
    0x300a: true, // left double angle bracket
    0x300c: true, // left corner bracket
    0x300e: true, // left white corner bracket
    0x3010: true, // left black lenticular bracket
    0x3014: true, // left tortoise shell bracket
    0x3016: true, // left white lenticular bracket
    0x301d: true, // reversed double prime quotation mark
    0x533a: true, // unknown
    0xfe59: true, // small left parenthesis
    0xfe5b: true, // small left curly bracket
    0xff04: true, // fullwidth dollar sign
    0xff08: true, // fullwidth left parenthesis
    0xff0e: true, // fullwidth full stop
    0xff3b: true, // fullwidth left square bracket
    0xff5b: true, // fullwidth left curly bracket
    0xff5e: true, // fullwidth tilde
    0xffe1: true, // fullwidth pound sign
    0xffe5: true  // fullwidth yen sign
};

var newLine = 0x0a;

invisible[newLine] = breakable[newLine] = true;

module.exports = function shapeText(text, glyphs, maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacing, translate, verticalHeight, verticalOrientation) {
    var shapedGlyphs = [];
    var shapedText = {
        shapedGlyphs: shapedGlyphs,
        text: text,
        top: translate[1],
        bottom: translate[1],
        left: translate[0],
        right: translate[0],
    };

    // in the absense of proper vertical advance data, we approximate the y
    // offset with a constant.
    var yOffset = -17;

    // "x" and "y" are relative to the anchor position
    var x = 0;
    var y = yOffset;

    text = text.trim();

    for (var i = 0; i < text.length; i++) {
        var codePoint = text.charCodeAt(i);
        var glyph = glyphs[codePoint];

        if (!glyph && codePoint !== newLine) continue;

        shapedGlyphs.push({codePoint: codePoint, x: x, y: y, glyph: glyph});

        if (verticalOrientation) {
            y += verticalHeight + spacing;
        } else {
            x += glyph.advance + spacing;
        }
    }

    if (!shapedGlyphs.length) return false;
    wrapTextLines(shapedText, glyphs, lineHeight, maxWidth, horizontalAlign, verticalAlign, justify, translate, verticalHeight, verticalOrientation);
    return shapedText;
};

function wrapTextLines(shapedText, glyphs, lineHeight, maxWidth, horizontalAlign, verticalAlign, justify, translate, verticalHeight, verticalOrientation) {
    var lastSafeBreak = null;

    var lengthBeforeCurrentLine = 0;
    var lineStartIndex = 0;
    var line = 0;

    var maxLineLength = 0;

    var shapedGlyphs = shapedText.shapedGlyphs;

    if (maxWidth) {

        var wordLength = shapedGlyphs.length;

        for (var i = 0; i < shapedGlyphs.length; i++) {
            var shapedGlyph = shapedGlyphs[i];

            shapedGlyph.x -= lengthBeforeCurrentLine;
            shapedGlyph.y += lineHeight * line;

            if (shapedGlyph.x > maxWidth && lastSafeBreak !== null) {

                var lineLength = shapedGlyphs[lastSafeBreak + 1].x;
                maxLineLength = Math.max(lineLength, maxLineLength);

                for (var k = lastSafeBreak + 1; k <= i; k++) {
                    shapedGlyphs[k].y += lineHeight;
                    shapedGlyphs[k].x -= lineLength;
                }

                if (justify) {
                    // Collapse invisible characters.
                    var lineEnd = lastSafeBreak;
                    if (invisible[shapedGlyphs[lastSafeBreak].codePoint]) {
                        lineEnd--;
                    }

                    justifyTextLine(shapedGlyphs, glyphs, lineStartIndex, lineEnd, justify);
                }

                lineStartIndex = lastSafeBreak + 1;
                lastSafeBreak = null;
                lengthBeforeCurrentLine += lineLength;
                line++;
            }

            if (shapedGlyphs.length > 13) {
                if (breakable[shapedGlyph.codePoint]) {
                    lastSafeBreak = i - 1;
                }
                if (!(breakable[shapedGlyph.codePoint]) && shapedGlyph.codePoint > 19968) {
                    lastSafeBreak = Math.round(wordLength / 3);
                }
            } else {
                lastSafeBreak = i;
            }
        }
    }

    var lastPositionedGlyph = shapedGlyphs[shapedGlyphs.length - 1];

    // For vertical labels, calculate 'length' along the y axis, and 'height' along the x axis
    var axisPrimary = verticalOrientation ? 'y' : 'x';
    var advance = verticalOrientation ? verticalHeight : glyphs[lastPositionedGlyph.codePoint].advance;
    var leading = verticalOrientation ? (lineHeight - verticalHeight + glyphs[lastPositionedGlyph.codePoint].advance) : lineHeight;

    var lastLineLength = lastPositionedGlyph[axisPrimary] + advance;
    maxLineLength = Math.max(maxLineLength, lastLineLength);

    var height = (line + 1) * leading;

    justifyTextLine(shapedGlyphs, glyphs, lineStartIndex, shapedGlyphs.length - 1, justify);

    // align text?
    var shiftX = (justify - horizontalAlign) * maxLineLength + translate[0];
    var shiftY = (-verticalAlign * (line + 1) + 0.5) * lineHeight + translate[1];
    for (var j = 0; j < shapedGlyphs.length; j++) {
        shapedGlyphs[j].x += shiftX;
        shapedGlyphs[j].y += shiftY;
    }

    // Calculate the bounding box
    shapedText.top += verticalOrientation ? -verticalAlign * maxLineLength : -verticalAlign * height;
    shapedText.bottom = verticalOrientation ? shapedText.top + maxLineLength : shapedText.top + height;
    shapedText.left += verticalOrientation ? -horizontalAlign * height : -horizontalAlign * maxLineLength;
    shapedText.right = verticalOrientation ? shapedText.left + height : shapedText.left + maxLineLength;
}

function justifyTextLine(shapedGlyphs, glyphs, start, end, justify) {
    var lastAdvance = glyphs[shapedGlyphs[end].codePoint].advance;
    var lineIndent = (shapedGlyphs[end].x + lastAdvance) * justify;

    for (var j = start; j <= end; j++) {
        shapedGlyphs[j].x -= lineIndent;
    }

}
