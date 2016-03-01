'use strict';

var CollisionBox = require('./collision_box');
var Point = require('point-geometry');
var EXTENT = require('../data/bucket').EXTENT;
var Grid = require('../util/grid');

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
function CollisionTile(angle, pitch) {
    this.grid = new Grid(12, EXTENT, 6);
    this.gridFeatures = [];
    this.ignoredGrid = new Grid(12, EXTENT, 0);
    this.ignoredGridFeatures = [];

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
        new CollisionBox(new Point(EXTENT, 0), 0, -Infinity, 0, Infinity, Infinity),
        // top
        new CollisionBox(new Point(0, 0), -Infinity, 0, Infinity, 0, Infinity),
        // bottom
        new CollisionBox(new Point(0, EXTENT), -Infinity, 0, Infinity, 0, Infinity)
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

            var blockingBoxes = this.grid.query(box);

            for (var i = 0; i < blockingBoxes.length; i++) {
                var blocking = this.gridFeatures[blockingBoxes[i]];
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

CollisionTile.prototype.getFeaturesAt = function(queryBox, scale) {
    var features = [];
    var result = [];

    var rotationMatrix = this.rotationMatrix;
    var anchorPoint = queryBox.anchorPoint.matMult(rotationMatrix);

    var searchBox = [
        anchorPoint.x + queryBox.x1 / scale,
        anchorPoint.y + queryBox.y1 / scale * this.yStretch,
        anchorPoint.x + queryBox.x2 / scale,
        anchorPoint.y + queryBox.y2 / scale * this.yStretch
    ];

    var blockingBoxes = [];
    var blockingBoxKeys = this.grid.query(searchBox);
    for (var j = 0; j < blockingBoxKeys.length; j++) {
        blockingBoxes.push(this.gridFeatures[blockingBoxKeys[j]]);
    }
    blockingBoxKeys = this.ignoredGrid.query(searchBox);
    for (var k = 0; k < blockingBoxKeys.length; k++) {
        blockingBoxes.push(this.ignoredGridFeatures[blockingBoxKeys[k]]);
    }

    for (var i = 0; i < blockingBoxes.length; i++) {
        var blocking = blockingBoxes[i];
        var blockingAnchorPoint = blocking.anchorPoint.matMult(rotationMatrix);
        var minPlacementScale = this.getPlacementScale(this.minScale, anchorPoint, queryBox, blockingAnchorPoint, blocking);
        if (minPlacementScale >= scale) {
            if (features.indexOf(blocking.feature) < 0) {
                features.push(blocking.feature);
                result.push({
                    feature: blocking.feature,
                    layerIDs: blocking.layerIDs
                });
            }
        }
    }

    return result;
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
CollisionTile.prototype.insertCollisionFeature = function(collisionFeature, minPlacementScale, ignorePlacement) {

    var boxes = collisionFeature.boxes;
    for (var k = 0; k < boxes.length; k++) {
        boxes[k].placementScale = minPlacementScale;
    }

    if (minPlacementScale < this.maxScale) {
        if (ignorePlacement) {
            this.insertIgnoredGrid(boxes);
        } else {
            this.insertGrid(boxes);
        }
    }
};

CollisionTile.prototype.insertGrid = function(boxes) {
    for (var i = 0; i < boxes.length; i++) {
        var box = boxes[i];
        this.grid.insert(box, this.gridFeatures.length);
        this.gridFeatures.push(box);
    }
};

CollisionTile.prototype.insertIgnoredGrid = function(boxes) {
    for (var i = 0; i < boxes.length; i++) {
        var box = boxes[i];
        this.ignoredGrid.insert(box, this.ignoredGridFeatures.length);
        this.ignoredGridFeatures.push(box);
    }
};
