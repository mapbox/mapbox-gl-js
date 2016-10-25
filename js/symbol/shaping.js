'use strict';

const scriptDetection = require('../util/script_detection');

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

const newLine = 0x0a;

function shapeText(text, glyphs, maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacing, translate) {

    const positionedGlyphs = [];
    const shaping = new Shaping(positionedGlyphs, text, translate[1], translate[1], translate[0], translate[0]);

    // the y offset *should* be part of the font metadata
    const yOffset = -17;

    let x = 0;
    const y = yOffset;

    text = text.trim();

    for (let i = 0; i < text.length; i++) {
        const codePoint = text.charCodeAt(i);
        const glyph = glyphs[codePoint];

        if (!glyph && codePoint !== newLine) continue;

        positionedGlyphs.push(new PositionedGlyph(codePoint, x, y, glyph));

        if (glyph) {
            x += glyph.advance + spacing;
        }
    }

    if (!positionedGlyphs.length) return false;

    linewrap(shaping, glyphs, lineHeight, maxWidth, horizontalAlign, verticalAlign, justify, translate, scriptDetection.allowsIdeographicBreaking(text));

    return shaping;
}

const invisible = {
    0x20:   true, // space
    0x200b: true  // zero-width space
};

const breakable = {
    0x20:   true, // space
    0x26:   true, // ampersand
    0x2b:   true, // plus sign
    0x2d:   true, // hyphen-minus
    0x2f:   true, // solidus
    0xad:   true, // soft hyphen
    0xb7:   true, // middle dot
    0x200b: true, // zero-width space
    0x2010: true, // hyphen
    0x2013: true  // en dash
};

invisible[newLine] = breakable[newLine] = true;

function linewrap(shaping, glyphs, lineHeight, maxWidth, horizontalAlign, verticalAlign, justify, translate, useBalancedIdeographicBreaking) {
    let lastSafeBreak = null;
    let lengthBeforeCurrentLine = 0;
    let lineStartIndex = 0;
    let line = 0;

    let maxLineLength = 0;

    const positionedGlyphs = shaping.positionedGlyphs;

    if (maxWidth) {
        if (useBalancedIdeographicBreaking) {
            const lastPositionedGlyph = positionedGlyphs[positionedGlyphs.length - 1];
            const estimatedLineCount = Math.max(1, Math.ceil(lastPositionedGlyph.x / maxWidth));
            maxWidth = lastPositionedGlyph.x / estimatedLineCount;
        }

        for (let i = 0; i < positionedGlyphs.length; i++) {
            const positionedGlyph = positionedGlyphs[i];

            positionedGlyph.x -= lengthBeforeCurrentLine;
            positionedGlyph.y += lineHeight * line;

            if (lastSafeBreak !== null && (positionedGlyph.x > maxWidth ||
                    positionedGlyphs[lastSafeBreak].codePoint === newLine)) {

                const lineLength = positionedGlyphs[lastSafeBreak + 1].x;
                maxLineLength = Math.max(lineLength, maxLineLength);

                for (let k = lastSafeBreak + 1; k <= i; k++) {
                    positionedGlyphs[k].y += lineHeight;
                    positionedGlyphs[k].x -= lineLength;
                }

                if (justify) {
                    // Collapse invisible characters.
                    let lineEnd = lastSafeBreak;
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

            if (useBalancedIdeographicBreaking || breakable[positionedGlyph.codePoint] || scriptDetection.charAllowsIdeographicBreaking(positionedGlyph.codePoint)) {
                lastSafeBreak = i;
            }
        }
    }

    const lastPositionedGlyph = positionedGlyphs[positionedGlyphs.length - 1];
    const lastLineLength = lastPositionedGlyph.x + glyphs[lastPositionedGlyph.codePoint].advance;
    maxLineLength = Math.max(maxLineLength, lastLineLength);

    const height = (line + 1) * lineHeight;

    justifyLine(positionedGlyphs, glyphs, lineStartIndex, positionedGlyphs.length - 1, justify);
    align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, line, translate);

    // Calculate the bounding box
    shaping.top += -verticalAlign * height;
    shaping.bottom = shaping.top + height;
    shaping.left += -horizontalAlign * maxLineLength;
    shaping.right = shaping.left + maxLineLength;
}

function justifyLine(positionedGlyphs, glyphs, start, end, justify) {
    const lastAdvance = glyphs[positionedGlyphs[end].codePoint].advance;
    const lineIndent = (positionedGlyphs[end].x + lastAdvance) * justify;

    for (let j = start; j <= end; j++) {
        positionedGlyphs[j].x -= lineIndent;
    }

}

function align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, line, translate) {
    const shiftX = (justify - horizontalAlign) * maxLineLength + translate[0];
    const shiftY = (-verticalAlign * (line + 1) + 0.5) * lineHeight + translate[1];

    for (let j = 0; j < positionedGlyphs.length; j++) {
        positionedGlyphs[j].x += shiftX;
        positionedGlyphs[j].y += shiftY;
    }
}

function shapeIcon(image, layout) {
    if (!image || !image.rect) return null;

    const dx = layout['icon-offset'][0];
    const dy = layout['icon-offset'][1];
    const x1 = dx - image.width / 2;
    const x2 = x1 + image.width;
    const y1 = dy - image.height / 2;
    const y2 = y1 + image.height;

    return new PositionedIcon(image, y1, y2, x1, x2);
}

function PositionedIcon(image, top, bottom, left, right) {
    this.image = image;
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
}
