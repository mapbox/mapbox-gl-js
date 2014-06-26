'use strict';

var Point = require('point-geometry'),
    Collision = require('./collision.js');

module.exports = Placement;

function Placement(zoom, tileSize) {
    this.zoom = zoom;
    this.collision = new Collision(4096, tileSize);
    this.tileSize = tileSize;
    this.zOffset = Math.log(256/this.tileSize) / Math.LN2;
    this.tileExtent = 4096;
    this.glyphSize = 24; // size in pixels of this glyphs in the tile
    this.windowPixelRatio = 2; // TODO unhardcode

    // Calculate the maximum scale we can go down in our fake-3d rtree so that
    // placement still makes sense. This is calculated so that the minimum
    // placement zoom can be at most 25.5 (we use an unsigned integer x10 to
    // store the minimum zoom).
    //
    // We don't want to place labels all the way to 25.5. This lets too many
    // glyphs be placed, slowing down collision checking. Only place labels if
    // they will show up within the intended zoom range of the tile.
    // TODO make this not hardcoded to 3
    this.maxPlacementScale = Math.exp(Math.LN2 * Math.min((25.5 - this.zoom), 3));
}

var minScale = 0.5; // underscale by 1 zoom level

Placement.prototype.getIcon = function(result, anchor, image, boxScale) {

    var x = image.width / 2 / this.windowPixelRatio;
    var y = image.height / 2 / this.windowPixelRatio;
    var box = {
        x1: -x * boxScale,
        x2: x * boxScale,
        y1: -y * boxScale,
        y2: y * boxScale
    };

    result.boxes.push({
        box: box,
        anchor: anchor,
        minScale: 1,
        maxScale: Infinity
    });

    var tl = new Point(-x, -y);
    var tr = new Point(x, -y);
    var br = new Point(x, y);
    var bl = new Point(-x, y);
    result.icons.push({
        tl: tl,
        tr: tr,
        br: br,
        bl: bl,
        tex: image,
        angle: 0,
        anchor: anchor,
        minScale: 1,
        maxScale: Infinity
    });
};

Placement.prototype.getGlyphs = function getGlyphs(result, anchor, origin, shaping, faces, boxScale, horizontal, line, maxAngleDelta, rotate) {
    // The total text advance is the width of this label.


    var glyphs = result.glyphs,
        boxes = result.boxes;

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
        if (anchor.segment !== undefined) {
            glyphInstances = [];
            getSegmentGlyphs(glyphInstances, anchor, x, line, anchor.segment, 1, maxAngleDelta);
            getSegmentGlyphs(glyphInstances, anchor, x, line, anchor.segment, -1, maxAngleDelta);

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
                    maxScale: instance.maxScale
                });
            }
        }
    }
};

function getSegmentGlyphs(glyphs, anchor, offset, line, segment, direction, maxAngleDelta) {
    var upsideDown = direction < 0;

    if (offset < 0)  direction *= -1;

    if (direction > 0) segment++;

    var newAnchor = anchor;
    var end = line[segment];
    var prevscale = Infinity;
    var prevAngle;

    offset = Math.abs(offset);

    var placementScale = anchor.scale;

    segment_loop:
    while (true) {
        var dist = newAnchor.dist(end);
        var scale = offset/dist;
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
                break segment_loop;
            }
        }

        var unit = end.sub(newAnchor)._unit();
        newAnchor = newAnchor.sub(unit._mult(dist));

        prevscale = scale;
        prevAngle = angle;
    }
}
