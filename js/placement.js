'use strict';

var util = require('./util');
var rotationRange = require('./rotationrange.js');
var console = require('./console.js');

module.exports = Placement;

function Placement(geometry, zoom, collision) {
    this.geometry = geometry;
    this.zoom = zoom;
    this.collision = collision;
}

Placement.prototype.addFeature = function(lines, info, faces, shaping) {
    var geometry = this.geometry;
    var glyphVertex = geometry.glyph;

    var horizontal = info.path === 'horizontal';
    var alignment = 'center';

    // Calculate the maximum scale we can go down in our fake-3d rtree so that
    // placement still makes sense. This is calculated so that the minimum
    // placement zoom can be at most 25.5 (we use an unsigned integer x10 to
    // store the minimum zoom).
    //
    // We don't want to place labels all the way to 25.5. This lets too many
    // glyphs be placed, slowing down collision checking. Only place labels if
    // they will show up within the intended zoom range of the tile.
    // TODO make this not hardcoded to 3
    var maxPlacementScale = Math.exp(Math.LN2 * Math.min((25.5 - this.zoom), 3));

    // street label size is 12 pixels, sdf glyph size is 24 pixels.
    // the minimum map tile size is 512, the extent is 4096
    // this value is calculated as: (4096/512) / (24/12)
    var fontScale = (4096 / 512) / (24 / info.fontSize);

    var anchors = getAnchors(lines);

    // Sort line segments by length so that we can start placement at
    // the longest line segment.
    anchors.sort(function(a, b) {
        return a.scale - b.scale;
    });

    for (var j = 0; j < anchors.length; j++) {
        var anchor = anchors[j];

        // Use the minimum scale from the place information. This shrinks the
        // bbox we query for immediately and we have less spurious collisions.
        //
        // Calculate the minimum placement scale we should start with based
        // on the length of the street segment.
        // TODO: extend the segment length if the adjacent segments are
        //       almost parallel to this segment.
        var placementScale = anchor.scale;

        if (placementScale > maxPlacementScale) {
            continue;
        }

        var advance = this.measureText(faces, shaping);
        var glyphs = getGlyphs(anchor, advance, shaping, faces, fontScale, horizontal, lines[anchor.line]);

        // Collision checks between rotating and fixed labels are
        // relatively expensive, so we use one box per label, not per glyph
        // for horizontal labels.
        var colliders = horizontal ? [getMergedGlyphs(glyphs, horizontal, anchor)] : glyphs;

        placementScale = this.collision.getPlacementScale(colliders, placementScale, maxPlacementScale);
        if (placementScale === null) continue;

        var placementRange = this.collision.getPlacementRange(colliders, placementScale, horizontal);

        this.collision.insert(colliders, anchor, placementScale, placementRange, horizontal);

        var placementZoom = this.zoom + Math.log(placementScale) / Math.LN2;

        // Once we're at this point in the loop, we know that we can place the label
        // and we're going to insert all all glyphs we remembered earlier.
        for (var k = 0; k < glyphs.length; k++) {
            var glyph = glyphs[k];
            var tl = glyph.tl, tr = glyph.tr, bl = glyph.bl, br = glyph.br;
            var tex = glyph.tex, width = glyph.width, height = glyph.height;
            var angle = glyph.angle;

            var minZoom = Math.max(this.zoom + Math.log(glyph.minScale) / Math.LN2, placementZoom);
            var maxZoom = Math.min(this.zoom + Math.log(glyph.maxScale) / Math.LN2, 25);
            var anchor = glyph.anchor;

            var box = glyph.box;
            var bbox = glyph.bbox;

            // first triangle
            glyphVertex.add(anchor.x, anchor.y, tl.x, tl.y, tex.x, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
            glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + width, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
            glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + height, angle, minZoom, placementRange, maxZoom, placementZoom);

            // second triangle
            glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + width, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
            glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + height, angle, minZoom, placementRange, maxZoom, placementZoom);
            glyphVertex.add(anchor.x, anchor.y, br.x, br.y, tex.x + width, tex.y + height, angle, minZoom, placementRange, maxZoom, placementZoom);
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

function getAnchors(lines) {

    var anchors = [];

    // Add the label for every line
    for (var j = 0; j < lines.length; j++) {
        var line = lines[j];

        // Place labels that only have one point.
        if (line.length === 1) {
            anchors.push({
                x: line[0].x,
                y: line[0].y,
                angle: 0,
                scale: 1
            });

        } else {
            // Make a list of all line segments in this
            var levels = 4;
            var f = Math.pow(2, 4 - levels);
            var textMinDistance = 250 * f;
            //var advance = this.measureText(faces, shaping) * f / 2;
            var interval = textMinDistance;// + advance;

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
                        line: j,
                        segment: k,
                        angle: angle
                    };

                    anchors.push(point);
                }

                distance += segmentDist;
            }

            for (var k = begin; k < anchors.length; k++) {
                // todo make sure there is enough space left at that scale
                var s = 8;
                var n = k - begin;
                if (n % 1 === 0) s = 8;
                if (n % 2 === 0) s = 4;
                if (n % 4 === 0) s = 2;
                if (n % 8 === 0) s = 1;
                anchors[k].scale = s;
            }

        }
    }

    return anchors;

}


