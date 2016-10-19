'use strict';

module.exports = {
    shapeText: shapeText,
    shapeIcon: shapeIcon
};


// The position of a glyph relative to the text's anchor point.
function PositionedGlyph(codePoint, x, y, glyph) {
    this.codePoint = codePoint;
    this.x = x;
    this.y = y;
    this.glyph = glyph || null;
}

// A collection of positioned glyphs and some metadata
function Shaping(positionedGlyphs, text, top, bottom, left, right) {
    this.positionedGlyphs = positionedGlyphs;
    this.text = text;
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
}

var newLine = 0x0a;
function shapeText(text, glyphs, maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacing, translate, verticalHeight, verticalOrientation) {

    var positionedGlyphs = [];
    var shaping = new Shaping(positionedGlyphs, text, translate[1], translate[1], translate[0], translate[0]);

    // the y offset *should* be part of the font metadata
    var yOffset = -17;

    var x = 0;
    var y = yOffset;

    text = text.trim();

    for (var i = 0; i < text.length; i++) {
        var codePoint = text.charCodeAt(i);
        var glyph = glyphs[codePoint];

        if (!glyph && codePoint !== newLine) continue;

        positionedGlyphs.push(new PositionedGlyph(codePoint, x, y, glyph));
        if (verticalOrientation) {
            y += verticalHeight + spacing;
        } else {
            x += glyph.advance + spacing;
        }
    }

    if (!positionedGlyphs.length) return false;
    linewrap(shaping, glyphs, lineHeight, maxWidth, horizontalAlign, verticalAlign, justify, translate, verticalHeight, verticalOrientation);
    return shaping;
}

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

invisible[newLine] = breakable[newLine] = true;

function linewrap(shaping, glyphs, lineHeight, maxWidth, horizontalAlign, verticalAlign, justify, translate, verticalHeight, verticalOrientation) {
    var lastSafeBreak = null;

    var lengthBeforeCurrentLine = 0;
    var lineStartIndex = 0;
    var line = 0;

    var maxLineLength = 0;

    var positionedGlyphs = shaping.positionedGlyphs;

    if (maxWidth) {

        var wordLength = positionedGlyphs.length;

        // lastSafeBreak = Math.round(wordLength/2);

        for (var i = 0; i < positionedGlyphs.length; i++) {
            var positionedGlyph = positionedGlyphs[i];

            positionedGlyph.x -= lengthBeforeCurrentLine;
            positionedGlyph.y += lineHeight * line;

            if (positionedGlyph.x > maxWidth && lastSafeBreak !== null) {

                var lineLength = positionedGlyphs[lastSafeBreak + 1].x;
                maxLineLength = Math.max(lineLength, maxLineLength);

                for (var k = lastSafeBreak + 1; k <= i; k++) {
                    positionedGlyphs[k].y += lineHeight;
                    positionedGlyphs[k].x -= lineLength;
                }

                if (justify) {
                    // Collapse invisible characters.
                    var lineEnd = lastSafeBreak;
                    if (invisible[positionedGlyphs[lastSafeBreak].codePoint]) {
                        lineEnd--;
                    }

                    justifyLine(positionedGlyphs, glyphs, lineStartIndex, lineEnd, justify);
                }

                lineStartIndex = lastSafeBreak + 1;
                lastSafeBreak = null;
                lengthBeforeCurrentLine += lineLength;
                line++;
            }

            if (positionedGlyphs.length > 13) {
                if (breakable[positionedGlyph.codePoint]) {
                    lastSafeBreak = i - 1;
                }
                if (!(breakable[positionedGlyph.codePoint]) && positionedGlyph.codePoint > 19968) {
                    lastSafeBreak = Math.round(wordLength / 3);
                }
            } else {
                lastSafeBreak = i;
            }
        }
    }

    var lastPositionedGlyph = positionedGlyphs[positionedGlyphs.length - 1];

    // For vertical labels, calculate 'length' along the y axis, and 'height' along the x axis
    var axisPrimary = verticalOrientation ? 'y' : 'x';
    var advance = verticalOrientation ? verticalHeight : glyphs[lastPositionedGlyph.codePoint].advance;
    var leading = verticalOrientation ? (lineHeight - verticalHeight + glyphs[lastPositionedGlyph.codePoint].advance) : lineHeight;

    var lastLineLength = lastPositionedGlyph[axisPrimary] + advance;
    maxLineLength = Math.max(maxLineLength, lastLineLength);

    var height = (line + 1) * leading;

    justifyLine(positionedGlyphs, glyphs, lineStartIndex, positionedGlyphs.length - 1, justify);
    align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, line, translate);

    // Calculate the bounding box
    shaping.top += verticalOrientation ? -verticalAlign * maxLineLength : -verticalAlign * height;
    shaping.bottom = verticalOrientation ? shaping.top + maxLineLength : shaping.top + height;
    shaping.left += verticalOrientation ? -horizontalAlign * height : -horizontalAlign * maxLineLength;
    shaping.right = verticalOrientation ? shaping.left + height : shaping.left + maxLineLength;
}

