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

function getIconQuads(anchor, shapedIcon, boxScale, line, layout, alongLine) {

    var tl = new Point(shapedIcon.left, shapedIcon.top);
    var tr = new Point(shapedIcon.right, shapedIcon.top);
    var br = new Point(shapedIcon.right, shapedIcon.bottom);
    var bl = new Point(shapedIcon.left, shapedIcon.bottom);

    var angle = layout['icon-rotate'] * Math.PI / 180;
    if (alongLine) {
        var prev = line[anchor.segment];
        angle += Math.atan2(anchor.y - prev.y, anchor.x - prev.x);
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
            labelMinScale = getSegmentGlyphs(glyphInstances, anchor, centerX, line, anchor.segment, 1);
            if (keepUpright) {
                labelMinScale = Math.min(labelMinScale, getSegmentGlyphs(glyphInstances, anchor, centerX, line, anchor.segment, -1));
            }

        } else {
            glyphInstances = [{
                anchor: anchor,
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

    var placementScale = minScale;

    while (true) {
        var distance = newAnchor.dist(end);
        var scale = offset / distance;

        // Get the angle of the line segment
        var angle = Math.atan2(end.y - newAnchor.y, end.x - newAnchor.x);
        if (direction < 0) angle += Math.PI;
        if (upsideDown) angle += Math.PI;

        glyphs.push({
            anchor: new Anchor(newAnchor.x, newAnchor.y, anchor.angle),
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
                return scale;
            }
        }

        var unit = end.sub(newAnchor)._unit();
        newAnchor = newAnchor.sub(unit._mult(distance));

        prevScale = scale;
    }

    return placementScale;
}
