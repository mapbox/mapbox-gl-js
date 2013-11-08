//'use strict';

var rbush = require('./lib/rbush.js');
var util = require('./util');
var rotationRange = require('./rotationrange.js');

module.exports = Collision;

function Collision() {
    this.tree = rbush(9, ['.x1', '.y1', '.x2', '.y2']);
}


Collision.prototype.getPlacementScale = function(glyphs, minPlacementScale, maxPlacementScale) {

    var placementScale = minPlacementScale;

    for (var k = 0; k < glyphs.length; k++) {

        var glyph = glyphs[k];
        var bbox = glyph.bbox;
        var box = glyph.box;
        var anchor = glyph.anchor;

        // Compute the scaled bounding box of the unrotated glyph
        var minPlacedX = anchor.x + bbox.x1 / placementScale;
        var minPlacedY = anchor.y + bbox.y1 / placementScale;
        var maxPlacedX = anchor.x + bbox.x2 / placementScale;
        var maxPlacedY = anchor.y + bbox.y2 / placementScale;

        // TODO: This is a hack to avoid placing labels across tile boundaries.
        if (minPlacedX < 0 || maxPlacedX < 0 || minPlacedX > 4095 || maxPlacedX > 4095 ||
                minPlacedY < 0 || maxPlacedY < 0 || minPlacedY > 4095 || maxPlacedY > 4095) {

            // Avoid placing anchors exactly at the tile boundary.
            if (anchor.x == 0 || anchor.y == 0 || anchor.x == 4096 || anchor.y == 4096) {
                return null;
            }

            var newPlacementScale = Math.max(
                    -bbox.x1 / anchor.x,
                    -bbox.y1 / anchor.y,
                    bbox.x2 / (4096 - anchor.x),
                    bbox.y2 / (4096 - anchor.y)
                    );

            // Only accept an increased placement scale if it actually
            // increases the scale.
            if (newPlacementScale <= placementScale || placementScale > maxPlacementScale) {
                return null;
            }

            placementScale = newPlacementScale;

            minPlacedX = anchor.x + bbox.x1 / placementScale;
            minPlacedY = anchor.y + bbox.y1 / placementScale;
            maxPlacedX = anchor.x + bbox.x2 / placementScale;
            maxPlacedY = anchor.y + bbox.y2 / placementScale;
        }

        var blocking = this.tree.search([ minPlacedX, minPlacedY, maxPlacedX, maxPlacedY ]);

        if (blocking.length) {
            // TODO: collission detection is not quite right yet.
            // continue with_next_segment;

            var na = anchor; // new anchor
            var nb = box; // new box

            for (var l = 0; l < blocking.length; l++) {
                var oa = blocking[l].anchor; // old anchor
                var ob = blocking[l].box; // old box

                // If anchors are identical, we're going to skip the label.
                // NOTE: this isn't right because there can be glyphs with
                // the same anchor but differing box offsets.
                if (na.x == oa.x && na.y == oa.y) {
                    return null;
                }

                var buffer = 20;

                // Original algorithm:
                var s1 = (ob.x1 - nb.x2 - buffer) / (na.x - oa.x); // scale at which new box is to the left of old box
                var s2 = (ob.x2 - nb.x1 + buffer) / (na.x - oa.x); // scale at which new box is to the right of old box
                var s3 = (ob.y1 - nb.y2 - buffer) / (na.y - oa.y); // scale at which new box is to the top of old box
                var s4 = (ob.y2 - nb.y1 + buffer) / (na.y - oa.y); // scale at which new box is to the bottom of old box

                if (isNaN(s1) || isNaN(s2)) s1 = s2 = 1;
                if (isNaN(s3) || isNaN(s4)) s3 = s4 = 1;

                placementScale = Math.max(placementScale, Math.min(Math.max(s1, s2), Math.max(s3, s4)));

                if (placementScale > maxPlacementScale) {
                    return null;
                }
            }

        }
    }

    return placementScale;
};

Collision.prototype.getPlacementRange = function(glyphs, placementScale, horizontal) {

    var placementRange = [2*Math.PI, 0];

    for (var k = 0; k < glyphs.length; k++) {
        var glyph = glyphs[k];
        var bbox = glyph.bbox;
        var anchor = glyph.anchor;

        var minPlacedX = anchor.x + bbox.x1 / placementScale;
        var minPlacedY = anchor.y + bbox.y1 / placementScale;
        var maxPlacedX = anchor.x + bbox.x2 / placementScale;
        var maxPlacedY = anchor.y + bbox.y2 / placementScale;

        var blocking = this.tree.search([ minPlacedX, minPlacedY, maxPlacedX, maxPlacedY ]);

        for (var l = 0; l < blocking.length; l++) {
            var b = blocking[l];

            var scale = Math.max(placementScale, b.placementScale);
            var range = rotationRange.rotationRange(glyph, b, scale);

            placementRange[0] = Math.min(placementRange[0], range[0]);
            placementRange[1] = Math.max(placementRange[1], range[1]);
        }
    }

    return placementRange;

};

// Insert glyph placements into rtree.
Collision.prototype.insert = function(glyphs, anchor, placementScale, placementRange, horizontal) {

    for (var k = 0; k < glyphs.length; k++) {

        var glyph = glyphs[k];
        var bbox = glyph.bbox;
        var box = glyph.box;

        var bounds = {
            x1: anchor.x + bbox.x1 / placementScale,
            y1: anchor.y + bbox.y1 / placementScale,
            x2: anchor.x + bbox.x2 / placementScale,
            y2: anchor.y + bbox.y2 / placementScale,

            anchor: anchor,
            box: box,
            rotate: horizontal,
            placementRange: placementRange,
            placementScale: placementScale
        };

        this.tree.insert(bounds);
    }

};
