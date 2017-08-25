// @flow

const Point = require('@mapbox/point-geometry');
const intersectionTests = require('../util/intersection_tests');

const Grid = require('./grid_index_experimental');
const glmatrix = require('@mapbox/gl-matrix');

const mat4 = glmatrix.mat4;

const projection = require('../symbol/projection');

import type Transform from '../geo/transform';
import type TileCoord from '../source/tile_coord';

/**
 * A collision index used to prevent symbols from overlapping. It keep tracks of
 * where previous symbols have been placed and is used to check if a new
 * symbol overlaps with any previously added symbols.
 *
 * @private
 */
class CollisionIndex {
    grid: Grid;
    ignoredGrid: Grid;
    transform: Transform;
    matrix: mat4;

    constructor(
        transform: Transform,
        grid: Grid = new Grid(transform.width, transform.height, 20),
        ignoredGrid: Grid = new Grid(transform.width, transform.height, 20)
    ) {
        this.transform = transform;
        this.matrix = mat4.identity(mat4.create());

        this.grid = grid;
        this.ignoredGrid = ignoredGrid;
    }


    /**
     * Find whether the collisionFeature can be shown without
     * overlapping with other features.
     * @private
     */
    placeCollisionBoxes(collisionBoxes: any, allowOverlap: boolean, scale: number, pixelsToTileUnits: number): Array<number> {
        const placedCollisionBoxes = [];
        if (!collisionBoxes) {
            return placedCollisionBoxes;
        }

        for (let k = 0; k < collisionBoxes.length; k += 6) {
            const projectedPoint = this.projectAndGetPerspectiveRatio(new Point(collisionBoxes[k + 4], collisionBoxes[k + 5]));
            const tileToViewport = pixelsToTileUnits * scale * projectedPoint.perspectiveRatio;
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

    placeCollisionCircles(collisionCircles: any, allowOverlap: boolean, scale: number, pixelsToTileUnits: number, key: string, symbol: any, lineVertexArray: any, glyphOffsetArray: any, fontSize: number, labelPlaneMatrix: any, showCollisionCircles: boolean): Array<number> {
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
            projectionCache,
            /*return tile distance*/ true);

        let collisionDetected = false;

        for (let k = 0; k < collisionCircles.length; k += 5) {
            const boxDistanceToAnchor = collisionCircles[k + 3];
            const tileUnitRadius = collisionCircles[k + 2];
            if (!firstAndLastGlyph ||
                (boxDistanceToAnchor < -firstAndLastGlyph.first.tileDistance) ||
                (boxDistanceToAnchor - tileUnitRadius > firstAndLastGlyph.last.tileDistance)) {
                // Don't need to use this circle because the label doesn't extend this far
                collisionCircles[k + 4] = true;
                continue;
            }

            const projectedPoint = this.projectPoint(new Point(collisionCircles[k], collisionCircles[k + 1]));
            const x = projectedPoint.x;
            const y = projectedPoint.y;

            const tileToViewport = perspectiveRatio * pixelsToTileUnits * scale;
            const radius = tileUnitRadius / tileToViewport;

            if (placedCollisionCircles.length) {
                const dx = x - placedCollisionCircles[placedCollisionCircles.length - 4];
                const dy = y - placedCollisionCircles[placedCollisionCircles.length - 3];
                if (radius * radius * 2 > dx * dx + dy * dy) {
                    if ((k + 8) < collisionCircles.length) {
                        const nextBoxDistanceToAnchor = collisionCircles[k + 8];
                        if ((nextBoxDistanceToAnchor > -firstAndLastGlyph.first.tileDistance) &&
                        (nextBoxDistanceToAnchor < firstAndLastGlyph.last.tileDistance)) {
                            // Hide significantly overlapping circles, unless this is the last one we can
                            // use, in which case we want to keep it in place even if it's tightly packed
                            // with the one before it.
                            collisionCircles[k + 4] = true;
                            continue;
                        }
                    }
                }
            }
            placedCollisionCircles.push(x);
            placedCollisionCircles.push(y);
            placedCollisionCircles.push(radius);
            placedCollisionCircles.push(k / 5); // CollisionBoxArray index
            collisionCircles[k + 4] = false;

            if (!allowOverlap) {
                if (this.grid.hitTestCircle(x, y, radius)) {
                    if (!showCollisionCircles) {
                        return [];
                    } else {
                        // Don't early exit if we're showing the debug circles because we still want to calculate
                        // which circles are in use
                        collisionDetected = true;
                    }
                }
            }
        }

        return collisionDetected ? [] : placedCollisionCircles;
    }

    /**
     * Because the geometries in the CollisionIndex are an approximation of the shape of
     * symbols on the map, we use the CollisionIndex to look up the symbol part of
     * `queryRenderedFeatures`. Non-symbol features are looked up tile-by-tile, and
     * historically collisions were handled per-tile.
     *
     * For this reason, `queryRenderedSymbols` still takes tile coordinate inputs and
     * converts them back to viewport coordinates. The change to a viewport coordinate
     * CollisionIndex means it's now possible to re-design queryRenderedSymbols to
     * run entirely in viewport coordinates, saving unnecessary conversions.
     *
     * @private
     */
    queryRenderedSymbols(queryGeometry: any, scale: number, tileCoord: TileCoord, tileSourceMaxZoom: number, pixelsToTileUnits: number, collisionBoxArray: any) {
        const sourceLayerFeatures = {};
        const result = [];

        if (queryGeometry.length === 0 || (this.grid.keysLength() === 0 && this.ignoredGrid.keysLength() === 0)) {
            return result;
        }

        this.setMatrix(this.transform.calculatePosMatrix(tileCoord, tileSourceMaxZoom));

        const query = [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < queryGeometry.length; i++) {
            const ring = queryGeometry[i];
            for (let k = 0; k < ring.length; k++) {
                const p = this.projectPoint(ring[k]);
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
                query.push(p);
            }
        }

        const tileID = tileCoord.id;

        const thisTileFeatures = [];
        const features = this.grid.query(minX, minY, maxX, maxY);
        for (let i = 0; i < features.length; i++) {
            if (features[i].tileID === tileID) {
                thisTileFeatures.push(features[i].boxIndex);
            }
        }
        const ignoredFeatures = this.ignoredGrid.query(minX, minY, maxX, maxY);
        for (let i = 0; i < ignoredFeatures.length; i++) {
            if (ignoredFeatures[i].tileID === tileID) {
                thisTileFeatures.push(ignoredFeatures[i].boxIndex);
            }
        }

        for (let i = 0; i < thisTileFeatures.length; i++) {
            const blocking = collisionBoxArray.get(thisTileFeatures[i]);
            const sourceLayer = blocking.sourceLayerIndex;
            const featureIndex = blocking.featureIndex;

            // Skip already seen features.
            if (sourceLayerFeatures[sourceLayer] === undefined) {
                sourceLayerFeatures[sourceLayer] = {};
            }
            if (sourceLayerFeatures[sourceLayer][featureIndex]) continue;


            // Check if query intersects with the feature box
            // "Collision Circles" for line labels are treated as boxes here
            // Since there's no actual collision taking place, the circle vs. square
            // distinction doesn't matter as much, and box geometry is easier
            // to work with.
            const projectedPoint = this.projectAndGetPerspectiveRatio(blocking.anchorPoint);
            const tileToViewport = pixelsToTileUnits * scale * projectedPoint.perspectiveRatio;
            const x1 = blocking.x1 / tileToViewport + projectedPoint.point.x;
            const y1 = blocking.y1 / tileToViewport + projectedPoint.point.y;
            const x2 = blocking.x2 / tileToViewport + projectedPoint.point.x;
            const y2 = blocking.y2 / tileToViewport + projectedPoint.point.y;
            const bbox = [
                new Point(x1, y1),
                new Point(x2, y1),
                new Point(x2, y2),
                new Point(x1, y2)
            ];
            if (!intersectionTests.polygonIntersectsPolygon(query, bbox)) continue;

            sourceLayerFeatures[sourceLayer][featureIndex] = true;
            result.push(thisTileFeatures[i]);
        }

        return result;
    }

    /**
     * Remember this collisionFeature to block
     * later features from overlapping with it.
     * @private
     */
    insertCollisionBoxes(collisionBoxes: any, ignorePlacement: boolean, tileID: number, boxStartIndex: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        for (let k = 0; k < collisionBoxes.length; k += 4) {
            const key = { tileID: tileID, boxIndex: boxStartIndex + (k / 4) };
            grid.insert(key, collisionBoxes[k],
                collisionBoxes[k + 1],
                collisionBoxes[k + 2],
                collisionBoxes[k + 3]);
        }
    }

    insertCollisionCircles(collisionCircles: any, ignorePlacement: boolean, tileID: number, boxStartIndex: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        for (let k = 0; k < collisionCircles.length; k += 4) {
            const key = { tileID: tileID, boxIndex: boxStartIndex + collisionCircles[k + 3] };
            grid.insertCircle(key, collisionCircles[k],
                collisionCircles[k + 1],
                collisionCircles[k + 2]);
        }
    }


    setMatrix(matrix: mat4) {
        this.matrix = matrix;
    }

    getPerspectiveRatio(anchor) {
        const p = [anchor.x, anchor.y, 0, 1];
        projection.xyTransformMat4(p, p, this.matrix);
        return 0.5 + 0.5 * (p[3] / this.transform.cameraToCenterDistance);
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
            perspectiveRatio: 0.5 + 0.5 * (p[3] / this.transform.cameraToCenterDistance)
        };
    }

}

module.exports = CollisionIndex;
