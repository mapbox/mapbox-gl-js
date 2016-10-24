'use strict';

const Point = require('point-geometry');
const EXTENT = require('../data/extent');
const Grid = require('grid-index');

const intersectionTests = require('../util/intersection_tests');

/**
 * A collision tile used to prevent symbols from overlapping. It keep tracks of
 * where previous symbols have been placed and is used to check if a new
 * symbol overlaps with any previously added symbols.
 *
 * @private
 */
class CollisionTile {
    constructor(angle, pitch, collisionBoxArray) {
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

        this.minScale = 0.5;
        this.maxScale = 2;

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

    serialize(transferables) {
        const grid = this.grid.toArrayBuffer();
        const ignoredGrid = this.ignoredGrid.toArrayBuffer();
        if (transferables) {
            transferables.push(grid);
            transferables.push(ignoredGrid);
        }
        return {
            angle: this.angle,
            pitch: this.pitch,
            grid: grid,
            ignoredGrid: ignoredGrid
        };
    }

    /**
     * Find the scale at which the collisionFeature can be shown without
     * overlapping with other features.
     *
     * @param {CollisionFeature} collisionFeature
     * @returns {number} placementScale
     * @private
     */
    placeCollisionFeature(collisionFeature, allowOverlap, avoidEdges) {

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
    }

    queryRenderedSymbols(queryGeometry, scale) {
        const sourceLayerFeatures = {};
        const result = [];

        if (queryGeometry.length === 0 || (this.grid.length === 0 && this.ignoredGrid.length === 0)) {
            return result;
        }

        const collisionBoxArray = this.collisionBoxArray;
        const rotationMatrix = this.rotationMatrix;
        const yStretch = this.yStretch;

        // Generate a rotated geometry out of the original query geometry.
        // Scale has already been handled by the prior conversions.
        const rotatedQuery = [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < queryGeometry.length; i++) {
            const ring = queryGeometry[i];
            for (let k = 0; k < ring.length; k++) {
                const p = ring[k].matMult(rotationMatrix);
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
                rotatedQuery.push(p);
            }
        }

        const features = this.grid.query(minX, minY, maxX, maxY);
        const ignoredFeatures = this.ignoredGrid.query(minX, minY, maxX, maxY);
        for (let i = 0; i < ignoredFeatures.length; i++) {
            features.push(ignoredFeatures[i]);
        }

        // Account for the rounding done when updating symbol shader variables.
        const roundedScale = Math.pow(2, Math.ceil(Math.log(scale) / Math.LN2 * 10) / 10);

        for (let i = 0; i < features.length; i++) {
            const blocking = collisionBoxArray.get(features[i]);
            const sourceLayer = blocking.sourceLayerIndex;
            const featureIndex = blocking.featureIndex;

            // Skip already seen features.
            if (sourceLayerFeatures[sourceLayer] === undefined) {
                sourceLayerFeatures[sourceLayer] = {};
            }
            if (sourceLayerFeatures[sourceLayer][featureIndex]) continue;

            // Check if feature is rendered (collision free) at current scale.
            if (roundedScale < blocking.placementScale || roundedScale > blocking.maxScale) continue;

            // Check if query intersects with the feature box at current scale.
            const anchor = blocking.anchorPoint.matMult(rotationMatrix);
            const x1 = anchor.x + blocking.x1 / scale;
            const y1 = anchor.y + blocking.y1 / scale * yStretch;
            const x2 = anchor.x + blocking.x2 / scale;
            const y2 = anchor.y + blocking.y2 / scale * yStretch;
            const bbox = [
                new Point(x1, y1),
                new Point(x2, y1),
                new Point(x2, y2),
                new Point(x1, y2)
            ];
            if (!intersectionTests.polygonIntersectsPolygon(rotatedQuery, bbox)) continue;

            sourceLayerFeatures[sourceLayer][featureIndex] = true;
            result.push(features[i]);
        }

        return result;
    }

    getPlacementScale(minPlacementScale, anchorPoint, box, blockingAnchorPoint, blocking) {

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
    }


    /**
     * Remember this collisionFeature and what scale it was placed at to block
     * later features from overlapping with it.
     *
     * @param {CollisionFeature} collisionFeature
     * @param {number} minPlacementScale
     * @private
     */
    insertCollisionFeature(collisionFeature, minPlacementScale, ignorePlacement) {

        const grid = ignorePlacement ? this.ignoredGrid : this.grid;
        const collisionBoxArray = this.collisionBoxArray;

        for (let k = collisionFeature.boxStartIndex; k < collisionFeature.boxEndIndex; k++) {
            const box = collisionBoxArray.get(k);
            box.placementScale = minPlacementScale;
            if (minPlacementScale < this.maxScale) {
                grid.insert(k, box.bbox0, box.bbox1, box.bbox2, box.bbox3);
            }
        }
    }
}

module.exports = CollisionTile;
