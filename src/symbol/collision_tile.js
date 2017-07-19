// @flow

const Point = require('point-geometry');
const Grid = require('./grid_index_experimental');
const glmatrix = require('@mapbox/gl-matrix');

const mat4 = glmatrix.mat4;

const projection = require('../symbol/projection'); // TODO: Split the main thread part of this code out so it doesn't get needlessly copied to the workers

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
            const projectedPoint = this.projectAndGetPerspectiveRatio(new Point(collisionBoxes[k + 4], collisionBoxes[k + 5]));
            const tileToViewport = projectedPoint.perspectiveRatio * pixelsToTileUnits * scale;
            const tlX = collisionBoxes[k] / tileToViewport + projectedPoint.point.x;
            const tlY = collisionBoxes[k + 1] / tileToViewport + projectedPoint.point.y;
            const brX = collisionBoxes[k + 2] / tileToViewport + projectedPoint.point.x;
            const brY = collisionBoxes[k + 3] / tileToViewport + projectedPoint.point.y;

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

    placeCollisionCircles(collisionCircles: any, allowOverlap: boolean, scale: number, pixelsToTileUnits: number, key: string, symbol: any, lineVertexArray: any, glyphOffsetArray: any, fontSize: number, labelPlaneMatrix: any, posMatrix: any, pitchWithMap: boolean): boolean {
        const placedCollisionCircles = [];
        if (!collisionCircles) {
            return placedCollisionCircles;
        }

        const tileUnitAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
        const perspectiveRatio = this.getPerspectiveRatio(tileUnitAnchorPoint);

        const projectionCache = {};
        const fontScale = fontSize / 24;
        const lineOffsetX = symbol.lineOffsetX * fontSize;
        const lineOffsetY = symbol.lineOffsetY * fontSize;

        const labelPlaneAnchorPoint = projection.project(tileUnitAnchorPoint, labelPlaneMatrix);
        const firstAndLastGlyph = projection.placeFirstAndLastGlyph(
            fontScale,
            glyphOffsetArray,
            lineOffsetX,
            lineOffsetY,
            /*flip*/ false,
            labelPlaneAnchorPoint,
            symbol,
            lineVertexArray,
            labelPlaneMatrix,
            projectionCache);

        for (let k = 0; k < collisionCircles.length; k += 5) {
            const boxDistanceToAnchor = collisionCircles[k + 3];
            if (!firstAndLastGlyph ||
                (boxDistanceToAnchor < -firstAndLastGlyph.first.tileDistance) ||
                (boxDistanceToAnchor > firstAndLastGlyph.last.tileDistance)) {
                // Don't need to use this circle because the label doesn't extend this far
                collisionCircles[k + 4] = true;
                continue;
            }

            const projectedPoint = this.projectPoint(new Point(collisionCircles[k], collisionCircles[k + 1]));
            const x = projectedPoint.x;
            const y = projectedPoint.y;

            const tileToViewport = perspectiveRatio * pixelsToTileUnits * scale;
            const radius = collisionCircles[k + 2] / tileToViewport;

            // TODO: Don't skip the circle if it's the last one that's going to be used (this is a source of instability)
            const dx = x - placedCollisionCircles[placedCollisionCircles.length - 3];
            const dy = y - placedCollisionCircles[placedCollisionCircles.length - 2];
            if (radius * radius * 2 > dx * dx + dy * dy) {
                collisionCircles[k + 4] = true;
                continue;
            }
            placedCollisionCircles.push(x);
            placedCollisionCircles.push(y);
            placedCollisionCircles.push(radius);
            collisionCircles[k + 4] = false;

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
    insertCollisionBoxes(collisionBoxes: any, ignorePlacement: boolean, key: string) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        for (let k = 0; k < collisionBoxes.length; k += 4) {
            grid.insert(key, collisionBoxes[k],
                collisionBoxes[k + 1],
                collisionBoxes[k + 2],
                collisionBoxes[k + 3]);
        }
    }

    insertCollisionCircles(collisionCircles: any, ignorePlacement: boolean, key: string) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        for (let k = 0; k < collisionCircles.length; k += 3) {
            grid.insertCircle(key, collisionCircles[k],
                collisionCircles[k + 1],
                collisionCircles[k + 2]);
        }
    }


    setMatrix(matrix) {
        this.matrix = matrix;
    }

    getPerspectiveRatio(anchor) {
        const p = [anchor.x, anchor.y, 0, 1];
        projection.xyTransformMat4(p, p, this.matrix);
        return 1 + 0.5 * ((p[3] / this.transform.cameraToCenterDistance) - 1);
    }

    projectPoint(point) {
        const p = [point.x, point.y, 0, 1];
        projection.xyTransformMat4(p, p, this.matrix);
        return new Point(
            ((p[0] / p[3] + 1) / 2) * this.transform.width,
            ((-p[1] / p[3] + 1) / 2) * this.transform.height
        );
    }

    projectAndGetPerspectiveRatio(point) {
        const p = [point.x, point.y, 0, 1];
        projection.xyTransformMat4(p, p, this.matrix);
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
