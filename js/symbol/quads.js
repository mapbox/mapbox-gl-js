'use strict';

var Point = require('point-geometry');
var Anchor = require('../symbol/anchor');

module.exports = {
    getIconQuads: getIconQuads,
    getGlyphQuads: getGlyphQuads
};

var minScale = 0.5; // underscale by 1 zoom level

function SymbolQuad(anchor, tl, tr, bl, br, tex, angle, minScale, maxScale) {
    this.anchor = anchor;
    this.tl = tl;
    this.tr = tr;
    this.bl = bl;
    this.br = br;
    this.tex = tex;
    this.angle = angle;
    this.minScale = minScale;
    this.maxScale = maxScale;
}

function getIconQuads(anchor, shapedIcon, boxScale, line, layout) {

    var tl = new Point(shapedIcon.left, shapedIcon.top);
    var tr = new Point(shapedIcon.right, shapedIcon.top);
    var br = new Point(shapedIcon.right, shapedIcon.bottom);
    var bl = new Point(shapedIcon.left, shapedIcon.bottom);

    var angle = layout['icon-rotate'] * Math.PI / 180;
    if (anchor.segment !== undefined && layout['icon-rotation-alignment'] !== 'viewport') {
        var next = line[anchor.segment];
        angle += -Math.atan2(next.x - anchor.x, next.y - anchor.y) + Math.PI / 2;
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

    return [new SymbolQuad(anchor, tl, tr, bl, br, shapedIcon.image.rect, 0, minScale, Infinity)];
}

function getGlyphQuads(anchor, shaping, boxScale, line, layout) {

    var textRotate = layout['text-rotate'] * Math.PI / 180;
    var alongLine = layout['text-rotation-alignment'] !== 'viewport' && anchor.segment !== undefined;
    var keepUpright = layout['text-keep-upright'];

    var positionedGlyphs = shaping.positionedGlyphs;
    var quads = [];

    for (var k = 0; k < positionedGlyphs.length; k++) {
        var shape = positionedGlyphs[k];
        var glyph = shape.glyph;
        var rect = glyph.rect;

        if (!rect) continue;

        var centerX = (shape.x + glyph.advance / 2) * boxScale;

        var glyphInstances;
        if (alongLine) {
            glyphInstances = [];
            getSegmentGlyphs(glyphInstances, anchor, centerX, line, anchor.segment, 1);
            if (keepUpright) getSegmentGlyphs(glyphInstances, anchor, centerX, line, anchor.segment, -1);

        } else {
            glyphInstances = [{
                anchor: anchor,
                offset: 0,
                angle: 0,
                maxScale: Infinity,
                minScale: minScale
            }];
        }

        var x1 = shape.x + glyph.left,
            y1 = shape.y - glyph.top,
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
            var glyphMinScale = Math.max(instance.minScale, anchor.scale);

            var glyphAngle = (anchor.angle + textRotate + instance.offset + 2 * Math.PI) % (2 * Math.PI);
            quads.push(new SymbolQuad(instance.anchor, tl, tr, bl, br, rect, glyphAngle, glyphMinScale, instance.maxScale));

        }
    }

    return quads;
}

function getSegmentGlyphs(glyphs, anchor, offset, line, segment, direction) {
    var upsideDown = direction < 0;

    if (offset < 0) direction *= -1;

    if (direction > 0) segment++;

    var newAnchor = anchor;
    var end = line[segment];
    var prevScale = Infinity;

    offset = Math.abs(offset);

    var placementScale = anchor.scale;

    while (true) {
        var distance = newAnchor.dist(end);
        var scale = offset / distance;

        // Get the angle between the anchor point and the end point.
        // arctan2(y, x) returns [-π, +π].
        // Use -arctan2(x, y) to account for canvas reference frame
        // Add +/- 90deg to get the angle of the normal
        var angle = -Math.atan2(end.x - newAnchor.x, end.y - newAnchor.y) + direction * Math.PI / 2;
        if (upsideDown) angle += Math.PI;

        glyphs.push({
            anchor: new Anchor(newAnchor.x, newAnchor.y, anchor.angle, anchor.scale),
            offset: upsideDown ? Math.PI : 0,
            minScale: scale,
            maxScale: prevScale,
            angle: (angle + 2 * Math.PI) % (2 * Math.PI)
        });

        if (scale <= placementScale) break;

        newAnchor = end;

        // skip duplicate nodes
        while (newAnchor.equals(end)) {
            segment += direction;
            end = line[segment];
            if (!end) {
                anchor.scale = scale;
                return;
            }
        }

        var unit = end.sub(newAnchor)._unit();
        newAnchor = newAnchor.sub(unit._mult(distance));

        prevScale = scale;
    }
}
