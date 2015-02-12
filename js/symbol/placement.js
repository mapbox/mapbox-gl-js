'use strict';

var Point = require('point-geometry');

module.exports = {
    getIcon: getIcon,
    getGlyphs: getGlyphs
};

var minScale = 0.5; // underscale by 1 zoom level

function getIcon(anchor, image, boxScale, line, props) {

    var dx = props['icon-offset'][0];
    var dy = props['icon-offset'][1];
    var x1 = dx - image.originalWidth / 2;
    var x2 = x1 + image.w;
    var y1 = dy - image.originalHeight / 2;
    var y2 = y1 + image.h;

    var tl = new Point(x1, y1);
    var tr = new Point(x2, y1);
    var br = new Point(x2, y2);
    var bl = new Point(x1, y2);

    var angle = props['icon-rotate'] * Math.PI / 180;
    if (anchor.segment !== undefined && props['icon-rotation-alignment'] !== 'viewport') {
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
        padding: props['icon-padding']
    };

    var icon = {
        tl: tl,
        tr: tr,
        br: br,
        bl: bl,
        tex: image,
        angle: 0,
        anchor: anchor,
        minScale: minScale,
        maxScale: Infinity
    };

    return {
        shapes: [icon],
        boxes: [iconBox],
        minScale: anchor.scale
    };
}

function getGlyphs(anchor, origin, shaping, faces, boxScale, horizontal, line, props) {

    var maxAngleDelta = props['text-max-angle'] * Math.PI / 180;
    var rotate = props['text-rotate'] * Math.PI / 180;
    var padding = props['text-padding'];
    var alongLine = props['text-rotation-alignment'] !== 'viewport';
    var keepUpright = props['text-keep-upright'];

    var glyphs = [],
        boxes = [];

    var buffer = 3;

    for (var k = 0; k < shaping.length; k++) {
        var shape = shaping[k];
        var fontstack = faces[shape.fontstack];
        var glyph = fontstack.glyphs[shape.glyph];
        var rect = fontstack.rects[shape.glyph];

        if (!glyph) continue;

        if (!(rect && rect.w > 0 && rect.h > 0)) continue;

        var x = (origin.x + shape.x + glyph.left - buffer + rect.w / 2) * boxScale;

        var glyphInstances;
        if (anchor.segment !== undefined && alongLine) {
            glyphInstances = [];
            getSegmentGlyphs(glyphInstances, anchor, x, line, anchor.segment, 1, maxAngleDelta);
            if (keepUpright) getSegmentGlyphs(glyphInstances, anchor, x, line, anchor.segment, -1, maxAngleDelta);

        } else {
            glyphInstances = [{
                anchor: anchor,
                offset: 0,
                angle: 0,
                maxScale: Infinity,
                minScale: minScale
            }];
        }

        var x1 = origin.x + shape.x + glyph.left - buffer,
            y1 = origin.y + shape.y - glyph.top - buffer,
            x2 = x1 + rect.w,
            y2 = y1 + rect.h,

            otl = new Point(x1, y1),
            otr = new Point(x2, y1),
            obl = new Point(x1, y2),
            obr = new Point(x2, y2);

        var obox = {
                x1: boxScale * x1,
                y1: boxScale * y1,
                x2: boxScale * x2,
                y2: boxScale * y2
            };

        for (var i = 0; i < glyphInstances.length; i++) {

            var instance = glyphInstances[i],

                tl = otl,
                tr = otr,
                bl = obl,
                br = obr,
                box = obox,

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

            // Remember the glyph for later insertion.
            glyphs.push({
                tl: tl,
                tr: tr,
                bl: bl,
                br: br,
                tex: rect,
                angle: (anchor.angle + rotate + instance.offset + 2 * Math.PI) % (2 * Math.PI),
                anchor: instance.anchor,
                minScale: glyphMinScale,
                maxScale: instance.maxScale
            });

            if (!instance.offset) { // not a flipped glyph
                if (angle) {
                    // Calculate the rotated glyph's bounding box offsets from the anchor point.
                    box = {
                        x1: boxScale * Math.min(tl.x, tr.x, bl.x, br.x),
                        y1: boxScale * Math.min(tl.y, tr.y, bl.y, br.y),
                        x2: boxScale * Math.max(tl.x, tr.x, bl.x, br.x),
                        y2: boxScale * Math.max(tl.y, tr.y, bl.y, br.y)
                    };
                }
                boxes.push({
                    box: box,
                    anchor: instance.anchor,
                    minScale: glyphMinScale,
                    maxScale: instance.maxScale,
                    padding: padding
                });
            }
        }
    }

    // TODO avoid creating the boxes in the first place?
    if (horizontal) boxes = [getMergedBoxes(boxes, anchor)];

    var minPlacementScale = anchor.scale;
    var minGlyphScale = Infinity;
    for (var m = 0; m < boxes.length; m++) {
        minGlyphScale = Math.min(minGlyphScale, boxes[m].minScale);
    }
    minGlyphScale = Math.max(minPlacementScale, minScale);

    return {
        boxes: boxes,
        shapes: glyphs,
        minScale: minGlyphScale
    };
}

