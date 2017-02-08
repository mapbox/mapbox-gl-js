'use strict';

const Point = require('point-geometry');

module.exports = {
    getIconQuads: getIconQuads,
    getGlyphQuads: getGlyphQuads,
    SymbolQuad: SymbolQuad
};

const minScale = 0.5; // underscale by 1 zoom level

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
 * @param {number} anchorAngle The angle of the label at it's center, not the angle of this quad.
 * @param {number} glyphAngle The angle of the glyph to be positioned in the quad.
 * @param {number} minScale The minimum scale, relative to the tile's intended scale, that the glyph can be shown at.
 * @param {number} maxScale The maximum scale, relative to the tile's intended scale, that the glyph can be shown at.
 *
 * @class SymbolQuad
 * @private
 */
function SymbolQuad(anchorPoint, tl, tr, bl, br, tex, anchorAngle, glyphAngle, minScale, maxScale, writingMode) {
    this.anchorPoint = anchorPoint;
    this.tl = tl;
    this.tr = tr;
    this.bl = bl;
    this.br = br;
    this.tex = tex;
    this.anchorAngle = anchorAngle;
    this.glyphAngle = glyphAngle;
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.writingMode = writingMode;
}

/**
 * Create the quads used for rendering an icon.
 *
 * @param {Anchor} anchor
 * @param {PositionedIcon} shapedIcon
 * @param {number} boxScale A magic number for converting glyph metric units to geometry units.
 * @param {Array<Array<Point>>} line
 * @param {StyleLayer} layer
 * @param {boolean} alongLine Whether the icon should be placed along the line.
 * @param {Shaping} shapedText Shaping for corresponding text
 * @returns {Array<SymbolQuad>}
 * @private
 */
function getIconQuads(anchor, shapedIcon, boxScale, line, layer, alongLine, shapedText, globalProperties, featureProperties) {
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

    let angle = layer.getLayoutValue('icon-rotate', globalProperties, featureProperties) * Math.PI / 180;
    if (alongLine) {
        const prev = line[anchor.segment];
        if (anchor.y === prev.y && anchor.x === prev.x && anchor.segment + 1 < line.length) {
            const next = line[anchor.segment + 1];
            angle += Math.atan2(anchor.y - next.y, anchor.x - next.x) + Math.PI;
        } else {
            angle += Math.atan2(anchor.y - prev.y, anchor.x - prev.x);
        }
    }

    if (angle) {
        const sin = Math.sin(angle),
            cos = Math.cos(angle),
            matrix = [cos, -sin, sin, cos];

        tl = tl.matMult(matrix);
        tr = tr.matMult(matrix);
        bl = bl.matMult(matrix);
        br = br.matMult(matrix);
    }

    return [new SymbolQuad(new Point(anchor.x, anchor.y), tl, tr, bl, br, shapedIcon.image.rect, 0, 0, minScale, Infinity)];
}

/**
 * Create the quads used for rendering a text label.
 *
 * @param {Anchor} anchor
 * @param {Shaping} shaping
 * @param {number} boxScale A magic number for converting from glyph metric units to geometry units.
 * @param {Array<Array<Point>>} line
 * @param {StyleLayer} layer
 * @param {boolean} alongLine Whether the label should be placed along the line.
 * @returns {Array<SymbolQuad>}
 * @private
 */
