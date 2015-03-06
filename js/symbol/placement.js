'use strict';

var Point = require('point-geometry');
var Anchor = require('../symbol/anchor');

module.exports = {
    getIcon: getIcon,
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

function getIcon(anchor, image, boxScale, line, layout) {

    var dx = layout['icon-offset'][0];
    var dy = layout['icon-offset'][1];
    var x1 = dx - image.originalWidth / 2;
    var x2 = x1 + image.w;
    var y1 = dy - image.originalHeight / 2;
    var y2 = y1 + image.h;

    var tl = new Point(x1, y1);
    var tr = new Point(x2, y1);
    var br = new Point(x2, y2);
    var bl = new Point(x1, y2);

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

        x1 = Math.min(tl.x, tr.x, bl.x, br.x);
        x2 = Math.max(tl.x, tr.x, bl.x, br.x);
        y1 = Math.min(tl.y, tr.y, bl.y, br.y);
        y2 = Math.max(tl.y, tr.y, bl.y, br.y);
    }
    var box = {
        x1: x1 * boxScale,
        x2: x2 * boxScale,
        y1: y1 * boxScale,
        y2: y2 * boxScale
    };

    var iconBox = {
        box: box,
        anchor: anchor,
        minScale: minScale,
        maxScale: Infinity,
        padding: layout['icon-padding']
    };

    var iconQuad = new SymbolQuad(anchor, tl, tr, bl, br, image, 0, minScale, Infinity);

    return {
        quads: [iconQuad],
        boxes: [iconBox]
    };
}

function getGlyphQuads(anchor, shaping, faces, boxScale, line, layout) {

    // the y offset *should* be part of the font metadata
    var yOffset = -17;

    var rotate = layout['text-rotate'] * Math.PI / 180;
    var alongLine = layout['text-rotation-alignment'] !== 'viewport' && anchor.segment !== undefined;
    var keepUpright = layout['text-keep-upright'];

    var positionedGlyphs = shaping.positionedGlyphs;
    var glyphs = [];

    for (var k = 0; k < positionedGlyphs.length; k++) {
        var shape = positionedGlyphs[k];
        var fontstack = faces[shape.fontstack];
        var glyph = fontstack.glyphs[shape.codePoint];
        var rect = glyph.rect;

        if (!glyph) continue;

        if (!(rect && rect.w > 0 && rect.h > 0)) continue;

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

        var x1 = shape.x + rect.left,
            y1 = shape.y - rect.top + yOffset,
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

                // Clamp to -90/+90 degrees
                angle = instance.angle + rotate;

            if (angle) {
                // Compute the transformation matrix.
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

            var glyphAngle = (anchor.angle + rotate + instance.offset + 2 * Math.PI) % (2 * Math.PI);
            glyphs.push(new SymbolQuad(instance.anchor, tl, tr, bl, br, rect, glyphAngle, glyphMinScale, instance.maxScale));

        }
    }

    return glyphs;
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
