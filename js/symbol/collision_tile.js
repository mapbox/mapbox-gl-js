'use strict';

var rbush = require('rbush');

module.exports = CollisionTile;

function CollisionTile(zoom, tileExtent, tileSize) {
    this.zoom = zoom;
    this.tilePixelRatio = tileExtent / tileSize;
}

CollisionTile.prototype.minScale = 0.25;
CollisionTile.prototype.maxScale = 2;

CollisionTile.prototype.reset = function(angle) {
    this.tree = rbush();
    this.angle = angle;
};

CollisionTile.prototype.addLayer = function(placementLayer) {
    this.placementLayers.push(placementLayer);

    for (var i = 0; i < placementLayer.features.length; i++) {
        this.placeFeature(placementLayer.features[i]);
    }
};

CollisionTile.prototype.placeFeature = function(feature) {

    var minPlacementScale = this.minScale;
    var angle = this.angle;

    for (var b = 0; b < feature.boxes.length; b++) {

        var box = feature.boxes[b];

        var anchor = box.anchor.rotate(angle);
        var x = anchor.x;
        var y = anchor.y;

        box[0] = x + box.x1;
        box[1] = y + box.y1;
        box[2] = x + box.x2;
        box[3] = y + box.y2;

        var blockingBoxes = this.tree.search(box);

        for (var i = 0; i < blockingBoxes.length; i++) {
            var blocking = blockingBoxes[i];
            var blockingAnchor = blocking.anchor.rotate(angle);

            // Find the lowest scale at which the two boxes can fit side by side without overlapping.
            // Original algorithm:
            var s1 = (blocking.x1 - box.x2) / (x - blockingAnchor.x); // scale at which new box is to the left of old box
            var s2 = (blocking.x2 - box.x1) / (x - blockingAnchor.x); // scale at which new box is to the right of old box
            var s3 = (blocking.y1 - box.y2) / (y - blockingAnchor.y); // scale at which new box is to the top of old box
            var s4 = (blocking.y2 - box.y1) / (y - blockingAnchor.y); // scale at which new box is to the bottom of old box

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