function getSegmentGlyphs(glyphs, anchor, offset, line, segment, direction, maxAngleDelta) {
    var upsideDown = direction < 0;

    if (offset < 0) direction *= -1;

    if (direction > 0) segment++;

    var newAnchor = anchor;
    var end = line[segment];
    var prevscale = Infinity;
    var prevAngle;

    offset = Math.abs(offset);

    var placementScale = anchor.scale;

    while (true) {
        var dist = newAnchor.dist(end);
        var scale = offset / dist;
        var angle = -Math.atan2(end.x - newAnchor.x, end.y - newAnchor.y) + direction * Math.PI / 2;
        if (upsideDown) angle += Math.PI;

        // Don't place around sharp corners
        var angleDiff = (angle - prevAngle) % (2 * Math.PI);
        if (prevAngle && Math.abs(angleDiff) > maxAngleDelta) {
            anchor.scale = prevscale;
            break;
        }

        glyphs.push({
            anchor: newAnchor,
            offset: upsideDown ? Math.PI : 0,
            minScale: scale,
            maxScale: prevscale,
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
        newAnchor = newAnchor.sub(unit._mult(dist));

        prevscale = scale;
        prevAngle = angle;
    }
}

function getMergedBoxes(glyphs, anchor) {
      // Collision checks between rotating and fixed labels are relatively expensive,
      // so we use one box per label, not per glyph for horizontal labels.

    var mergedglyphs = {
        box: { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity },
        anchor: anchor,
        minScale: 0,
        padding: -Infinity
    };

    var box = mergedglyphs.box;

    for (var m = 0; m < glyphs.length; m++) {
        var gbox = glyphs[m].box;
        box.x1 = Math.min(box.x1, gbox.x1);
        box.y1 = Math.min(box.y1, gbox.y1);
        box.x2 = Math.max(box.x2, gbox.x2);
        box.y2 = Math.max(box.y2, gbox.y2);
        mergedglyphs.minScale = Math.max(mergedglyphs.minScale, glyphs[m].minScale);
        mergedglyphs.padding = Math.max(mergedglyphs.padding, glyphs[m].padding);
    }
    // for all horizontal labels, calculate bbox covering all rotated positions
    var x12 = box.x1 * box.x1,
        y12 = box.y1 * box.y1,
        x22 = box.x2 * box.x2,
        y22 = box.y2 * box.y2,
        diag = Math.sqrt(Math.max(x12 + y12, x12 + y22, x22 + y12, x22 + y22));

    mergedglyphs.hBox = {
        x1: -diag,
        y1: -diag,
        x2: diag,
        y2: diag
    };

    return mergedglyphs;
}
