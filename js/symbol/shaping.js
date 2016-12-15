'use strict';

const scriptDetection = require('../util/script_detection');
const verticalizePunctuation = require('../util/verticalize_punctuation');


const WritingMode = {
    horizontal: 1,
    vertical: 2
};

module.exports = {
    shapeText: shapeText,
    shapeIcon: shapeIcon,
    WritingMode: WritingMode
};


// The position of a glyph relative to the text's anchor point.
function PositionedGlyph(codePoint, x, y, glyph, angle) {
    this.codePoint = codePoint;
    this.x = x;
    this.y = y;
    this.glyph = glyph || null;
    this.angle = angle;
}

// A collection of positioned glyphs and some metadata
function Shaping(positionedGlyphs, text, top, bottom, left, right, writingMode) {
    this.positionedGlyphs = positionedGlyphs;
    this.text = text;
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
    this.writingMode = writingMode;
}

const newLine = 0x0a;

function breakLines(text, lineBreakPoints) {
    const lines = [];
    let start = 0;
    for (const lineBreak of lineBreakPoints) {
        lines.push(text.substring(start, lineBreak));
        start = lineBreak;
    }

    if (start < text.length) {
        lines.push(text.substring(start, text.length));
    }
    return lines;
}

function shapeText(text, glyphs, maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacing, translate, verticalHeight, writingMode) {
    text = text.trim();
    if (writingMode === WritingMode.vertical) text = verticalizePunctuation(text);

    const positionedGlyphs = [];
    const shaping = new Shaping(positionedGlyphs, text, translate[1], translate[1], translate[0], translate[0], writingMode);

    const lines = (writingMode === WritingMode.horizontal && maxWidth) ?
        breakLines(text, determineLineBreaks(text, spacing, maxWidth, glyphs)) :
        [text];

    shapeLines(shaping, glyphs, lines, lineHeight, horizontalAlign, verticalAlign, justify, translate, writingMode, spacing, verticalHeight);

    if (!positionedGlyphs.length)
        return false;

    return shaping;
}

const breakable = {
    0x20:   true, // space
    0x26:   true, // ampersand
    0x28:   true, // left parenthesis
    0x29:   true, // right parenthesis
    0x2b:   true, // plus sign
    0x2d:   true, // hyphen-minus
    0x2f:   true, // solidus
    0xad:   true, // soft hyphen
    0xb7:   true, // middle dot
    0x200b: true, // zero-width space
    0x2010: true, // hyphen
    0x2013: true, // en dash
    0x2027: true  // interpunct
    // Many other characters may be reasonable breakpoints
    // Consider "neutral orientation" characters at scriptDetection.charHasNeutralVerticalOrientation
    // See https://github.com/mapbox/mapbox-gl-js/issues/3658
};

breakable[newLine] = true;

function determineAverageLineWidth(logicalInput, spacing, maxWidth, glyphs) {
    let totalWidth = 0;

    for (const index in logicalInput) {
        const glyph = glyphs[logicalInput.charCodeAt(index)];
        if (!glyph)
            continue;
        totalWidth += glyph.advance + spacing;
    }

    const lineCount = Math.max(1, Math.ceil(totalWidth / maxWidth));
    return totalWidth / lineCount;
}

function calculateBadness(lineWidth, targetWidth, penalty, isLastBreak) {
    const raggedness = Math.pow(lineWidth - targetWidth, 2);
    if (isLastBreak && lineWidth < targetWidth) {
        // Be more tolerant of short final lines
        return Math.max(0, raggedness - 150);
    }
    return raggedness + (Math.sign(penalty) * Math.pow(penalty, 2));
}

function calculatePenalty(codePoint, previousCodePoint) {
    let penalty = 0;
    // Force break on newline
    if (codePoint === 0x0a) {
        penalty -= 10000;
    }
    // Penalize open parenthesis at end of line
    if (previousCodePoint && (previousCodePoint === 0x28 || previousCodePoint === 0xff08)) {
        penalty += 50;
    }
    // Penalize close parenthesis at beginning of line
    if (codePoint === 0x29 || codePoint === 0xff09) {
        penalty += 50;
    }
    return penalty;
}


function evaluateBreak(breakIndex, breakX, targetWidth, potentialBreaks, penalty, isLastBreak) {
    // We could skip evaluating breaks where the line length (breakX - priorBreak.x) > maxWidth
    //  ...but in fact we allow lines longer than maxWidth (if there's no break points)
    //  ...and when targetWidth and maxWidth are close, strictly enforcing maxWidth can give
    //     more lopsided results.

    const edges = [];
    // We're iterating from last potential break towards the first
    for (const potentialBreak of potentialBreaks) {
        const lineWidth = breakX - potentialBreak.x;
        edges.push({ priorBreak: potentialBreak, badness: calculateBadness(lineWidth, targetWidth, penalty, isLastBreak) + potentialBreak.badness});
    }
    edges.push({ priorBreak: null, badness: calculateBadness(breakX, targetWidth, penalty, isLastBreak)});
    edges.sort((a, b) => { return a.badness - b.badness; });

    return {
        index: breakIndex,
        x: breakX,
        priorBreak: edges[0].priorBreak,
        badness: edges[0].badness
    };
}

