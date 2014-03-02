'use strict';

var util = require('../util/util.js');

module.exports = Placement;

function Placement(geometry, zoom, collision) {
    this.geometry = geometry;
    this.zoom = zoom;
    this.collision = collision;

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

var minScale = 0.125; // underscale by 3 zoom levels

function byScale(a, b) {
    return a.scale - b.scale;
}

Placement.prototype.addFeature = function(line, info, faces, shaping) {

    var horizontal = info.path === 'horizontal',
        padding = info.padding || 2,
        maxAngleDelta = info.maxAngleDelta || Math.PI,
        textMinDistance = info.textMinDistance || 250,
        rotate = info.rotate || 0,

        // street label size is 12 pixels, sdf glyph size is 24 pixels.
        // the minimum map tile size is 512, the extent is 4096
        // this value is calculated as: (4096/512) / (24/12)
        fontScale = (4096 / 512) / (24 / info.fontSize),

        anchors = getAnchors(line, textMinDistance);

    // Sort line segments by length so that we can start placement at
    // the longest line segment.
    anchors.sort(byScale);

    var advance = this.measureText(faces, shaping);

    for (var j = 0, len = anchors.length; j < len; j++) {
        var anchor = anchors[j];

        // Use the minimum scale from the place information. This shrinks the
        // bbox we query for immediately and we have less spurious collisions.
        //
        // Calculate the minimum placement scale we should start with based
        // on the length of the street segment.
        // TODO: extend the segment length if the adjacent segments are
        //       almost parallel to this segment.

        if (anchor.scale > this.maxPlacementScale) continue;

        var glyphs = getGlyphs(anchor, advance, shaping, faces, fontScale, horizontal, line, maxAngleDelta, rotate),
            glyphsLen = glyphs.length;

        // find the minimum scale the label could be displayed at
        var placementScale = Infinity;
        for (var m = 0; m < glyphsLen; m++) {
            placementScale = Math.max(Math.min(placementScale, glyphs[m].minScale), anchor.scale);
        }

        // Collision checks between rotating and fixed labels are
        // relatively expensive, so we use one box per label, not per glyph
        // for horizontal labels.
        var colliders = horizontal ? [getMergedGlyphs(glyphs, horizontal, anchor)] : glyphs;

        var place = this.collision.place(colliders, anchor, placementScale, this.maxPlacementScale, padding, horizontal);

        if (place === null) continue;

        // Once we're at this point in the loop, we know that we can place the label
        // and we're going to insert all all glyphs we remembered earlier.
        this.geometry.addGlyphs(glyphs, this.zoom + place.zoom, place.rotationRange, this.zoom);
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

function getAnchors(line, textMinDistance) {

    var anchors = [];

    // Place labels that only have one point.
    if (line.length === 1) {
        anchors.push({
            x: line[0].x,
            y: line[0].y,
            angle: 0,
            scale: minScale
        });

    } else {
        // Make a list of all line segments in this
        var levels = 4;
        var f = Math.pow(2, 4 - levels);
        var interval = textMinDistance * f;

        var distance = 0;
        var markedDistance = 0;

        var begin = anchors.length;
        for (var k = 0; k < line.length - 1; k++) {
            var b = line[k+1];
            var a = line[k];

            var segmentDist = util.dist(a, b);
            var angle = -Math.atan2(b.x - a.x, b.y - a.y) + Math.PI / 2;

            while (markedDistance + interval < distance + segmentDist) {
                markedDistance += interval;
                var segmentInterp = (markedDistance - distance)/ segmentDist;
                var point = {
                    x: util.interp(a.x, b.x, segmentInterp),
                    y: util.interp(a.y, b.y, segmentInterp),
                    segment: k,
                    angle: angle
                };

                // Only add anchors if they are within the current tile
                if (point.x >= 0 && point.x < 4096 && point.y >= 0 && point.y < 4096) {
                    anchors.push(point);
                }
            }

            distance += segmentDist;
        }

        for (var m = begin; m < anchors.length; m++) {
            // todo make sure there is enough space left at that scale
            var s = 8;
            var n = m - begin;
            if (n % 1 === 0) s = 8;
            if (n % 2 === 0) s = 4;
            if (n % 4 === 0) s = 2;
            if (n % 8 === 0) s = minScale;
            anchors[m].scale = s;
        }

    }

    return anchors;

}

function getGlyphs(anchor, advance, shaping, faces, fontScale, horizontal, line, maxAngleDelta, rotate) {
    // The total text advance is the width of this label.

    // TODO: figure out correct ascender height.
    var origin = { x: 0, y: -17 };

    origin.x -= advance / 2;

    // TODO: allow setting an alignment
    // var alignment = 'center';
    // if (alignment == 'center') {
    //     origin.x -= advance / 2;
    // } else if (alignment == 'right') {
    //     origin.x -= advance;
    // }

    var glyphs = [];

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
        if (typeof anchor.segment !== 'undefined') {
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

            otl = { x: x1, y: y1 },
            otr = { x: x2, y: y1 },
            obl = { x: x1, y: y2 },
            obr = { x: x2, y: y2 },

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
                    matrix = { a: cos, b: -sin, c: sin, d: cos };

                tl = util.vectorMul(matrix, tl);
                tr = util.vectorMul(matrix, tr);
                bl = util.vectorMul(matrix, bl);
                br = util.vectorMul(matrix, br);

                // Calculate the rotated glyph's bounding box offsets from the anchor point.
                box = {
                    x1: fontScale * Math.min(tl.x, tr.x, bl.x, br.x),
                    y1: fontScale * Math.min(tl.y, tr.y, bl.y, br.y),
                    x2: fontScale * Math.max(tl.x, tr.x, bl.x, br.x),
                    y2: fontScale * Math.max(tl.y, tr.y, bl.y, br.y)
                };
            }

            // Remember the glyph for later insertion.
            glyphs.push({
                tl: tl,
                tr: tr,
                bl: bl,
                br: br,
                tex: rect,
                width: width,
                height: height,
                box: box,
                rotate: horizontal,
                angle: (anchor.angle + rotate + instance.offset + 2 * Math.PI) % (2 * Math.PI),
                minScale: instance.minScale,
                maxScale: instance.maxScale,
                anchor: instance.anchor
            });
        }
    }

    // Prevent label from extending past the end of the line
    for (var m = 0; m < glyphs.length; m++) {
        var g = glyphs[m];
        g.minScale = Math.max(g.minScale, anchor.scale);
    }

    return glyphs;
}

function getMergedGlyphs(glyphs, horizontal, anchor) {

    var mergedglyphs = {
        box: { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity },
        rotate: horizontal,
        anchor: anchor,
        minScale: 0
    };

    var box = mergedglyphs.box;

    for (var m = 0; m < glyphs.length; m++) {
        var gbox = glyphs[m].box;
        box.x1 = Math.min(box.x1, gbox.x1);
        box.y1 = Math.min(box.y1, gbox.y1);
        box.x2 = Math.max(box.x2, gbox.x2);
        box.y2 = Math.max(box.y2, gbox.y2);
        mergedglyphs.minScale = Math.max(mergedglyphs.minScale, glyphs[m].minScale);
    }

    return mergedglyphs;
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
        var dist = util.dist(newAnchor, end);
        var scale = offset/dist;
        var angle = -Math.atan2(end.x - newAnchor.x, end.y - newAnchor.y) + direction * Math.PI / 2;
        if (upsideDown) angle += Math.PI;

        // Don't place around sharp corners
        var angleDiff = (angle - prevAngle) % (2 * Math.PI);
        if (prevAngle && angleDiff > maxAngleDelta) {
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
        while (newAnchor.x === end.x && newAnchor.y === end.y) {
            segment += direction;
            end = line[segment];

            if (!end) {
                anchor.scale = scale;
                break segment_loop;
            }
        }

        var normal = util.normal(newAnchor, end);
        newAnchor = {
            x: newAnchor.x - normal.x * dist,
            y: newAnchor.y - normal.y * dist
        };
        prevscale = scale;
        prevAngle = angle;

    }
}
