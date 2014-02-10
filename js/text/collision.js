'use strict';

var rbush = require('rbush');
var rotationRange = require('./rotationrange.js');

module.exports = Collision;

function Collision() {
    this.tree = rbush(9, ['.x1', '.y1', '.x2', '.y2']);

    var m = 4096;
    // Hack to prevent cross-tile labels
    this.insert([{
        box: { x1: 0, y1: 0, x2: 0, y2: m * 8 },
        bbox: { x1: 0, y1: 0, x2: 0, y2: m * 8 },
        minScale: 0
    }, {
        box: { x1: 0, y1: 0, x2: m * 8, y2: 0 },
        bbox: { x1: 0, y1: 0, x2: m * 8, y2: 0 },
        minScale: 0
    }], { x: 0, y: 0 }, 1, [Math.PI * 2, 0], false);
    this.insert([{
        box: { x1: -m * 8, y1: 0, x2: 0, y2: 0 },
        bbox: { x1: -m * 8, y1: 0, x2: 0, y2: 0 },
        minScale: 0
    }, {
        box: { x1: 0, y1: -m * 8, x2: 0, y2: 0 },
        bbox: { x1: 0, y1: -m * 8, x2: 0, y2: 0 },
        minScale: 0
    }], { x: m, y: m }, 1, [Math.PI * 2, 0], false);


}


Collision.prototype.getPlacementScale = function(glyphs, minPlacementScale, maxPlacementScale) {

    for (var k = 0; k < glyphs.length; k++) {

        var glyph = glyphs[k];
        var bbox = glyph.bbox;
        var box = glyph.box;
        var anchor = glyph.anchor;

        if (anchor.x < 0 || anchor.x > 4096 || anchor.y < 0 || anchor.y > 4096) return null;

        var minScale = Math.max(minPlacementScale, glyph.minScale);
        var maxScale = glyph.maxScale || Infinity;

        if (minScale >= maxScale) continue;

        // Compute the scaled bounding box of the unrotated glyph
        var minPlacedX = anchor.x + bbox.x1 / minScale;
        var minPlacedY = anchor.y + bbox.y1 / minScale;
        var maxPlacedX = anchor.x + bbox.x2 / minScale;
        var maxPlacedY = anchor.y + bbox.y2 / minScale;

        var blocking = this.tree.search([ minPlacedX, minPlacedY, maxPlacedX, maxPlacedY ]);

        if (blocking.length) {

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

                var collisionFreeScale = Math.min(Math.max(s1, s2), Math.max(s3, s4));

                // Only update label's min scale if the glyph was restricted by a collision
                if (collisionFreeScale > minPlacementScale &&
                    collisionFreeScale > minScale &&
                    collisionFreeScale < maxScale &&
                    collisionFreeScale < blocking[l].maxScale) {
                    minPlacementScale = collisionFreeScale;
                }

                if (minPlacementScale > maxPlacementScale) {
                    return null;
                }
            }

        }
    }

    return minPlacementScale;
};

Collision.prototype.getPlacementRange = function(glyphs, placementScale) {

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

            var x1, x2, y1, y2, intersectX, intersectY;

            // Adjust and compare bboxes to see if the glyphs might intersect
            if (placementScale > b.placementScale) {
                x1 = b.anchor.x + b.bbox.x1 / placementScale;
                y1 = b.anchor.y + b.bbox.y1 / placementScale;
                x2 = b.anchor.x + b.bbox.x2 / placementScale;
                y2 = b.anchor.y + b.bbox.y2 / placementScale;
                intersectX = x1 < maxPlacedX && x2 > minPlacedX;
                intersectY = y1 < maxPlacedY && y2 > minPlacedY;
            } else {
                x1 = anchor.x + bbox.x1 / b.placementScale;
                y1 = anchor.y + bbox.y1 / b.placementScale;
                x2 = anchor.x + bbox.x2 / b.placementScale;
                y2 = anchor.y + bbox.y2 / b.placementScale;
                intersectX = x1 < b.x2 && x2 > b.x1;
                intersectY = y1 < b.y2 && y2 > b.y1;
            }

            // If they can't intersect, skip more expensive rotation calculation
            if (!(intersectX && intersectY)) continue;

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

    var allBounds = [];

    for (var k = 0; k < glyphs.length; k++) {

        var glyph = glyphs[k];
        var bbox = glyph.bbox;
        var box = glyph.box;

        var minScale = Math.max(placementScale, glyph.minScale);

        var bounds = {
            x1: anchor.x + bbox.x1 / minScale,
            y1: anchor.y + bbox.y1 / minScale,
            x2: anchor.x + bbox.x2 / minScale,
            y2: anchor.y + bbox.y2 / minScale,

            anchor: anchor,
            box: box,
            bbox: bbox,
            rotate: horizontal,
            placementRange: placementRange,
            placementScale: minScale,
            maxScale: glyph.maxScale || Infinity
        };

        allBounds.push(bounds);
    }

    this.tree.load(allBounds);

};
