'use strict';

var rbush = require('rbush');
var CollisionBox = require('./collision_box');
var Point = require('point-geometry');

module.exports = CollisionTile;

/**
 * A collision tile used to prevent symbols from overlapping. It keep tracks of
 * where previous symbols have been placed and is used to check if a new
 * symbol overlaps with any previously added symbols.
 *
 * @class CollisionTile
 * @param {number} angle
 * @param {number} pitch
 * @private
 */
function CollisionTile(angle, pitch, extent) {
    this.tree = rbush();
    this.angle = angle;

    var sin = Math.sin(angle),
        cos = Math.cos(angle);
    this.rotationMatrix = [cos, -sin, sin, cos];
    this.reverseRotationMatrix = [cos, sin, -sin, cos];

    // Stretch boxes in y direction to account for the map tilt.
    this.yStretch = 1 / Math.cos(pitch / 180 * Math.PI);

    // The amount the map is squished depends on the y position.
    // Sort of account for this by making all boxes a bit bigger.
    this.yStretch = Math.pow(this.yStretch, 1.3);

    this.edges = [
        //left
        new CollisionBox(new Point(0, 0), 0, -Infinity, 0, Infinity, Infinity),
        // right
        new CollisionBox(new Point(extent, 0), 0, -Infinity, 0, Infinity, Infinity),
        // top
        new CollisionBox(new Point(0, 0), -Infinity, 0, Infinity, 0, Infinity),
        // bottom
        new CollisionBox(new Point(0, extent), -Infinity, 0, Infinity, 0, Infinity)
    ];
}

CollisionTile.prototype.minScale = 0.25;
CollisionTile.prototype.maxScale = 2;


/**
 * Find the scale at which the collisionFeature can be shown without
 * overlapping with other features.
 *
 * @param {CollisionFeature} collisionFeature
 * @returns {number} placementScale
 * @private
 */
CollisionTile.prototype.placeCollisionFeature = function(collisionFeature, allowOverlap, avoidEdges) {

    var minPlacementScale = this.minScale;
    var rotationMatrix = this.rotationMatrix;
    var yStretch = this.yStretch;

    for (var b = 0; b < collisionFeature.boxes.length; b++) {

        var box = collisionFeature.boxes[b];

        if (!allowOverlap) {
            var anchorPoint = box.anchorPoint.matMult(rotationMatrix);
            var x = anchorPoint.x;
            var y = anchorPoint.y;

            box[0] = x + box.x1;
            box[1] = y + box.y1 * yStretch;
            box[2] = x + box.x2;
            box[3] = y + box.y2 * yStretch;

            var blockingBoxes = this.tree.search(box);

            for (var i = 0; i < blockingBoxes.length; i++) {
                var blocking = blockingBoxes[i];
                var blockingAnchorPoint = blocking.anchorPoint.matMult(rotationMatrix);

                minPlacementScale = this.getPlacementScale(minPlacementScale, anchorPoint, box, blockingAnchorPoint, blocking);
                if (minPlacementScale >= this.maxScale) {
                    return minPlacementScale;
                }
            }
        }

        if (avoidEdges) {
            var reverseRotationMatrix = this.reverseRotationMatrix;
            var tl = new Point(box.x1, box.y1).matMult(reverseRotationMatrix);
            var tr = new Point(box.x2, box.y1).matMult(reverseRotationMatrix);
            var bl = new Point(box.x1, box.y2).matMult(reverseRotationMatrix);
            var br = new Point(box.x2, box.y2).matMult(reverseRotationMatrix);
            var rotatedCollisionBox = new CollisionBox(box.anchorPoint,
                    Math.min(tl.x, tr.x, bl.x, br.x),
                    Math.min(tl.y, tr.x, bl.x, br.x),
                    Math.max(tl.x, tr.x, bl.x, br.x),
                    Math.max(tl.y, tr.x, bl.x, br.x),
                    box.maxScale);

            for (var k = 0; k < this.edges.length; k++) {
                var edgeBox = this.edges[k];
                minPlacementScale = this.getPlacementScale(minPlacementScale, box.anchorPoint, rotatedCollisionBox, edgeBox.anchorPoint, edgeBox);
                if (minPlacementScale >= this.maxScale) {
                    return minPlacementScale;
                }
            }
        }
    }

    return minPlacementScale;
};


CollisionTile.prototype.getPlacementScale = function(minPlacementScale, anchorPoint, box, blockingAnchorPoint, blocking) {

    // Find the lowest scale at which the two boxes can fit side by side without overlapping.
    // Original algorithm:
    var s1 = (blocking.x1 - box.x2) / (anchorPoint.x - blockingAnchorPoint.x); // scale at which new box is to the left of old box
    var s2 = (blocking.x2 - box.x1) / (anchorPoint.x - blockingAnchorPoint.x); // scale at which new box is to the right of old box
    var s3 = (blocking.y1 - box.y2) * this.yStretch / (anchorPoint.y - blockingAnchorPoint.y); // scale at which new box is to the top of old box
    var s4 = (blocking.y2 - box.y1) * this.yStretch / (anchorPoint.y - blockingAnchorPoint.y); // scale at which new box is to the bottom of old box

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

    return minPlacementScale;
};


/**
 * Remember this collisionFeature and what scale it was placed at to block
 * later features from overlapping with it.
 *
 * @param {CollisionFeature} collisionFeature
 * @param {number} minPlacementScale
 * @private
 */
CollisionTile.prototype.insertCollisionFeature = function(collisionFeature, minPlacementScale) {

    var boxes = collisionFeature.boxes;
    for (var k = 0; k < boxes.length; k++) {
        boxes[k].placementScale = minPlacementScale;
    }

    if (minPlacementScale < this.maxScale) {
        this.tree.load(boxes);
    }
};
