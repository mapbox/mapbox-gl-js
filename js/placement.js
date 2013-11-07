'use strict';

var rbush = require('./lib/rbush.js');
var util = require('./util');
var rotationRange = require('./rotationrange.js');

module.exports = Placement;

function Placement(geometry, zoom, collision) {
    this.geometry = geometry;
    this.zoom = zoom;
    this.collision = collision;
}

Placement.prototype.parseTextBucket = function(features, bucket, info, faces, layer, callback) {
    // console.time('label placement');
    var geometry = this.geometry;

    // TODO: currently hardcoded to use the first font stack.
    // Get the list of shaped labels for this font stack.
    var stack = Object.keys(layer.shaping)[0];
    var shapingDB = layer.shaping[stack];
    if (!shapingDB) return callback();

    var horizontal = info.path === 'horizontal';

    var glyphVertex = geometry.glyph;

    bucket.glyphVertexIndex = glyphVertex.index;

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

    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var text = feature[info.field];
        if (!text) continue;
        var shaping = shapingDB[text];

        var segments = [];

        // Add the label for every line
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            var line = lines[j];

            // Place labels that only have one point.
            if (line.length === 1) {
                segments.push({
                    x1: line[0].x - 1,
                    y1: line[0].y,
                    x2: line[0].x + 1,
                    y2: line[0].y,
                    length: Infinity
                });
            } else {
                // Make a list of all line segments in this
                var prev = line[0];
                for (var k = 1; k < line.length; k++) {
                    var current = line[k];
                    segments.push({
                        x1: prev.x,
                        y1: prev.y,
                        x2: current.x,
                        y2: current.y,
                        length: util.distance_squared(prev, current)
                    });
                    prev = current;
                }
            }
        }

        // Sort line segments by length so that we can start placement at
        // the longest line segment.
        segments.sort(function(a, b) {
            return b.length - a.length;
        });

    with_next_segment:
        for (var j = 0; j < segments.length; j++) {
            var segment = segments[j];

            // TODO: set minimum placement scale so that it is far enough away from an existing label with the same name
            // This avoids repetive labels, e.g. on bridges or roads with multiple carriage ways.

            // street label size is 12 pixels, sdf glyph size is 24 pixels.
            // the minimum map tile size is 512, the extent is 4096
            // this value is calculated as: (4096/512) / (24/12)
            var fontScale = 4;
            var fontScale = (4096 / 512) / (24 / info.fontSize);

            // Use the minimum scale from the place information. This shrinks the
            // bbox we query for immediately and we have less spurious collisions.
            var placementScale = 1;

            // The total text advance is the width of this label.
            var advance = this.measureText(faces, shaping);

            // Calculate the minimum placement scale we should start with based
            // on the length of the street segment.
            // TODO: extend the segment length if the adjacent segments are
            //       almost parallel to this segment.
            placementScale = Math.max(1, advance * fontScale * 1.1 / Math.sqrt(segment.length));
            if (placementScale > maxPlacementScale) {
                continue with_next_segment;
            }

            // Find the center of that line segment and define at as the
            // center point of the label. For that line segment, we can now
            // compute the angle of the label (and optionally invert it if the
            var a = { x: segment.x1, y: segment.y1 }, b = { x: segment.x2, y: segment.y2 };
            var anchor = util.line_center(a, b);

            // Clamp to -90/+90 degrees
            var angle = -Math.atan2(b.x - a.x, b.y - a.y) + Math.PI / 2;
            angle = util.clamp_horizontal(angle);

            // Compute the transformation matrix.
            var sin = Math.sin(angle), cos = Math.cos(angle);
            var matrix = { a: cos, b: -sin, c: sin, d: cos };

            // TODO: figure out correct ascender height.
            var origin = { x: 0, y: -17 };

            // TODO: allow setting an alignment
            var alignment = 'center';
            if (alignment == 'center') {
                origin.x -= advance / 2;
            } else if (alignment == 'right') {
                origin.x -= advance;
            }

            var glyphs = [];

            var buffer = 3;

        with_next_glyph:
            for (var k = 0; k < shaping.length; k++) {
                var shape = shaping[k];
                var face = faces[shape.face];
                var glyph = face.glyphs[shape.glyph];
                var rect = face.rects[shape.glyph];

                if (!glyph) continue with_next_glyph;

                var width = glyph.width;
                var height = glyph.height;

                if (width > 0 && height > 0 && rect) {
                    width += buffer * 2;
                    height += buffer * 2;

                    // Increase to next number divisible by 4, but at least 1.
                    // This is so we can scale down the texture coordinates and pack them
                    // into 2 bytes rather than 4 bytes.
                    width += (4 - width % 4);
                    height += (4 - height % 4);

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
                        anchor: anchor
                    });
                }
            }

            placementScale = this.collision.getPlacementScale(glyphs, placementScale, maxPlacementScale);
            if (placementScale === null) continue with_next_segment;

            var placementZoom = this.zoom + Math.log(placementScale) / Math.LN2;
            var placementRange = this.collision.getPlacementRange(glyphs, placementScale, horizontal);

            this.collision.insert(glyphs, anchor, placementScale, placementRange, horizontal);

            // Once we're at this point in the loop, we know that we can place the label
            // and we're going to insert all all glyphs we remembered earlier.
            for (var k = 0; k < glyphs.length; k++) {
                var glyph = glyphs[k];
                var tl = glyph.tl, tr = glyph.tr, bl = glyph.bl, br = glyph.br;
                var tex = glyph.tex, width = glyph.width, height = glyph.height;

               var box = glyph.box;
               var bbox = glyph.bbox;
 
                // first triangle
                glyphVertex.add(anchor.x, anchor.y, tl.x, tl.y, tex.x, tex.y, angle, placementZoom, placementRange);
                glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + width, tex.y, angle, placementZoom, placementRange);
                glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + height, angle, placementZoom, placementRange);

                // second triangle
                glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + width, tex.y, angle, placementZoom, placementRange);
                glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + height, angle, placementZoom, placementRange);
                glyphVertex.add(anchor.x, anchor.y, br.x, br.y, tex.x + width, tex.y + height, angle, placementZoom, placementRange);
            }
        }
    }

    // Remember the glyph
    bucket.glyphVertexIndexEnd = glyphVertex.index;

    // console.timeEnd('label placement');
    callback();
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