function getGlyphs(anchor, advance, shaping, faces, fontScale, horizontal, line) {
    // The total text advance is the width of this label.

    // TODO: figure out correct ascender height.
    var origin = { x: 0, y: -17 };

    var alignment = 'center';
    // TODO: allow setting an alignment
    if (alignment == 'center') {
        origin.x -= advance / 2;
    } else if (alignment == 'right') {
        origin.x -= advance;
    }

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
            glyphInstances = getSegmentGlyphs(anchor, x, line, anchor.segment, 1).concat(getSegmentGlyphs(anchor, x, line, anchor.segment, -1));

        } else {
            // THIS IS TERRIBLE. TODO cleanup
            glyphInstances = [anchor];
            anchor.anchor = anchor;
            anchor.offset = 0;
            anchor.maxScale = Infinity;
            anchor.minScale = 1;
        }

        for (var i = 0; i < glyphInstances.length; i++) {
            var instance = glyphInstances[i];
            var newanchor = instance.anchor;
            // Clamp to -90/+90 degrees
            var angle = instance.angle;

            // Compute the transformation matrix.
            var sin = Math.sin(angle), cos = Math.cos(angle);
            var matrix = { a: cos, b: -sin, c: sin, d: cos };

            var x1 = origin.x + shape.x + glyph.left - buffer;
            var y1 = origin.y + shape.y - glyph.top - buffer;

            var x2 = x1 + width;
            var y2 = y1 + height;

            var tl = util.vectorMul(matrix, { x: x1, y: y1 });
            var tr = util.vectorMul(matrix, { x: x2, y: y1 });
            var bl = util.vectorMul(matrix, { x: x1, y: y2 });
            var br = util.vectorMul(matrix, { x: x2, y: y2 });

            // Calculate the rotated glyph's bounding box offsets from the
            // anchor point.
            var box = {
                x1: fontScale * Math.min(tl.x, tr.x, bl.x, br.x),
                y1: fontScale * Math.min(tl.y, tr.y, bl.y, br.y),
                x2: fontScale * Math.max(tl.x, tr.x, bl.x, br.x),
                y2: fontScale * Math.max(tl.y, tr.y, bl.y, br.y)
            };

            var bbox;

            if (horizontal) {
                var diag = Math.max(
                        util.vectorMag({ x: box.x1, y: box.y1 }),
                        util.vectorMag({ x: box.x1, y: box.y2 }),
                        util.vectorMag({ x: box.x2, y: box.y1 }),
                        util.vectorMag({ x: box.x2, y: box.y2 }));

                bbox = { x1: -diag, y1: -diag, x2: diag, y2: diag };
            } else {
                bbox = box;
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
                bbox: bbox,
                rotate: horizontal,
                angle: (anchor.angle + instance.offset + 2 * Math.PI) % (2 * Math.PI),
                minScale: instance.minScale,
                maxScale: instance.maxScale,
                anchor: newanchor
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
        bbox: { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity },
        rotate: horizontal,
        anchor: anchor,
        minScale: 0
    };

    var box = mergedglyphs.box;
    var bbox = mergedglyphs.bbox;

    for (var m = 0; m < glyphs.length; m++) {
        var gbbox = glyphs[m].bbox;
        var gbox = glyphs[m].box;
        box.x1 = Math.min(box.x1, gbox.x1);
        box.y1 = Math.min(box.y1, gbox.y1);
        box.x2 = Math.max(box.x2, gbox.x2);
        box.y2 = Math.max(box.y2, gbox.y2);
        bbox.x1 = bbox.y1 = Math.min(bbox.x1, gbbox.x1);
        bbox.x2 = bbox.y2 = Math.max(bbox.x2, gbbox.x2);
        mergedglyphs.minScale = Math.max(mergedglyphs.minScale, glyphs[m].minScale);
    }

    return mergedglyphs;
}

function getSegmentGlyphs(anchor, offset, line, segment, direction) {
    var glyphs = [];

    var upsideDown = direction < 0;

    if (offset < 0)  direction *= -1;

    if (direction > 0) segment++;

    var newAnchor = anchor;
    var end = line[segment];
    var prevscale = Infinity;

    offset = Math.abs(offset);

    var placementScale = anchor.scale;

    segment_loop:
    while (true) {
        var dist = util.dist(newAnchor, end);
        var scale = offset/dist;
        var angle = -Math.atan2(end.x - newAnchor.x, end.y - newAnchor.y) + direction * Math.PI / 2;
        if (upsideDown) angle += Math.PI;

        // Don't place around sharp corners
        //if (Math.abs(angle) > 3/8 * Math.PI) break;

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

        var unit = util.unit(util.vectorSub(end, newAnchor));
        newAnchor = util.vectorSub(newAnchor, { x: unit.x * dist, y: unit.y * dist });
        prevscale = scale;

    }

    glyphs.angleOffset = direction === 1 ? 0 : Math.PI;

    return glyphs;
}