function linewrap(shaping, glyphs, lineHeight, maxWidth, horizontalAlign, verticalAlign, justify, translate) {
    var lastSafeBreak = null;
    var lengthBeforeCurrentLine = 0;
    var lineStartIndex = 0;
    var line = 0;

    var maxLineLength = 0;

    var positionedGlyphs = shaping.positionedGlyphs;

    if (maxWidth) {

        var wordLength = positionedGlyphs.length;

        for (var i = 0; i < positionedGlyphs.length; i++) {
            var positionedGlyph = positionedGlyphs[i];

            positionedGlyph.x -= lengthBeforeCurrentLine;
            positionedGlyph.y += lineHeight * line;

            if (lastSafeBreak !== null && (positionedGlyph.x > maxWidth ||
                    positionedGlyphs[lastSafeBreak].codePoint === newLine)) {

                var lineLength = positionedGlyphs[lastSafeBreak + 1].x;
                maxLineLength = Math.max(lineLength, maxLineLength);

                for (var k = lastSafeBreak + 1; k <= i; k++) {
                    positionedGlyphs[k].y += lineHeight;
                    positionedGlyphs[k].x -= lineLength;
                }

                if (justify) {
                    // Collapse invisible characters.
                    var lineEnd = lastSafeBreak;
                    if (invisible[positionedGlyphs[lastSafeBreak].codePoint]) {
                        lineEnd--;
                    }

                    justifyLine(positionedGlyphs, glyphs, lineStartIndex, lineEnd, justify);
                }

                lineStartIndex = lastSafeBreak + 1;
                lastSafeBreak = null;
                lengthBeforeCurrentLine += lineLength;
                line++;
            }

            if (wordLength < 15) {
                if (breakable[positionedGlyph.codePoint]) {
                    lastSafeBreak = i - 1;
                }
                if (!(breakable[positionedGlyph.codePoint]) && positionedGlyph.codePoint > 19968) {
                        lastSafeBreak = Math.round(wordLength / 3);
                }
            }
        }
    }

    var lastPositionedGlyph = positionedGlyphs[positionedGlyphs.length - 1];
    var lastLineLength = lastPositionedGlyph.x + glyphs[lastPositionedGlyph.codePoint].advance;
    maxLineLength = Math.max(maxLineLength, lastLineLength);

    var height = (line + 1) * lineHeight;

    justifyLine(positionedGlyphs, glyphs, lineStartIndex, positionedGlyphs.length - 1, justify);
    align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, line, translate);

    // Calculate the bounding box
    shaping.top += -verticalAlign * height;
    shaping.bottom = shaping.top + height;
    shaping.left += -horizontalAlign * maxLineLength;
    shaping.right = shaping.left + maxLineLength;
}

function justifyLine(positionedGlyphs, glyphs, start, end, justify) {
    var lastAdvance = glyphs[positionedGlyphs[end].codePoint].advance;
    var lineIndent = (positionedGlyphs[end].x + lastAdvance) * justify;

    for (var j = start; j <= end; j++) {
        positionedGlyphs[j].x -= lineIndent;
    }

}

function align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, line, translate) {
    var shiftX = (justify - horizontalAlign) * maxLineLength + translate[0];
    var shiftY = (-verticalAlign * (line + 1) + 0.5) * lineHeight + translate[1];

    for (var j = 0; j < positionedGlyphs.length; j++) {
        positionedGlyphs[j].x += shiftX;
        positionedGlyphs[j].y += shiftY;
    }
}


function shapeIcon(image, layout) {
    if (!image || !image.rect) return null;

    var dx = layout['icon-offset'][0];
    var dy = layout['icon-offset'][1];
    var x1 = dx - image.width / 2;
    var x2 = x1 + image.width;
    var y1 = dy - image.height / 2;
    var y2 = y1 + image.height;

    return new PositionedIcon(image, y1, y2, x1, x2);
}

function PositionedIcon(image, top, bottom, left, right) {
    this.image = image;
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
}
