'use strict';

var interpolate = require('../geometry/interpolate.js'),
    Anchor = require('../geometry/anchor.js'),
    Point = require('../geometry/point.js'),
    Collision = require('./collision.js');

module.exports = Placement;

function Placement(geometry, zoom, tileSize) {
    this.geometry = geometry;
    this.zoom = zoom;
    this.collision = new Collision();
    this.tileSize = tileSize;
    this.zOffset = Math.log(256/this.tileSize) / Math.LN2;
    this.tileExtent = 4096;
    this.glyphSize = 24; // size in pixels of this glyphs in the tile

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

function byScale(a, b) {
    return a.scale - b.scale;
}

Placement.prototype.addFeature = function(line, info, faces, shaping) {

    var horizontal = info['text-path'] === 'horizontal',
        padding = info['text-padding'] || 2,
        maxAngleDelta = info['text-max-angle'] || Math.PI,
        textMinDistance = info['text-min-distance'] || 250,
        rotate = info['text-rotate'] || 0,
        fontScale = (this.tileExtent / this.tileSize) / (this.glyphSize / info['text-max-size']),

        advance = this.measureText(faces, shaping),
        anchors;

    // Point labels
    if (line.length === 1) {
        anchors = [new Anchor(line[0].x, line[0].y, 0, minScale)];

    // Line labels
    } else {
        anchors = interpolate(line, textMinDistance, minScale);

        // Sort anchors by segment so that we can start placement with the
        // anchors that can be shown at the lowest zoom levels.
        anchors.sort(byScale);
    }

    for (var j = 0, len = anchors.length; j < len; j++) {
        var anchor = anchors[j];
        var glyphs = getGlyphs(anchor, advance, shaping, faces, fontScale, horizontal, line, maxAngleDelta, rotate);
        var place = this.collision.place(
            glyphs.boxes, anchor, anchor.scale, this.maxPlacementScale, padding, horizontal, info['text-always-visible']);

        if (place) {
            this.geometry.addGlyphs(glyphs.glyphs, place.zoom, place.rotationRange, this.zoom - this.zOffset);
        }
    }
};

Placement.prototype.measureText = function(faces, shaping) {
    var advance = 0;

    // TODO: advance is not calculated correctly. we should instead use the
    // bounding box of the glyph placement.
    for (var i = 0; i < shaping.length; i++) {
        var shape = shaping[i];
        var glyph = faces[shape.face].glyphs[shape.glyph];
        if (glyph) {
            advance += glyph.advance;
        }
    }

    return advance;
};

function getGlyphs(anchor, advance, shaping, faces, fontScale, horizontal, line, maxAngleDelta, rotate) {
    // The total text advance is the width of this label.

    // TODO: figure out correct ascender height.
    var origin = new Point(-advance / 2, -17);

    // TODO: allow setting an alignment
    // var alignment = 'center';
    // if (alignment == 'center') {
    //     origin.x -= advance / 2;
    // } else if (alignment == 'right') {
    //     origin.x -= advance;
    // }

    var glyphs = [],
        boxes = [];

    var buffer = 3;

    for (var k = 0; k < shaping.length; k++) {
        var shape = shaping[k];
        var face = faces[shape.face];
        var glyph = face.glyphs[shape.glyph];
        var rect = face.rects[shape.glyph];

        if (!glyph) continue;

        var width = glyph.width;
        var height = glyph.height;

        if (!(width > 0 && height > 0 && rect)) continue;

        width += buffer * 2;
        height += buffer * 2;

        // Increase to next number divisible by 4, but at least 1.
        // This is so we can scale down the texture coordinates and pack them
        // into 2 bytes rather than 4 bytes.
        width += (4 - width % 4);
        height += (4 - height % 4);

        var x = (origin.x + shape.x + glyph.left - buffer + width / 2) * fontScale;

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
            x2 = x1 + width,
            y2 = y1 + height,

            otl = new Point(x1, y1),
            otr = new Point(x2, y1),
            obl = new Point(x1, y2),
            obr = new Point(x2, y2),

            obox = {
                x1: fontScale * x1,
                y1: fontScale * y1,
                x2: fontScale * x2,
                y2: fontScale * y2
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
                        x1: fontScale * Math.min(tl.x, tr.x, bl.x, br.x),
                        y1: fontScale * Math.min(tl.y, tr.y, bl.y, br.y),
                        x2: fontScale * Math.max(tl.x, tr.x, bl.x, br.x),
                        y2: fontScale * Math.max(tl.y, tr.y, bl.y, br.y)
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

    return {
        glyphs: glyphs,
        boxes: boxes
    };
}

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
