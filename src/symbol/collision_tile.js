// @flow

const Point = require('point-geometry');
const Grid = require('./grid_index_experimental');
const glmatrix = require('@mapbox/gl-matrix');

const vec4 = glmatrix.vec4;
const mat4 = glmatrix.mat4;
const dimensions = 10000;

const intersectionTests = require('../util/intersection_tests');

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
    transform: Transform;
    rotationMatrix: [number, number, number, number];
    reverseRotationMatrix: [number, number, number, number];
    collisionBoxArray: any;
    tempCollisionBox: any;
    edges: Array<any>;

    constructor(
        transform: Transform,
        grid: any = new Grid(dimensions, 20, 12),
        ignoredGrid: any = new Grid(dimensions, 48, 0)
    ) {
        this.transform = transform;
        this.matrix = mat4.identity(mat4.create());

        this.grid = grid;
        this.ignoredGrid = ignoredGrid;

        const sin = Math.sin(this.transform.angle),
            cos = Math.cos(this.transform.angle);
        this.rotationMatrix = [cos, -sin, sin, cos];
        this.reverseRotationMatrix = [cos, sin, -sin, cos];
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
    placeCollisionFeature(collisionFeature: any, allowOverlap: boolean, scale: number, pixelsToTileUnits: number): boolean {

        const collisionBoxArray = this.collisionBoxArray;
        const rotationMatrix = this.rotationMatrix;

        for (let b = collisionFeature.boxStartIndex; b < collisionFeature.boxEndIndex; b++) {

            const box = collisionBoxArray.get(b);

            const projectedPoint = this.projectPoint(box.anchorPoint);
            const viewportAnchorPoint = projectedPoint.point;
            const tileToViewport = projectedPoint.perspectiveRatio * dimensions / (pixelsToTileUnits * scale);
            const tlX = box.x1 * tileToViewport / this.transform.width + viewportAnchorPoint.x;
            const tlY = box.y1 * tileToViewport / this.transform.height + viewportAnchorPoint.y;
            const brX = box.x2 * tileToViewport / this.transform.width + viewportAnchorPoint.x;
            const brY = box.y2 * tileToViewport / this.transform.height + viewportAnchorPoint.y;

            box.bbox0 = tlX;
            box.bbox1 = tlY;
            box.bbox2 = brX;
            box.bbox3 = brY;

            if (!allowOverlap) {
                //const blockingBoxes = this.grid.query(box.bbox0, box.bbox1, box.bbox2, box.bbox3);
                if (this.grid.hitTest(box.bbox0, box.bbox1, box.bbox2, box.bbox3)) {
                    return false;
                }
                // for (let i = 0; i < blockingBoxes.length; i++) {
                //     const blocking = collisionBoxArray.get(blockingBoxes[i]);
                //     if (this.boxesCollide(box, blocking)) {
                //         return false;
                //     }
                // }
            }
        }

        return true;
    }

    queryRenderedSymbols(queryGeometry: any, scale: number): Array<any> {

    }

    boxesCollide(box: any, blocking: any) {
        if (box.bbox3 > blocking.bbox1 || box.bbox1 < blocking.bbox3) {
            // Completely above or below
            return false;
        }
        if (box.bbox2 < blocking.bbox0 || box.bbox0 > blocking.bbox2) {
            // Completely left or right
            return false;
        }

        return true;
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
            // TODO: This key is not actually good for getting anything out since one CollisionTile can be used with
            // multiple collision box arrays. But for now we don't need to actually get any data out.
            if (box.bbox2 - box.bbox0 > 1000 || box.bbox3 - box.bbox1 > 1000) {
                //console.log("check this out");
                //return;
            }
            grid.insert(k, box.bbox0, box.bbox1, box.bbox2, box.bbox3);
        }
    }

    setMatrix(matrix) {
        this.matrix = matrix;
    }

    setCollisionBoxArray(collisionBoxArray) {
        this.collisionBoxArray = collisionBoxArray;
        /*if (collisionBoxArray.length === 0) {
            // the first time collisionBoxArray is passed to a CollisionTile

            // tempCollisionBox
            collisionBoxArray.emplaceBack();

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

        }

        this.tempCollisionBox = collisionBoxArray.get(0);
        this.edges = [
            collisionBoxArray.get(1),
            collisionBoxArray.get(2),
            collisionBoxArray.get(3),
            collisionBoxArray.get(4)
        ];*/
    }

    projectPoint(point) {
        const p = [point.x, point.y, 0, 1];
        vec4.transformMat4(p, p, this.matrix);
        const a = new Point(
            ((p[0] / p[3] + 1) / 2) * dimensions,
            ((-p[1] / p[3] + 1) / 2) * dimensions
        );
        return {
            point: a,
            perspectiveRatio: 1 + 0.5 * ((p[3] / this.transform.cameraToCenterDistance) - 1)
        };
    }

}

module.exports = CollisionTile;
