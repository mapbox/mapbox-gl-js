// @flow

const Point = require('point-geometry');
const Grid = require('./grid_index_experimental');
const glmatrix = require('@mapbox/gl-matrix');

const vec4 = glmatrix.vec4;
const mat4 = glmatrix.mat4;

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
        grid: any = new Grid(transform.width, transform.height, 20),
        ignoredGrid: any = new Grid(transform.width, transform.height, 20)
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
    placeCollisionBoxes(collisionBoxes: any, allowOverlap: boolean, scale: number, pixelsToTileUnits: number): boolean {
        const placedCollisionBoxes = [];
        if (!collisionBoxes) {
            return placedCollisionBoxes;
        }

        for (let k = 0; k < collisionBoxes.length; k += 6) {
            const projectedPoint = this.projectPoint(new Point(collisionBoxes[k + 4], collisionBoxes[k + 5]));
            const tileToViewport = projectedPoint.perspectiveRatio / (pixelsToTileUnits * scale);
            const tlX = collisionBoxes[k] * tileToViewport + projectedPoint.point.x;
            const tlY = collisionBoxes[k + 1] * tileToViewport + projectedPoint.point.y;
            const brX = collisionBoxes[k + 2] * tileToViewport + projectedPoint.point.x;
            const brY = collisionBoxes[k + 3] * tileToViewport + projectedPoint.point.y;

            placedCollisionBoxes.push(tlX);
            placedCollisionBoxes.push(tlY);
            placedCollisionBoxes.push(brX);
            placedCollisionBoxes.push(brY);

            if (!allowOverlap) {
                if (this.grid.hitTest(tlX, tlY, brX, brY)) {
                    return [];
                }
            }
        }

        return placedCollisionBoxes;
    }

    placeCollisionCircles(collisionCircles: any, allowOverlap: boolean, scale: number, pixelsToTileUnits: number): boolean {
        const placedCollisionCircles = [];
        if (!collisionCircles) {
            return placedCollisionCircles;
        }

        for (let k = 0; k < collisionCircles.length; k += 3) {
            const projectedPoint = this.projectPoint(new Point(collisionCircles[k], collisionCircles[k + 1]));
            const x = projectedPoint.point.x;
            const y = projectedPoint.point.y;

            const tileToViewport = projectedPoint.perspectiveRatio / (pixelsToTileUnits * scale);
            const radius = collisionCircles[k + 2] * tileToViewport;

            placedCollisionCircles.push(x);
            placedCollisionCircles.push(y);
            placedCollisionCircles.push(radius);

            if (!allowOverlap) {
                if (this.grid.hitTestCircle(x, y, radius)) {
                    return [];
                }
            }
        }

        return placedCollisionCircles;
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
    insertCollisionBoxes(collisionBoxes: any, ignorePlacement: boolean) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        for (let k = 0; k < collisionBoxes.length; k += 4) {
            grid.insert(0, collisionBoxes[k],
                collisionBoxes[k + 1],
                collisionBoxes[k + 2],
                collisionBoxes[k + 3]);
        }
    }

    insertCollisionCircles(collisionCircles: any, ignorePlacement: boolean) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        for (let k = 0; k < collisionCircles.length; k += 3) {
            grid.insertCircle(0, collisionCircles[k],
                collisionCircles[k + 1],
                collisionCircles[k + 2]);
        }
    }


    setMatrix(matrix) {
        this.matrix = matrix;
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
            ((p[0] / p[3] + 1) / 2) * this.transform.width,
            ((-p[1] / p[3] + 1) / 2) * this.transform.height
        );
        return {
            point: a,
            perspectiveRatio: 1 + 0.5 * ((p[3] / this.transform.cameraToCenterDistance) - 1)
        };
    }

}

module.exports = CollisionTile;
