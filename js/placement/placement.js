'use strict';

var rbush = require('rbush');

module.exports = Placement;

function Placement(zoom, tileExtent, tileSize) {
    this.zoom = zoom;
    this.tilePixelRatio = tileExtent / tileSize;
    this.placementLayers = [];
}

Placement.prototype.reset = function(angle) {
    this.tree = rbush();
    this.angle = angle;
    this.cosAngle = Math.cos(angle);
    this.sinAngle = Math.sin(angle);
};

Placement.prototype.addLayer = function(placementLayer) {
    this.placementLayers.push(placementLayer);

    for (var i = 0; i < placementLayer.features.length; i++) {
        this.placeFeature(placementLayer.features[i]);
    }
};

var minScale = 0.25;
var maxScale = 8;

Placement.prototype.placeFeature = function(feature) {

    var minPlacementScale = minScale;
    var box;

    var cosAngle = this.cosAngle;
    var sinAngle = this.sinAngle;

    for (var b = 0; b < feature.boxes.length; b++) {

        box = feature.boxes[b];

        // TODO these should never be NaN
        if (isNaN(box.y) || isNaN(box.x)) continue;

        var x = box.x * cosAngle - box.y * sinAngle;
        var y = box.x * sinAngle + box.y * cosAngle;

        // calculate the box's bbox
        box[0] = x + box.x1;
        box[1] = y + box.y1;
        box[2] = x + box.x2;
        box[3] = y + box.y2;


        var nb = box;

        var blockingBoxes = this.tree.search(box);

        for (var i = 0; i < blockingBoxes.length; i++) {
            var blocking = blockingBoxes[i];
            var ob = blocking;

            var ox = blocking.x * cosAngle - blocking.y * sinAngle;
            var oy = blocking.x * sinAngle + blocking.y * cosAngle;

            // Find the lowest scale at which the two boxes can fit side by side without overlapping.

            // Original algorithm:
            var s1 = (ob.x1 - nb.x2) / (x - ox); // scale at which new box is to the left of old box
            var s2 = (ob.x2 - nb.x1) / (x - ox); // scale at which new box is to the right of old box
            var s3 = (ob.y1 - nb.y2) / (y - oy); // scale at which new box is to the top of old box
            var s4 = (ob.y2 - nb.y1) / (y - oy); // scale at which new box is to the bottom of old box

            if (isNaN(s1) || isNaN(s2)) s1 = s2 = 1;
            if (isNaN(s3) || isNaN(s4)) s3 = s4 = 1;

            var collisionFreeScale = Math.min(Math.max(s1, s2), Math.max(s3, s4));

            if (collisionFreeScale > blocking.maxScale) {
                // After a box's maxScale the label has shrunk enough that the box is no longer needed to cover it,
                // so unblock the new box at the scale that the old box disappears.
                collisionFreeScale = blocking.maxScale;
            }

            if (collisionFreeScale > box.maxScale) {
                // If the box can only be shown after it is visible, then the box can never be shown.
                // But the label can be shown after this box is not visible.
                collisionFreeScale = box.maxScale;
            }

            if (collisionFreeScale > minPlacementScale &&
                    collisionFreeScale >= blocking.placementScale) {
                // If this collision occurs at a lower scale than previously found collisions
                // and the collision occurs while the other label is visible

                // this this is the lowest scale at which the label won't collide with anything
                minPlacementScale = collisionFreeScale;
            }

            // TODO:
            // break out of outer loop if minPlacementScale > maxScale
        }

        if (minPlacementScale >= maxScale) break;
    }

    return minPlacementScale;
};

Placement.prototype.insertFeature = function(feature, minPlacementScale) {

    for (var k = 0; k < feature.boxes.length; k++) {
        var box = feature.boxes[k];
        if (isNaN(box.y) || isNaN(box.x)) continue;
        box.placementScale = minPlacementScale;
        if (minPlacementScale < maxScale) {
            this.tree.insert(box);
        }
    }

};
