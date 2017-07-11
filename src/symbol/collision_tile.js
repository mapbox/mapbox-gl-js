// @flow

const Point = require('point-geometry');
const EXTENT = require('../data/extent');
const Grid = require('grid-index');
const glmatrix = require('@mapbox/gl-matrix');
const vec4 = glmatrix.vec4;
const mat4 = glmatrix.mat4;
const dimensions = 10000;

const intersectionTests = require('../util/intersection_tests');

export type SerializedCollisionTile = {|
    grid: ArrayBuffer,
    ignoredGrid: ArrayBuffer
|};

/**
 * A collision tile used to prevent symbols from overlapping. It keep tracks of
 * where previous symbols have been placed and is used to check if a new
 * symbol overlaps with any previously added symbols.
 *
 * @private
 */
class CollisionTile {
    grid: any;
    ignoredGrid: any;
    perspectiveRatio: number;
    minScale: number;
    maxScale: number;
    angle: number;
    pitch: number;
    cameraToCenterDistance: number;
    cameraToTileDistance: number;
    rotationMatrix: [number, number, number, number];
    reverseRotationMatrix: [number, number, number, number];
    yStretch: number;
    collisionBoxArray: any;
    tempCollisionBox: any;
    edges: Array<any>;

    static deserialize(serialized: SerializedCollisionTile) {
        return new CollisionTile(
            new Grid(serialized.grid),
            new Grid(serialized.ignoredGrid)
        );
    }

    constructor(
        grid: any = new Grid(dimensions, 48, 12),
        ignoredGrid: any = new Grid(dimensions, 48, 0)
    ) {
        const angle = 0;
        const pitch = 0;
        const cameraToCenterDistance = 1;
        const cameraToTileDistance = 1;
        this.angle = angle;
        this.pitch = pitch;
        this.cameraToCenterDistance = cameraToCenterDistance;
        this.cameraToTileDistance = cameraToTileDistance;
        this.matrix = mat4.identity(mat4.create());

        this.grid = grid;
        this.ignoredGrid = ignoredGrid;

        this.perspectiveRatio = 1 + 0.5 * ((cameraToTileDistance / cameraToCenterDistance) - 1);

        // High perspective ratio means we're effectively "underzooming"
        // the tile. Adjust the minScale and maxScale range accordingly
        // to constrain the number of collision calculations
        this.minScale = .5 / this.perspectiveRatio;
        this.maxScale = 2 / this.perspectiveRatio;

        const sin = Math.sin(this.angle),
            cos = Math.cos(this.angle);
        this.rotationMatrix = [cos, -sin, sin, cos];
        this.reverseRotationMatrix = [cos, sin, -sin, cos];

        // Stretch boxes in y direction to account for the map tilt.
        // The amount the map is squished depends on the y position.
        // We can only approximate here based on the y position of the tile
        // The shaders calculate a more accurate "incidence_stretch"
        // at render time to calculate an effective scale for collision
        // purposes, but we still want to use the yStretch approximation
        // here because we can't adjust the aspect ratio of the collision
        // boxes at render time.
        this.yStretch = Math.max(1, cameraToTileDistance / (cameraToCenterDistance * Math.cos(pitch / 180 * Math.PI)));
        this.yStretch = 1;
    }

    serialize(transferables: ?Array<Transferable>): SerializedCollisionTile {
        const grid = this.grid.toArrayBuffer();
        const ignoredGrid = this.ignoredGrid.toArrayBuffer();
        if (transferables) {
            transferables.push(grid);
            transferables.push(ignoredGrid);
        }
        return {
            grid: grid,
            ignoredGrid: ignoredGrid
        };
    }