function getGlyphQuads(anchor, shaping, boxScale, line, layer, alongLine) {

    const textRotate = layer.layout['text-rotate'] * Math.PI / 180;
    const keepUpright = layer.layout['text-keep-upright'];

    const positionedGlyphs = shaping.positionedGlyphs;
    const quads = [];

    for (let k = 0; k < positionedGlyphs.length; k++) {
        const positionedGlyph = positionedGlyphs[k];
        const glyph = positionedGlyph.glyph;
        if (!glyph) continue;

        const rect = glyph.rect;
        if (!rect) continue;

        const centerX = (positionedGlyph.x + glyph.advance / 2) * boxScale;

        let glyphInstances;
        let labelMinScale = minScale;
        if (alongLine) {
            glyphInstances = [];
            labelMinScale = getSegmentGlyphs(glyphInstances, anchor, centerX, line, anchor.segment, true);
            if (keepUpright) {
                labelMinScale = Math.min(labelMinScale, getSegmentGlyphs(glyphInstances, anchor, centerX, line, anchor.segment, false));
            }

        } else {
            glyphInstances = [{
                anchorPoint: new Point(anchor.x, anchor.y),
                offset: 0,
                angle: 0,
                maxScale: Infinity,
                minScale: minScale
            }];
        }

        const x1 = positionedGlyph.x + glyph.left;
        const y1 = positionedGlyph.y - glyph.top;
        const x2 = x1 + rect.w;
        const y2 = y1 + rect.h;

        const center = new Point(positionedGlyph.x, glyph.advance / 2);

        const otl = new Point(x1, y1);
        const otr = new Point(x2, y1);
        const obl = new Point(x1, y2);
        const obr = new Point(x2, y2);

        if (positionedGlyph.angle !== 0) {
            otl._sub(center)._rotate(positionedGlyph.angle)._add(center);
            otr._sub(center)._rotate(positionedGlyph.angle)._add(center);
            obl._sub(center)._rotate(positionedGlyph.angle)._add(center);
            obr._sub(center)._rotate(positionedGlyph.angle)._add(center);
        }

        for (let i = 0; i < glyphInstances.length; i++) {

            const instance = glyphInstances[i];
            let tl = otl,
                tr = otr,
                bl = obl,
                br = obr;

            if (textRotate) {
                const sin = Math.sin(textRotate),
                    cos = Math.cos(textRotate),
                    matrix = [cos, -sin, sin, cos];

                tl = tl.matMult(matrix);
                tr = tr.matMult(matrix);
                bl = bl.matMult(matrix);
                br = br.matMult(matrix);
            }

            // Prevent label from extending past the end of the line
            const glyphMinScale = Math.max(instance.minScale, labelMinScale);

            const anchorAngle = (anchor.angle + instance.offset + 2 * Math.PI) % (2 * Math.PI);
            const glyphAngle = (instance.angle + instance.offset + 2 * Math.PI) % (2 * Math.PI);
            quads.push(new SymbolQuad(instance.anchorPoint, tl, tr, bl, br, rect, anchorAngle, glyphAngle, glyphMinScale, instance.maxScale, shaping.writingMode));
        }
    }

    return quads;
}

/**
 * We can only render glyph quads that slide along a straight line. To draw
 * curved lines we need an instance of a glyph for each segment it appears on.
 * This creates all the instances of a glyph that are necessary to render a label.
 *
 * We need a
 * @param {Array<Object>} glyphInstances An empty array that glyphInstances are added to.
 * @param {Anchor} anchor
 * @param {number} offset The glyph's offset from the center of the label.
 * @param {Array<Point>} line
 * @param {number} segment The index of the segment of the line on which the anchor exists.
 * @param {boolean} forward If true get the glyphs that come later on the line, otherwise get the glyphs that come earlier.
 *
 * @returns {Array<Object>} glyphInstances
 * @private
 */
function getSegmentGlyphs(glyphs, anchor, offset, line, segment, forward) {
    const upsideDown = !forward;

    if (offset < 0) forward = !forward;

    if (forward) segment++;

    let newAnchorPoint = new Point(anchor.x, anchor.y);
    let end = line[segment];
    let prevScale = Infinity;

    offset = Math.abs(offset);

    const placementScale = minScale;

    while (true) {
        const distance = newAnchorPoint.dist(end);
        const scale = offset / distance;

        // Get the angle of the line segment
        let angle = Math.atan2(end.y - newAnchorPoint.y, end.x - newAnchorPoint.x);
        if (!forward) angle += Math.PI;

        glyphs.push({
            anchorPoint: newAnchorPoint,
            offset: upsideDown ? Math.PI : 0,
            minScale: scale,
            maxScale: prevScale,
            angle: (angle + 2 * Math.PI) % (2 * Math.PI)
        });

        if (scale <= placementScale) break;

        newAnchorPoint = end;

        // skip duplicate nodes
        while (newAnchorPoint.equals(end)) {
            segment += forward ? 1 : -1;
            end = line[segment];
            if (!end) {
                return scale;
            }
        }

        const unit = end.sub(newAnchorPoint)._unit();
        newAnchorPoint = newAnchorPoint.sub(unit._mult(distance));

        prevScale = scale;
    }

    return placementScale;
}
