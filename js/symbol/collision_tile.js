'use strict';

const Point = require('point-geometry');
const EXTENT = require('../data/bucket').EXTENT;
const Grid = require('grid-index');

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
function CollisionTile(angle, pitch, collisionBoxArray) {
    if (typeof angle === 'object') {
        const serialized = angle;
        collisionBoxArray = pitch;
        angle = serialized.angle;
        pitch = serialized.pitch;
        this.grid = new Grid(serialized.grid);
        this.ignoredGrid = new Grid(serialized.ignoredGrid);
    } else {
        this.grid = new Grid(EXTENT, 12, 6);
        this.ignoredGrid = new Grid(EXTENT, 12, 0);
    }

    this.angle = angle;
    this.pitch = pitch;

    const sin = Math.sin(angle),
        cos = Math.cos(angle);
    this.rotationMatrix = [cos, -sin, sin, cos];
    this.reverseRotationMatrix = [cos, sin, -sin, cos];

    // Stretch boxes in y direction to account for the map tilt.
    this.yStretch = 1 / Math.cos(pitch / 180 * Math.PI);

    // The amount the map is squished depends on the y position.
    // Sort of account for this by making all boxes a bit bigger.
    this.yStretch = Math.pow(this.yStretch, 1.3);

    this.collisionBoxArray = collisionBoxArray;
    if (collisionBoxArray.length === 0) {
        // the first collisionBoxArray is passed to a CollisionTile

        // tempCollisionBox
        collisionBoxArray.emplaceBack();

        const maxInt16 = 32767;
        //left
        collisionBoxArray.emplaceBack(0, 0, 0, -maxInt16, 0, maxInt16, maxInt16,
                0, 0, 0, 0, 0, 0, 0, 0,
                0);
        // right
        collisionBoxArray.emplaceBack(EXTENT, 0, 0, -maxInt16, 0, maxInt16, maxInt16,
                0, 0, 0, 0, 0, 0, 0, 0,
                0);
        // top
        collisionBoxArray.emplaceBack(0, 0, -maxInt16, 0, maxInt16, 0, maxInt16,
                0, 0, 0, 0, 0, 0, 0, 0,
                0);
        // bottom
        collisionBoxArray.emplaceBack(0, EXTENT, -maxInt16, 0, maxInt16, 0, maxInt16,
                0, 0, 0, 0, 0, 0, 0, 0,
                0);
    }

    this.tempCollisionBox = collisionBoxArray.get(0);
    this.edges = [
        collisionBoxArray.get(1),
        collisionBoxArray.get(2),
        collisionBoxArray.get(3),
        collisionBoxArray.get(4)
    ];
}

CollisionTile.prototype.serialize = function() {
    const data = {
        angle: this.angle,
        pitch: this.pitch,
        grid: this.grid.toArrayBuffer(),
        ignoredGrid: this.ignoredGrid.toArrayBuffer()
    };
    return {
        data: data,
        transferables: [data.grid, data.ignoredGrid]
    };
};

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

    const collisionBoxArray = this.collisionBoxArray;
    let minPlacementScale = this.minScale;
    const rotationMatrix = this.rotationMatrix;
    const yStretch = this.yStretch;

    for (let b = collisionFeature.boxStartIndex; b < collisionFeature.boxEndIndex; b++) {

        const box = collisionBoxArray.get(b);

        const anchorPoint = box.anchorPoint._matMult(rotationMatrix);
        const x = anchorPoint.x;
        const y = anchorPoint.y;

        const x1 = x + box.x1;
        const y1 = y + box.y1 * yStretch;
        const x2 = x + box.x2;
        const y2 = y + box.y2 * yStretch;

        box.bbox0 = x1;
        box.bbox1 = y1;
        box.bbox2 = x2;
        box.bbox3 = y2;

        if (!allowOverlap) {
            const blockingBoxes = this.grid.query(x1, y1, x2, y2);

            for (let i = 0; i < blockingBoxes.length; i++) {
                const blocking = collisionBoxArray.get(blockingBoxes[i]);
                const blockingAnchorPoint = blocking.anchorPoint._matMult(rotationMatrix);

                minPlacementScale = this.getPlacementScale(minPlacementScale, anchorPoint, box, blockingAnchorPoint, blocking);
                if (minPlacementScale >= this.maxScale) {
                    return minPlacementScale;
                }
            }
        }

        if (avoidEdges) {
            let rotatedCollisionBox;

            if (this.angle) {
                const reverseRotationMatrix = this.reverseRotationMatrix;
                const tl = new Point(box.x1, box.y1).matMult(reverseRotationMatrix);
                const tr = new Point(box.x2, box.y1).matMult(reverseRotationMatrix);
                const bl = new Point(box.x1, box.y2).matMult(reverseRotationMatrix);
                const br = new Point(box.x2, box.y2).matMult(reverseRotationMatrix);

                rotatedCollisionBox = this.tempCollisionBox;
                rotatedCollisionBox.anchorPointX = box.anchorPoint.x;
                rotatedCollisionBox.anchorPointY = box.anchorPoint.y;
                rotatedCollisionBox.x1 = Math.min(tl.x, tr.x, bl.x, br.x);
                rotatedCollisionBox.y1 = Math.min(tl.y, tr.x, bl.x, br.x);
                rotatedCollisionBox.x2 = Math.max(tl.x, tr.x, bl.x, br.x);
                rotatedCollisionBox.y2 = Math.max(tl.y, tr.x, bl.x, br.x);
                rotatedCollisionBox.maxScale = box.maxScale;
            } else {
                rotatedCollisionBox = box;
            }

            for (let k = 0; k < this.edges.length; k++) {
                const edgeBox = this.edges[k];
                minPlacementScale = this.getPlacementScale(minPlacementScale, box.anchorPoint, rotatedCollisionBox, edgeBox.anchorPoint, edgeBox);
                if (minPlacementScale >= this.maxScale) {
                    return minPlacementScale;
                }
            }
        }
    }

    return minPlacementScale;
};

