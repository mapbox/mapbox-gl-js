'use strict';

var Point = require('point-geometry');

var minScale = 0.5; // underscale by 1 zoom level

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
module.exports = function placeShapedIcon(anchor, shapedIcon, boxScale, line, layer, alongLine, shapedText, globalProperties, featureProperties) {
    var rect = shapedIcon.image.rect;
    var layout = layer.layout;

    var border = 1;
    var left = shapedIcon.left - border;
    var right = left + rect.w / shapedIcon.image.pixelRatio;
    var top = shapedIcon.top - border;
    var bottom = top + rect.h / shapedIcon.image.pixelRatio;
    var tl, tr, br, bl;

    // text-fit mode
    if (layout['icon-text-fit'] !== 'none' && shapedText) {
        var iconWidth = (right - left),
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

    var angle = layer.getLayoutValue('icon-rotate', globalProperties, featureProperties) * Math.PI / 180;
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

    return [{
        anchorPoint: new Point(anchor.x, anchor.y), // the point the symbol is anchored around
        tl: tl, // The offset of the top left corner from the anchor.
        tr: tr, // The offset of the top right corner from the anchor.
        bl: bl, // The offset of the bottom left corner from the anchor.
        br: br, // The offset of the bottom right corner from the anchor.
        tex: shapedIcon.image.rect, // The texture coordinates.
        anchorAngle: 0, // The angle of the label at it's center, not the angle of this quad.
        glyphAngle: 0, // The angle of the glyph to be positioned in the quad.
        minScale: minScale, // The minimum scale, relative to the tile's intended scale, that the glyph can be shown at.
        maxScale: Infinity // The maximum scale, relative to the tile's intended scale, that the glyph can be shown at.
    }];
};
