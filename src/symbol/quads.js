'use strict';

const Point = require('point-geometry');

module.exports = {
    getIconQuads: getIconQuads,
    getGlyphQuads: getGlyphQuads,
    SymbolQuad: SymbolQuad
};

/**
 * A textured quad for rendering a single icon or glyph.
 *
 * The zoom range the glyph can be shown is defined by minScale and maxScale.
 *
 * @param {Point} anchorPoint the point the symbol is anchored around
 * @param {Point} tl The offset of the top left corner from the anchor.
 * @param {Point} tr The offset of the top right corner from the anchor.
 * @param {Point} bl The offset of the bottom left corner from the anchor.
 * @param {Point} br The offset of the bottom right corner from the anchor.
 * @param {Object} tex The texture coordinates.
 *
 * @class SymbolQuad
 * @private
 */
function SymbolQuad(anchorPoint, tl, tr, bl, br, tex, writingMode, glyphOffsetX, glyphOffsetY) {
    this.anchorPoint = anchorPoint;
    this.tl = tl;
    this.tr = tr;
    this.bl = bl;
    this.br = br;
    this.tex = tex;
    this.writingMode = writingMode;
    this.glyphOffsetX = glyphOffsetX;
    this.glyphOffsetY = glyphOffsetY;
}

/**
 * Create the quads used for rendering an icon.
 *
 * @param {Anchor} anchor
 * @param {PositionedIcon} shapedIcon
 * @param {StyleLayer} layer
 * @param {boolean} alongLine Whether the icon should be placed along the line.
 * @param {Shaping} shapedText Shaping for corresponding text
 * @param {Object} globalProperties
 * @param {Object} featureProperties
 * @returns {Array<SymbolQuad>}
 * @private
 */
function getIconQuads(anchor, shapedIcon, layer, alongLine, shapedText, globalProperties, featureProperties) {
    const rect = shapedIcon.image.rect;
    const layout = layer.layout;

    const border = 1;
    const left = shapedIcon.left - border;
    const right = left + rect.w / shapedIcon.image.pixelRatio;
    const top = shapedIcon.top - border;
    const bottom = top + rect.h / shapedIcon.image.pixelRatio;
    let tl, tr, br, bl;

    // text-fit mode
    if (layout['icon-text-fit'] !== 'none' && shapedText) {
        const iconWidth = (right - left),
            iconHeight = (bottom - top),
            size = layout['text-size'] / 24,
            textLeft = shapedText.left * size,
            textRight = shapedText.right * size,
            textTop = shapedText.top * size,
            textBottom = shapedText.bottom * size,
            textWidth = textRight - textLeft,
            textHeight = textBottom - textTop,
            padT = layout['icon-text-fit-padding'][0],
            padR = layout['icon-text-fit-padding'][1],
            padB = layout['icon-text-fit-padding'][2],
            padL = layout['icon-text-fit-padding'][3],
            offsetY = layout['icon-text-fit'] === 'width' ? (textHeight - iconHeight) * 0.5 : 0,
            offsetX = layout['icon-text-fit'] === 'height' ? (textWidth - iconWidth) * 0.5 : 0,
            width = layout['icon-text-fit'] === 'width' || layout['icon-text-fit'] === 'both' ? textWidth : iconWidth,
            height = layout['icon-text-fit'] === 'height' || layout['icon-text-fit'] === 'both' ? textHeight : iconHeight;
        tl = new Point(textLeft + offsetX - padL,         textTop + offsetY - padT);
        tr = new Point(textLeft + offsetX + padR + width, textTop + offsetY - padT);
        br = new Point(textLeft + offsetX + padR + width, textTop + offsetY + padB + height);
        bl = new Point(textLeft + offsetX - padL,         textTop + offsetY + padB + height);
    // Normal icon size mode
    } else {
        tl = new Point(left, top);
        tr = new Point(right, top);
        br = new Point(right, bottom);
        bl = new Point(left, bottom);
    }

    const angle = layer.getLayoutValue('icon-rotate', globalProperties, featureProperties) * Math.PI / 180;

    if (angle) {
        const sin = Math.sin(angle),
            cos = Math.cos(angle),
            matrix = [cos, -sin, sin, cos];

        tl._matMult(matrix);
        tr._matMult(matrix);
        bl._matMult(matrix);
        br._matMult(matrix);
    }

    return [new SymbolQuad(new Point(anchor.x, anchor.y), tl, tr, bl, br, shapedIcon.image.rect, undefined, 0, 0)];
}

/**
 * Create the quads used for rendering a text label.
 *
 * @param {Anchor} anchor
 * @param {Shaping} shaping
 * @param {StyleLayer} layer
 * @param {boolean} alongLine Whether the label should be placed along the line.
 * @param {Object} globalProperties
 * @param {Object} featureProperties
 * @returns {Array<SymbolQuad>}
 * @private
 */
function getGlyphQuads(anchor, shaping, layer, alongLine, globalProperties, featureProperties) {

    const textRotate = layer.getLayoutValue('text-rotate', globalProperties, featureProperties) * Math.PI / 180;

    const positionedGlyphs = shaping.positionedGlyphs;
    const quads = [];

    for (let k = 0; k < positionedGlyphs.length; k++) {
        const positionedGlyph = positionedGlyphs[k];
        const glyph = positionedGlyph.glyph;
        if (!glyph) continue;

        const rect = glyph.rect;
        if (!rect) continue;

        const anchorPoint = new Point(anchor.x, anchor.y);

        const halfAdvance = glyph.advance / 2;
        const xOffset = alongLine ? positionedGlyph.x + halfAdvance : 0;
        const yOffset = alongLine ? positionedGlyph.y : 0;
        const builtInXOffset = alongLine ? 0 : positionedGlyph.x + halfAdvance;
        const builtInYOffset = alongLine ? 0 : positionedGlyph.y;

        const x1 = glyph.left - halfAdvance + builtInXOffset;
        const y1 = -glyph.top + builtInYOffset;
        const x2 = x1 + rect.w;
        const y2 = y1 + rect.h;

        const tl = new Point(x1, y1);
        const tr = new Point(x2, y1);
        const bl  = new Point(x1, y2);
        const br = new Point(x2, y2);

        const center = new Point(builtInXOffset - halfAdvance, glyph.advance / 2);
        if (positionedGlyph.angle !== 0) {
            tl._sub(center)._rotate(positionedGlyph.angle)._add(center);
            tr._sub(center)._rotate(positionedGlyph.angle)._add(center);
            bl._sub(center)._rotate(positionedGlyph.angle)._add(center);
            br._sub(center)._rotate(positionedGlyph.angle)._add(center);
        }

        if (textRotate) {
            const sin = Math.sin(textRotate),
                cos = Math.cos(textRotate),
                matrix = [cos, -sin, sin, cos];

            tl._matMult(matrix);
            tr._matMult(matrix);
            bl._matMult(matrix);
            br._matMult(matrix);
        }

        quads.push(new SymbolQuad(anchorPoint, tl, tr, bl, br, rect, shaping.writingMode, xOffset, yOffset));
    }

    // Quads need to be in a strict order so that the render-time projection algorithm can be more efficient.
    quads.sort((qa, qb) => {
        const a = qa.glyphOffsetX;
        const b = qb.glyphOffsetX;
        const aIsForward = a > 0;
        const bIsForward = b > 0;

        if (aIsForward === bIsForward) {
            return Math.abs(a) - Math.abs(b);
        } else if (aIsForward) {
            return -1;
        } else {
            return 1;
        }
    });

    return quads;
}
