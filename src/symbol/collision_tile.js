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
    placeCollisionFeature(collisionBoxes: any, allowOverlap: boolean, scale: number, pixelsToTileUnits: number): boolean {
        const collisionBoxArray = this.collisionBoxArray;

        const placedCollisionBoxes = [];
        if (!collisionBoxes) {
            return placedCollisionBoxes;
        }

        for (let k = 0; k < collisionBoxes.length; k += 6) {
            const projectedPoint = this.projectPoint(new Point(collisionBoxes[k + 4], collisionBoxes[k + 5]));
            const tileToViewport = projectedPoint.perspectiveRatio * dimensions / (pixelsToTileUnits * scale);
            const xScale = tileToViewport / this.transform.width;
            const yScale = tileToViewport / this.transform.height;
            const tlX = collisionBoxes[k] * xScale + projectedPoint.point.x;
            const tlY = collisionBoxes[k + 1] * yScale + projectedPoint.point.y;
            const brX = collisionBoxes[k + 2] * xScale + projectedPoint.point.x;
            const brY = collisionBoxes[k + 3] * yScale + projectedPoint.point.y;

            placedCollisionBoxes.push(tlX);
            placedCollisionBoxes.push(tlY);
            placedCollisionBoxes.push(brX);
            placedCollisionBoxes.push(brY);

            if (!allowOverlap) {
                //const blockingBoxes = this.grid.query(box.bbox0, box.bbox1, box.bbox2, box.bbox3);
                if (this.grid.hitTest(tlX, tlY, brX, brY)) {
                    return [];
                }
                // for (let i = 0; i < blockingBoxes.length; i++) {
                //     const blocking = collisionBoxArray.get(blockingBoxes[i]);
                //     if (this.boxesCollide(box, blocking)) {
                //         return false;
                //     }
                // }
            }
        }

        return placedCollisionBoxes;
    }

    queryRenderedSymbols(queryGeometry: any, scale: number): Array<any> {

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
    insertCollisionFeature(collisionBoxes: any, ignorePlacement: boolean) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        for (let k = 0; k < collisionBoxes.length; k += 4) {
            grid.insert(0, collisionBoxes[k],
                collisionBoxes[k + 1],
                collisionBoxes[k + 2],
                collisionBoxes[k + 3]);
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

    xytransformMat4(out, a, m) {
        const x = a[0], y = a[1];
        out[0] = m[0] * x + m[4] * y + m[12];
        out[1] = m[1] * x + m[5] * y + m[13];
        out[3] = m[3] * x + m[7] * y + m[15];
        return out;
    }

    projectPoint(point) {
        const p = [point.x, point.y, 0, 1];
        //vec4.transformMat4(p, p, this.matrix);
        this.xytransformMat4(p, p, this.matrix);
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