    /**
     * Find the scale at which the collisionFeature can be shown without
     * overlapping with other features.
     *
     * @param {CollisionFeature} collisionFeature
     * @param allowOverlap
     * @param avoidEdges
     * @private
     */
    placeCollisionFeature(collisionFeature: any, allowOverlap: boolean, avoidEdges: boolean, scale: number): boolean {

        const collisionBoxArray = this.collisionBoxArray;

        const rotationMatrix = this.rotationMatrix;
        const yStretch = this.yStretch;

        for (let b = collisionFeature.boxStartIndex; b < collisionFeature.boxEndIndex; b++) {

            const box = collisionBoxArray.get(b);

            const anchorPoint = box.anchorPoint._matMult(rotationMatrix);
            const x = anchorPoint.x;
            const y = anchorPoint.y;

            // When the 'perspectiveRatio' is high, we're effectively underzooming
            // the tile because it's in the distance.
            // In order to detect collisions that only happen while underzoomed,
            // we have to query a larger portion of the grid.
            // This extra work is offset by having a lower 'maxScale' bound
            // Note that this adjustment ONLY affects the bounding boxes
            // in the grid. It doesn't affect the boxes used for the
            // minPlacementScale calculations.
            const x1 = x + box.x1 / scale;
            const y1 = y + box.y1 / scale;
            const x2 = x + box.x2 / scale;
            const y2 = y + box.y2 / scale;
            const tl = this.projectPoint(new Point(x1, y1));
            const br = this.projectPoint(new Point(x2, y2));

            box.bbox0 = tl.x;
            box.bbox1 = tl.y;
            box.bbox2 = br.x;
            box.bbox3 = br.y;

            // When the map is pitched the distance covered by a line changes.
            // Adjust the max scale by (approximatePitchedLength / approximateRegularLength)
            // to compensate for this.

            const offset = new Point(box.offsetX, box.offsetY)._matMult(rotationMatrix);
            const xSqr = offset.x * offset.x;
            const ySqr = offset.y * offset.y;
            const yStretchSqr = ySqr * yStretch * yStretch;
            const adjustmentFactor = Math.sqrt((xSqr + yStretchSqr) / (xSqr + ySqr)) || 1;
            box.maxScale = box.unadjustedMaxScale * adjustmentFactor;
            box.maxScale = box.unadjustedMaxScale;

            if (!allowOverlap) {
                const blockingBoxes = this.grid.query(box.bbox0, box.bbox1, box.bbox2, box.bbox3);

                for (let i = 0; i < blockingBoxes.length; i++) {
                    const blocking = collisionBoxArray.get(blockingBoxes[i]);
                    const blockingAnchorPoint = blocking.anchorPoint;//._matMult(rotationMatrix);
                    if (this.checkIfBoxesCollide(scale, anchorPoint, box, blockingAnchorPoint, blocking)) {
                        return false;
                    }
                }
            }

            /*if (avoidEdges && false) {
                let rotatedCollisionBox;

                if (false && this.angle) {
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
            }*/
        }

        return true;
    }