function leastBadBreaks(lastLineBreak) {
    if (!lastLineBreak) {
        return [];
    }
    return leastBadBreaks(lastLineBreak.priorBreak).concat(lastLineBreak.index);
}

function determineLineBreaks(logicalInput, spacing, maxWidth, glyphs) {
    if (!maxWidth)
        return [];

    if (!logicalInput)
        return [];

    const potentialLineBreaks = [];
    const targetWidth = determineAverageLineWidth(logicalInput, spacing, maxWidth, glyphs);

    let currentX = 0;

    for (let i = 0; i < logicalInput.length; i++) {
        const codePoint = logicalInput.charCodeAt(i);
        const glyph = glyphs[codePoint];

        // newlines treatment slightly different from gl-native. See: https://github.com/mapbox/mapbox-gl-native/issues/7253
        if (!glyph && codePoint !== newLine)
            continue;

        // Ideographic characters, spaces, and word-breaking punctuation that often appear without
        // surrounding spaces.
        if (breakable[codePoint] || scriptDetection.charAllowsIdeographicBreaking(codePoint)) {
            const previousCodePoint = logicalInput.charCodeAt(i - 1);

            potentialLineBreaks.unshift(
                evaluateBreak(i, currentX, targetWidth, potentialLineBreaks, calculatePenalty(codePoint, previousCodePoint), false));
        }

        if (glyph)
            currentX += glyph.advance + spacing;
    }
    potentialLineBreaks.unshift(
        evaluateBreak(logicalInput.length, currentX, targetWidth, potentialLineBreaks, 0, true));

    return leastBadBreaks(potentialLineBreaks.shift());
}

function shapeLines(shaping, glyphs, lines, lineHeight, horizontalAlign, verticalAlign, justify, translate, writingMode, spacing, verticalHeight) {
    // the y offset *should* be part of the font metadata
    const yOffset = -17;

    let x = 0;
    let y = yOffset;

    let maxLineLength = 0;
    const positionedGlyphs = shaping.positionedGlyphs;

    for (const i in lines) {
        const line = lines[i].trim();

        if (!line.length) {
            y += lineHeight; // Still need a line feed after empty line
            continue;
        }

        const lineStartIndex = positionedGlyphs.length;
        for (let i = 0; i < line.length; i++) {
            const codePoint = line.charCodeAt(i);
            const glyph = glyphs[codePoint];

            if (!glyph) continue;

            if (!scriptDetection.charHasUprightVerticalOrientation(codePoint) || writingMode === WritingMode.horizontal) {
                positionedGlyphs.push(new PositionedGlyph(codePoint, x, y, glyph, 0));
                x += glyph.advance + spacing;
            } else {
                positionedGlyphs.push(new PositionedGlyph(codePoint, x, 0, glyph, -Math.PI / 2));
                x += verticalHeight + spacing;
            }
        }

        // Only justify if we placed at least one glyph
        if (positionedGlyphs.length !== lineStartIndex) {
            const lineLength = x - spacing;
            maxLineLength = Math.max(lineLength, maxLineLength);

            justifyLine(positionedGlyphs, glyphs, lineStartIndex, positionedGlyphs.length - 1, justify);
        }

        x = 0;
        y += lineHeight;
    }

    align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, lines.length, translate);

    // Calculate the bounding box
    const height = lines.length * lineHeight;

    shaping.top += -verticalAlign * height;
    shaping.bottom = shaping.top + height;
    shaping.left += -horizontalAlign * maxLineLength;
    shaping.right = shaping.left + maxLineLength;
}

// justify left = 0, right = 1, center = .5
function justifyLine(positionedGlyphs, glyphs, start, end, justify) {
    if (!justify)
        return;

    const lastAdvance = glyphs[positionedGlyphs[end].codePoint].advance;
    const lineIndent = (positionedGlyphs[end].x + lastAdvance) * justify;

    for (let j = start; j <= end; j++) {
        positionedGlyphs[j].x -= lineIndent;
    }
}

function align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, lineCount, translate) {
    const shiftX = (justify - horizontalAlign) * maxLineLength + translate[0];
    const shiftY = (-verticalAlign * lineCount + 0.5) * lineHeight + translate[1];

    for (let j = 0; j < positionedGlyphs.length; j++) {
        positionedGlyphs[j].x += shiftX;
        positionedGlyphs[j].y += shiftY;
    }
}

function shapeIcon(image, iconOffset) {
    if (!image || !image.rect) return null;

    const dx = iconOffset[0];
    const dy = iconOffset[1];
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
