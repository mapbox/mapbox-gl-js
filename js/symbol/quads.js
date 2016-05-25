'use strict';

var Point = require('point-geometry');

module.exports = {
    getIconQuads: getIconQuads,
    getGlyphQuads: getGlyphQuads,
    SymbolQuad: SymbolQuad
};

var minScale = 0.5; // underscale by 1 zoom level

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
 * @param {number} angle The angle of the label at it's center, not the angle of this quad.
 * @param {number} minScale The minimum scale, relative to the tile's intended scale, that the glyph can be shown at.
 * @param {number} maxScale The maximum scale, relative to the tile's intended scale, that the glyph can be shown at.
 *
 * @class SymbolQuad
 * @private
 */
function SymbolQuad(anchorPoint, tl, tr, bl, br, tex, angle, minScale, maxScale) {
    this.anchorPoint = anchorPoint;
    this.tl = tl;
    this.tr = tr;
    this.bl = bl;
    this.br = br;
    this.tex = tex;
    this.angle = angle;
    this.minScale = minScale;
    this.maxScale = maxScale;
}

/**
 * Create the quads used for rendering an icon.
 *
 * @param {Anchor} anchor
 * @param {PositionedIcon} shapedIcon
 * @param {number} boxScale A magic number for converting glyph metric units to geometry units.
 * @param {Array<Array<Point>>} line
 * @param {LayoutProperties} layout
 * @param {boolean} alongLine Whether the icon should be placed along the line.
 * @returns {Array<SymbolQuad>}
 * @private
 */
function getIconQuads(anchor, shapedIcon, boxScale, line, layout, alongLine) {

    var rect = shapedIcon.image.rect;

    var border = 1;
    var left = shapedIcon.left - border;
    var right = left + rect.w / shapedIcon.image.pixelRatio;
    var top = shapedIcon.top - border;
    var bottom = top + rect.h / shapedIcon.image.pixelRatio;
    var tl = new Point(left, top);
    var tr = new Point(right, top);
    var br = new Point(right, bottom);
    var bl = new Point(left, bottom);

    var angle = layout['icon-rotate'] * Math.PI / 180;
    if (alongLine) {
        var prev = line[anchor.segment];
        if (anchor.y === prev.y && anchor.x === prev.x && anchor.segment + 1 < line.length) {
            var next = line[anchor.segment + 1];
            angle += Math.atan2(anchor.y - next.y, anchor.x - next.x) + Math.PI;
        } else {
            angle += Math.atan2(anchor.y - prev.y, anchor.x - prev.x);
        }
    }

    if (angle) {
        var sin = Math.sin(angle),
            cos = Math.cos(angle),
            matrix = [cos, -sin, sin, cos];

        tl = tl.matMult(matrix);
        tr = tr.matMult(matrix);
        bl = bl.matMult(matrix);
        br = br.matMult(matrix);
    }

    return [new SymbolQuad(new Point(anchor.x, anchor.y), tl, tr, bl, br, shapedIcon.image.rect, 0, minScale, Infinity)];
}

/**
 * Create the quads used for rendering a text label.
 *
 * @param {Anchor} anchor
 * @param {Shaping} shaping
 * @param {number} boxScale A magic number for converting from glyph metric units to geometry units.
 * @param {Array<Array<Point>>} line
 * @param {LayoutProperties} layout
 * @param {boolean} alongLine Whether the label should be placed along the line.
 * @returns {Array<SymbolQuad>}
 * @private
 */
function getGlyphQuads(anchor, shaping, boxScale, line, layout, alongLine) {

    var textRotate = layout['text-rotate'] * Math.PI / 180;
    var keepUpright = layout['text-keep-upright'];

    var positionedGlyphs = shaping.positionedGlyphs;
    var quads = [];

    for (var k = 0; k < positionedGlyphs.length; k++) {
        var positionedGlyph = positionedGlyphs[k];
        var glyph = positionedGlyph.glyph;
        var rect = glyph.rect;

        if (!rect) continue;

        var centerX = (positionedGlyph.x + glyph.advance / 2) * boxScale;

        var glyphInstances;
        var labelMinScale = minScale;
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

        var x1 = positionedGlyph.x + glyph.left,
            y1 = positionedGlyph.y - glyph.top,
            x2 = x1 + rect.w,
            y2 = y1 + rect.h,

            otl = new Point(x1, y1),
            otr = new Point(x2, y1),
            obl = new Point(x1, y2),
            obr = new Point(x2, y2);

        for (var i = 0; i < glyphInstances.length; i++) {

            var instance = glyphInstances[i],
                tl = otl,
                tr = otr,
                bl = obl,
                br = obr,
                angle = instance.angle + textRotate;

            if (angle) {
                var sin = Math.sin(angle),
                    cos = Math.cos(angle),
                    matrix = [cos, -sin, sin, cos];

                tl = tl.matMult(matrix);
                tr = tr.matMult(matrix);
                bl = bl.matMult(matrix);
                br = br.matMult(matrix);
            }

            // Prevent label from extending past the end of the line
            var glyphMinScale = Math.max(instance.minScale, labelMinScale);

            var glyphAngle = (anchor.angle + textRotate + instance.offset + 2 * Math.PI) % (2 * Math.PI);
            quads.push(new SymbolQuad(instance.anchorPoint, tl, tr, bl, br, rect, glyphAngle, glyphMinScale, instance.maxScale));

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
    var upsideDown = !forward;

    if (offset < 0) forward = !forward;

    if (forward) segment++;

    var newAnchorPoint = new Point(anchor.x, anchor.y);
    var end = line[segment];
    var prevScale = Infinity;

    offset = Math.abs(offset);

    var placementScale = minScale;

    while (true) {
        var distance = newAnchorPoint.dist(end);
        var scale = offset / distance;

        // Get the angle of the line segment
        var angle = Math.atan2(end.y - newAnchorPoint.y, end.x - newAnchorPoint.x);
        if (!forward) angle += Math.PI;
        if (upsideDown) angle += Math.PI;

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

        var unit = end.sub(newAnchorPoint)._unit();
        newAnchorPoint = newAnchorPoint.sub(unit._mult(distance));

        prevScale = scale;
    }

    return placementScale;
}
