'use strict';

var rbush = require('rbush');

module.exports = Placement;

function Placement() {
    this.placementLayers = [];
    this.tree = rbush();
}

Placement.prototype.addLayer = function(placementLayer) {
    this.placementLayers.push(placementLayer);

    for (var i = 0; i < placementLayer.features.length; i++) {
        this.placeFeature(placementLayer.features[i]);
    }
};

Placement.prototype.placeFeature = function(feature) {

    var minScale = 0.25;
    var maxScale = 2;

    var minPlacementScale = minScale;
    var box;

    for (var b = 0; b < feature.boxes.length; b++) {

        box = feature.boxes[b];

        // TODO these should never be NaN
        if (isNaN(box.y) || isNaN(box.x)) continue;


        // calculate the box's bbox
        box[0] = box.x + box.x1;
        box[1] = box.y + box.y1;
        box[2] = box.x + box.x2;
        box[3] = box.y + box.y2;


        var na = box;
        var nb = box;

        var blockingBoxes = this.tree.search(box);

        for (var i = 0; i < blockingBoxes.length; i++) {
            var blocking = blockingBoxes[i];
            var oa = blocking;
            var ob = blocking;

            // Find the lowest scale at which the two boxes can fit side by side without overlapping.

            // Original algorithm:
            var s1 = (ob.x1 - nb.x2) / (na.x - oa.x); // scale at which new box is to the left of old box
            var s2 = (ob.x2 - nb.x1) / (na.x - oa.x); // scale at which new box is to the right of old box
            var s3 = (ob.y1 - nb.y2) / (na.y - oa.y); // scale at which new box is to the top of old box
            var s4 = (ob.y2 - nb.y1) / (na.y - oa.y); // scale at which new box is to the bottom of old box

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
        if (minPlacementScale < 2) {
            this.tree.insert(box);
        }
    }

};
