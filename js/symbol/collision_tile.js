'use strict';

var rbush = require('rbush');

module.exports = CollisionTile;

function CollisionTile(zoom, tileExtent, tileSize) {
    this.zoom = zoom;
    this.tilePixelRatio = tileExtent / tileSize;
}

CollisionTile.prototype.minScale = 0.25;
CollisionTile.prototype.maxScale = 2;

CollisionTile.prototype.reset = function(angle, pitch) {
    this.tree = rbush();
    this.angle = angle;

    var sin = Math.sin(angle),
        cos = Math.cos(angle);
    this.rotationMatrix = [cos, -sin, sin, cos];

    // Stretch boxes in y direction to account for the map tilt.
    this.yStretch = 1 / Math.cos(pitch / 180 * Math.PI);

    // The amount the map is squished depends on the y position.
    // Sort of account for this by making all boxes a bit bigger.
    this.yStretch = Math.pow(this.yStretch, 1.3);
};

CollisionTile.prototype.placeFeature = function(feature) {

    var minPlacementScale = this.minScale;
    var rotationMatrix = this.rotationMatrix;
    var yStretch = this.yStretch;

    for (var b = 0; b < feature.boxes.length; b++) {

        var box = feature.boxes[b];

        var anchor = box.anchor.matMult(rotationMatrix);
        var x = anchor.x;
        var y = anchor.y;

        box[0] = x + box.x1;
        box[1] = y + box.y1 * yStretch;
        box[2] = x + box.x2;
        box[3] = y + box.y2 * yStretch;

        var blockingBoxes = this.tree.search(box);

        for (var i = 0; i < blockingBoxes.length; i++) {
            var blocking = blockingBoxes[i];
            var blockingAnchor = blocking.anchor.matMult(rotationMatrix);

            // Find the lowest scale at which the two boxes can fit side by side without overlapping.
            // Original algorithm:
            var s1 = (blocking.x1 - box.x2) / (x - blockingAnchor.x); // scale at which new box is to the left of old box
            var s2 = (blocking.x2 - box.x1) / (x - blockingAnchor.x); // scale at which new box is to the right of old box
            var s3 = (blocking.y1 - box.y2) * yStretch / (y - blockingAnchor.y); // scale at which new box is to the top of old box
            var s4 = (blocking.y2 - box.y1) * yStretch / (y - blockingAnchor.y); // scale at which new box is to the bottom of old box

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

            if (minPlacementScale >= this.maxScale) return minPlacementScale;
        }
    }

    return minPlacementScale;
};

CollisionTile.prototype.insertFeature = function(feature, minPlacementScale) {

    var boxes = feature.boxes;
    for (var k = 0; k < boxes.length; k++) {
        boxes[k].placementScale = minPlacementScale;
    }

    if (minPlacementScale < this.maxScale) {
        this.tree.load(boxes);
    }
};