CollisionTile.prototype.queryRenderedSymbols = function(minX, minY, maxX, maxY, scale) {
    const sourceLayerFeatures = {};
    const result = [];

    const collisionBoxArray = this.collisionBoxArray;
    const rotationMatrix = this.rotationMatrix;
    const anchorPoint = new Point(minX, minY)._matMult(rotationMatrix);

    const queryBox = this.tempCollisionBox;
    queryBox.anchorX = anchorPoint.x;
    queryBox.anchorY = anchorPoint.y;
    queryBox.x1 = 0;
    queryBox.y1 = 0;
    queryBox.x2 = maxX - minX;
    queryBox.y2 = maxY - minY;
    queryBox.maxScale = scale;

    // maxScale is stored using a Float32. Convert `scale` to the stored Float32 value.
    scale = queryBox.maxScale;

    const searchBox = [
        anchorPoint.x + queryBox.x1 / scale,
        anchorPoint.y + queryBox.y1 / scale * this.yStretch,
        anchorPoint.x + queryBox.x2 / scale,
        anchorPoint.y + queryBox.y2 / scale * this.yStretch
    ];

    const blockingBoxKeys = this.grid.query(searchBox[0], searchBox[1], searchBox[2], searchBox[3]);
    const blockingBoxKeys2 = this.ignoredGrid.query(searchBox[0], searchBox[1], searchBox[2], searchBox[3]);
    for (let k = 0; k < blockingBoxKeys2.length; k++) {
        blockingBoxKeys.push(blockingBoxKeys2[k]);
    }

    for (let i = 0; i < blockingBoxKeys.length; i++) {
        const blocking = collisionBoxArray.get(blockingBoxKeys[i]);

        const sourceLayer = blocking.sourceLayerIndex;
        const featureIndex = blocking.featureIndex;
        if (sourceLayerFeatures[sourceLayer] === undefined) {
            sourceLayerFeatures[sourceLayer] = {};
        }

        if (!sourceLayerFeatures[sourceLayer][featureIndex]) {
            const blockingAnchorPoint = blocking.anchorPoint.matMult(rotationMatrix);
            const minPlacementScale = this.getPlacementScale(this.minScale, anchorPoint, queryBox, blockingAnchorPoint, blocking);
            if (minPlacementScale >= scale) {
                sourceLayerFeatures[sourceLayer][featureIndex] = true;
                result.push(blockingBoxKeys[i]);
            }
        }
    }

    return result;
};

CollisionTile.prototype.getPlacementScale = function(minPlacementScale, anchorPoint, box, blockingAnchorPoint, blocking) {

    // Find the lowest scale at which the two boxes can fit side by side without overlapping.
    // Original algorithm:
    const anchorDiffX = anchorPoint.x - blockingAnchorPoint.x;
    const anchorDiffY = anchorPoint.y - blockingAnchorPoint.y;
    let s1 = (blocking.x1 - box.x2) / anchorDiffX; // scale at which new box is to the left of old box
    let s2 = (blocking.x2 - box.x1) / anchorDiffX; // scale at which new box is to the right of old box
    let s3 = (blocking.y1 - box.y2) * this.yStretch / anchorDiffY; // scale at which new box is to the top of old box
    let s4 = (blocking.y2 - box.y1) * this.yStretch / anchorDiffY; // scale at which new box is to the bottom of old box

    if (isNaN(s1) || isNaN(s2)) s1 = s2 = 1;
    if (isNaN(s3) || isNaN(s4)) s3 = s4 = 1;

    let collisionFreeScale = Math.min(Math.max(s1, s2), Math.max(s3, s4));
    const blockingMaxScale = blocking.maxScale;
    const boxMaxScale = box.maxScale;

    if (collisionFreeScale > blockingMaxScale) {
        // After a box's maxScale the label has shrunk enough that the box is no longer needed to cover it,
        // so unblock the new box at the scale that the old box disappears.
        collisionFreeScale = blockingMaxScale;
    }

    if (collisionFreeScale > boxMaxScale) {
        // If the box can only be shown after it is visible, then the box can never be shown.
        // But the label can be shown after this box is not visible.
        collisionFreeScale = boxMaxScale;
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

    const grid = ignorePlacement ? this.ignoredGrid : this.grid;
    const collisionBoxArray = this.collisionBoxArray;

    for (let k = collisionFeature.boxStartIndex; k < collisionFeature.boxEndIndex; k++) {
        const box = collisionBoxArray.get(k);
        box.placementScale = minPlacementScale;
        if (minPlacementScale < this.maxScale) {
            grid.insert(k, box.bbox0, box.bbox1, box.bbox2, box.bbox3);
        }
    }
};
