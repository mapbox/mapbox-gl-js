'use strict';

var Point = require('point-geometry');

var minScale = 0.5; // underscale by 1 zoom level

/**
 * Create the placedShapedText used for rendering a text label.
 *
 * @param {Anchor} anchor
 * @param shapedText
 * @param {number} boxScale A magic number for converting from glyph metric units to geometry units.
 * @param {Array<Array<Point>>} line
 * @param {StyleLayer} layer
 * @param {boolean} alongLine Whether the label should be placed along the line.
 * @returns {Array<SymbolQuad>}
 * @private
 */
module.exports = function placeShapedText(anchor, shapedText, boxScale, line, layer, alongLine, verticalOrientation) {

    var textRotate = layer.layout['text-rotate'] * Math.PI / 180;
    var keepUpright = layer.layout['text-keep-upright'];

    var shapedGlyphs = shapedText.shapedGlyphs;
    var placedShapedText = [];

    for (var k = 0; k < shapedGlyphs.length; k++) {
        var shapedGlyph = shapedGlyphs[k];
        var glyph = shapedGlyph.glyph;
        if (!glyph) continue;

        var rect = glyph.rect;
        if (!rect) continue;

        var centerX = (shapedGlyph.x + glyph.advance / 2) * boxScale;

        var placedShapedGlyphs;
        var labelMinScale = minScale;
        if (alongLine) {
            placedShapedGlyphs = [];
            labelMinScale = placeShapedGlyph(placedShapedGlyphs, anchor, centerX, line, anchor.segment, true);
            if (keepUpright) {
                labelMinScale = Math.min(labelMinScale, placeShapedGlyph(placedShapedGlyphs, anchor, centerX, line, anchor.segment, false));
            }

        } else {
            placedShapedGlyphs = [{
                anchorPoint: new Point(anchor.x, anchor.y),
                offset: 0,
                angle: 0,
                maxScale: Infinity,
                minScale: minScale
            }];
        }

        var x1 = shapedGlyph.x + glyph.left,
            y1 = shapedGlyph.y - glyph.top,
            x2 = x1 + rect.w,
            y2 = y1 + rect.h,

            otl = new Point(x1, y1),
            otr = new Point(x2, y1),
            obl = new Point(x1, y2),
            obr = new Point(x2, y2);

        for (var i = 0; i < placedShapedGlyphs.length; i++) {

            var placedShapedGlyph = placedShapedGlyphs[i],
                tl = otl,
                tr = otr,
                bl = obl,
                br = obr;

            // vertical orientation
            if (verticalOrientation) {
                var verticalMatrix = [0, -1, 1, 0];

                tl = tl.matMult(verticalMatrix);
                tr = tr.matMult(verticalMatrix);
                bl = bl.matMult(verticalMatrix);
                br = br.matMult(verticalMatrix);
            }

            if (textRotate) {
                var sin = Math.sin(textRotate),
                    cos = Math.cos(textRotate),
                    matrix = [cos, -sin, sin, cos];

                tl = tl.matMult(matrix);
                tr = tr.matMult(matrix);
                bl = bl.matMult(matrix);
                br = br.matMult(matrix);
            }

            // Prevent label from extending past the end of the line
            var glyphMinScale = Math.max(placedShapedGlyph.minScale, labelMinScale);

            var anchorAngle = (anchor.angle + placedShapedGlyph.offset + 2 * Math.PI) % (2 * Math.PI);
            var glyphAngle = (placedShapedGlyph.angle + placedShapedGlyph.offset + 2 * Math.PI) % (2 * Math.PI);
            placedShapedText.push({
                anchorPoint: placedShapedGlyph.anchorPoint, // the point the symbol is anchored around
                tl: tl, // The offset of the top left corner from the anchor.
                tr: tr, // The offset of the top right corner from the anchor.
                bl: bl, // The offset of the bottom left corner from the anchor.
                br: br, // The offset of the bottom right corner from the anchor.
                tex: rect, // The texture coordinates.
                anchorAngle: anchorAngle, // The angle of the label at it's center, not the angle of this quad.
                glyphAngle: glyphAngle, // The angle of the glyph to be positioned in the quad.
                minScale: glyphMinScale, // The minimum scale, relative to the tile's intended scale, that the glyph can be shown at.
                maxScale: placedShapedGlyph.maxScale // The maximum scale, relative to the tile's intended scale, that the glyph can be shown at.
            });
        }
    }

    return placedShapedText;
};

/**
 * We can only render glyphs along a straight line. To draw
 * curved lines we need an instance of a glyph for each segment it appears on.
 * This creates all the instances of a glyph that are necessary to render a label.
 *
 * We need a
 * @param {Array<Object>} placedShapedGlyphs An empty array that placedShapedGlyphs are added to.
 * @param {Anchor} anchor
 * @param {number} offset The glyph's offset from the center of the label.
 * @param {Array<Point>} line
 * @param {number} segment The index of the segment of the line on which the anchor exists.
 * @param {boolean}s forward If true get the glyphs that come later on the line, otherwise get the glyphs that come earlier.
 *
 * @returns {Array<Object>} placedShapedGlyphs
 * @private
 */
function placeShapedGlyph(glyphs, anchor, offset, line, segment, forward) {
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