    queryRenderedSymbols(queryGeometry: any, scale: number): Array<any> {
        const sourceLayerFeatures = {};
        const result = [];

        if (queryGeometry.length === 0 || (this.grid.keys.length === 0 && this.ignoredGrid.keys.length === 0)) {
            return result;
        }

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

        // "perspectiveRatio" is a tile-based approximation of how much larger symbols will
        // be in the distance. It won't line up exactly with the actually rendered symbols
        // Being exact would require running the collision detection logic in symbol_sdf.vertex
        // in the CPU
        const perspectiveScale = scale / this.perspectiveRatio;

        // Account for the rounding done when updating symbol shader variables.
        const roundedScale = Math.pow(2, Math.ceil(Math.log(perspectiveScale) / Math.LN2 * 10) / 10);

        for (let i = 0; i < features.length; i++) {
            const blocking = this.collisionBoxArray.get(features[i]);
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
            const x1 = anchor.x + blocking.x1 / perspectiveScale;
            const y1 = anchor.y + blocking.y1 / perspectiveScale * yStretch;
            const x2 = anchor.x + blocking.x2 / perspectiveScale;
            const y2 = anchor.y + blocking.y2 / perspectiveScale * yStretch;
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

    checkIfBoxesCollide(scale: number, anchorPoint: Point, box: any, blockingAnchorPoint: Point, blocking: any) {
        anchorPoint = this.projectPoint(anchorPoint);
        blockingAnchorPoint = this.projectPoint(blockingAnchorPoint);
        const boxTL = this.projectOffset(new Point(box.x1, box.y1));
        const boxBR = this.projectOffset(new Point(box.x2, box.y2));
        const blockingTL = this.projectOffset(new Point(blocking.x1, blocking.y1));
        const blockingBR = this.projectOffset(new Point(blocking.x2, blocking.y2));

        // Find the lowest scale at which the two boxes can fit side by side without overlapping.
        // Original algorithm:
        const anchorDiffX = anchorPoint.x - blockingAnchorPoint.x;
        const anchorDiffY = anchorPoint.y - blockingAnchorPoint.y;
        let s1 = (blockingTL.x - boxBR.x) / anchorDiffX; // scale at which new box is to the left of old box
        let s2 = (blockingBR.x - boxTL.x) / anchorDiffX; // scale at which new box is to the right of old box
        let s3 = (blockingTL.y - boxBR.y) * this.yStretch / anchorDiffY; // scale at which new box is to the top of old box
        let s4 = (blockingBR.y - boxTL.y) * this.yStretch / anchorDiffY; // scale at which new box is to the bottom of old box

        if (isNaN(s1) || isNaN(s2)) s1 = s2 = 1;
        if (isNaN(s3) || isNaN(s4)) s3 = s4 = 1;

        const collisionFreeScale = Math.min(Math.max(s1, s2), Math.max(s3, s4));
        return collisionFreeScale > scale;
    }

    /**
     * Remember this collisionFeature and what scale it was placed at to block
     * later features from overlapping with it.
     *
     * @param {CollisionFeature} collisionFeature
     * @param minPlacementScale
     * @param ignorePlacement
     * @private
     */
    insertCollisionFeature(collisionFeature: any, ignorePlacement: boolean) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;
        const collisionBoxArray = this.collisionBoxArray;

        for (let k = collisionFeature.boxStartIndex; k < collisionFeature.boxEndIndex; k++) {
            const box = collisionBoxArray.get(k);
            grid.insert(k, box.bbox0, box.bbox1, box.bbox2, box.bbox3);
        }
    }

    setMatrix(matrix) {
        this.matrix = matrix;
    }

    setCollisionBoxArray(collisionBoxArray) {
        this.collisionBoxArray = collisionBoxArray;
        if (collisionBoxArray.length === 0) {
            // the first time collisionBoxArray is passed to a CollisionTile

            // tempCollisionBox
            collisionBoxArray.emplaceBack();

            /*
            const maxInt16 = 32767;
            //left
            collisionBoxArray.emplaceBack(0, 0, 0, 0, 0, -maxInt16, 0, maxInt16, Infinity, Infinity,
                0, 0, 0, 0, 0, 0, 0, 0, 0);
            // right
            collisionBoxArray.emplaceBack(EXTENT, 0, 0, 0, 0, -maxInt16, 0, maxInt16, Infinity, Infinity,
                0, 0, 0, 0, 0, 0, 0, 0, 0);
            // top
            collisionBoxArray.emplaceBack(0, 0, 0, 0, -maxInt16, 0, maxInt16, 0, Infinity, Infinity,
                0, 0, 0, 0, 0, 0, 0, 0, 0);
            // bottom
            collisionBoxArray.emplaceBack(0, EXTENT, 0, 0, -maxInt16, 0, maxInt16, 0, Infinity, Infinity,
                0, 0, 0, 0, 0, 0, 0, 0, 0);
                */
        }

        this.tempCollisionBox = collisionBoxArray.get(0);
        this.edges = [
            collisionBoxArray.get(1),
            collisionBoxArray.get(2),
            collisionBoxArray.get(3),
            collisionBoxArray.get(4)
        ];
    }

    projectPoint(point) {
        const p = [point.x, point.y, 0, 1];
        vec4.transformMat4(p, p, this.matrix);
        const a = new Point(
            ((p[0] / p[3] + 1) / 2) * dimensions,
            ((-p[1] / p[3] + 1) / 2) * dimensions
        );
        return a;
    }

    projectOffset(offset) {
        return this.projectPoint(offset).sub(this.projectPoint(new Point(0, 0)));
    }
}

module.exports = CollisionTile;
