// @flow

const Point = require('@mapbox/point-geometry');
const intersectionTests = require('../util/intersection_tests');

const Grid = require('./grid_index');
const glmatrix = require('@mapbox/gl-matrix');

const mat4 = glmatrix.mat4;

const projection = require('../symbol/projection');

import type Transform from '../geo/transform';
import type TileCoord from '../source/tile_coord';
import type {SingleCollisionBox} from '../data/bucket/symbol_bucket';

// When a symbol crosses the edge that causes it to be included in
// collision detection, it will cause changes in the symbols around
// it. This constant specifies how many pixels to pad the edge of
// the viewport for collision detection so that the bulk of the changes
// occur offscreen. Making this constant greater increases label
// stability, but it's expensive.
const viewportPadding = 100;

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
    pitchfactor: number;

    constructor(
        transform: Transform,
        grid: Grid = new Grid(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25),
        ignoredGrid: Grid = new Grid(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25)
    ) {
        this.transform = transform;

        this.grid = grid;
        this.ignoredGrid = ignoredGrid;
        this.pitchfactor = Math.cos(transform._pitch) * transform.cameraToCenterDistance;
    }


    /**
     * Find whether the collisionFeature can be shown without
     * overlapping with other features.
     * @private
     */
    placeCollisionBox(collisionBox: SingleCollisionBox, allowOverlap: boolean, scale: number, pixelsToTileUnits: number, posMatrix: mat4): Array<number> {
        const projectedPoint = this.projectAndGetPerspectiveRatio(posMatrix, collisionBox.anchorPointX, collisionBox.anchorPointY);
        const tileToViewport = pixelsToTileUnits * scale * projectedPoint.perspectiveRatio;
        const tlX = collisionBox.x1 / tileToViewport + projectedPoint.point.x;
        const tlY = collisionBox.y1 / tileToViewport + projectedPoint.point.y;
        const brX = collisionBox.x2 / tileToViewport + projectedPoint.point.x;
        const brY = collisionBox.y2 / tileToViewport + projectedPoint.point.y;

        if (!allowOverlap) {
            if (this.grid.hitTest(tlX, tlY, brX, brY)) {
                return [];
            }
        }
        return [tlX, tlY, brX, brY];
    }

    approximateTileDistance(tileDistance: any, lastSegmentAngle: number, tileToViewport: number, cameraToAnchorDistance: number, pitchWithMap: boolean): number {
        // This is a quick and dirty solution for chosing which collision circles to use (since collision circles are
        // laid out in tile units). Ideally, I think we should generate collision circles on the fly in viewport coordinates
        // at the time we do collision detection.

        // incidenceStretch is the ratio of how much y space a label takes up on a tile while drawn perpendicular to the viewport vs
        //  how much space it would take up if it were drawn flat on the tile
        // Using law of sines, camera_to_anchor/sin(ground_angle) = camera_to_center/sin(incidence_angle)
        // Incidence angle 90 -> head on, sin(incidence_angle) = 1, no stretch
        // Incidence angle 1 -> very oblique, sin(incidence_angle) =~ 0, lots of stretch
        // ground_angle = u_pitch + PI/2 -> sin(ground_angle) = cos(u_pitch)
        // incidenceStretch = 1 / sin(incidenceAngle)

        const incidenceStretch = pitchWithMap ? 1 : cameraToAnchorDistance / this.pitchfactor;
        const lastSegmentTile = tileDistance.lastSegmentViewportDistance * tileToViewport;
        return tileDistance.prevTileDistance +
            lastSegmentTile +
            (incidenceStretch - 1) * lastSegmentTile * Math.abs(Math.sin(lastSegmentAngle));
    }

    placeCollisionCircles(collisionCircles?: Array<any>,
                          allowOverlap: boolean,
                          scale: number,
                          pixelsToTileUnits: number,
                          key: string,
                          symbol: any,
                          lineVertexArray: any,
                          glyphOffsetArray: any,
                          fontSize: number,
                          posMatrix: mat4,
                          labelPlaneMatrix: mat4,
                          showCollisionCircles: boolean,
                          pitchWithMap: boolean): Array<number> {
        const placedCollisionCircles = [];
        if (!collisionCircles) {
            return placedCollisionCircles;
        }

        const projectedAnchor = this.projectAnchor(posMatrix, symbol.anchorX, symbol.anchorY);

        const projectionCache = {};
        const fontScale = fontSize / 24;
        const lineOffsetX = symbol.lineOffsetX * fontSize;
        const lineOffsetY = symbol.lineOffsetY * fontSize;

        const tileUnitAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
        const labelPlaneAnchorPoint = projection.project(tileUnitAnchorPoint, labelPlaneMatrix).point;
        const firstAndLastGlyph = projection.placeFirstAndLastGlyph(
            fontScale,
            glyphOffsetArray,
            lineOffsetX,
            lineOffsetY,
            /*flip*/ false,
            labelPlaneAnchorPoint,
            tileUnitAnchorPoint,
            symbol,
            lineVertexArray,
            labelPlaneMatrix,
            projectionCache,
            /*return tile distance*/ true);

        if (projectedAnchor.perspectiveRatio < .2 || !firstAndLastGlyph) {
            // This label either doesn't fit on its line or is way off screen: mark it unused.
            for (let k = 0; k < collisionCircles.length; k += 5) {
                collisionCircles[k + 4] = true;
            }
            return [];
        }

        let collisionDetected = false;

        const tileToViewport = projectedAnchor.perspectiveRatio * pixelsToTileUnits;
        const tileToViewportScaled = tileToViewport * scale;

        let firstTileDistance = 0, lastTileDistance = 0;
        if (firstAndLastGlyph) {
            firstTileDistance = this.approximateTileDistance(firstAndLastGlyph.first.tileDistance, firstAndLastGlyph.first.angle, tileToViewport, projectedAnchor.cameraDistance, pitchWithMap);
            lastTileDistance = this.approximateTileDistance(firstAndLastGlyph.last.tileDistance, firstAndLastGlyph.last.angle, tileToViewport, projectedAnchor.cameraDistance, pitchWithMap);
        }

        for (let k = 0; k < collisionCircles.length; k += 5) {
            const boxDistanceToAnchor = collisionCircles[k + 3];
            const tileUnitRadius = collisionCircles[k + 2];
            if ((boxDistanceToAnchor < -firstTileDistance) ||
                (boxDistanceToAnchor - tileUnitRadius > lastTileDistance)) {
                // Don't need to use this circle because the label doesn't extend this far
                collisionCircles[k + 4] = true;
                continue;
            }

            const projectedPoint = this.projectPoint(posMatrix, collisionCircles[k], collisionCircles[k + 1]);
            const x = projectedPoint.x;
            const y = projectedPoint.y;

            const radius = tileUnitRadius / tileToViewportScaled;

            if (placedCollisionCircles.length) {
                const dx = x - placedCollisionCircles[placedCollisionCircles.length - 4];
                const dy = y - placedCollisionCircles[placedCollisionCircles.length - 3];
                if (radius * radius * 2 > dx * dx + dy * dy) {
                    if ((k + 8) < collisionCircles.length) {
                        const nextBoxDistanceToAnchor = collisionCircles[k + 8];
                        if ((nextBoxDistanceToAnchor > -firstTileDistance) &&
                        (nextBoxDistanceToAnchor < lastTileDistance)) {
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

        const posMatrix = this.transform.calculatePosMatrix(tileCoord, tileSourceMaxZoom);

        const query = [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < queryGeometry.length; i++) {
            const ring = queryGeometry[i];
            for (let k = 0; k < ring.length; k++) {
                const p = this.projectPoint(posMatrix, ring[k].x, ring[k].y);
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
            const projectedPoint = this.projectAndGetPerspectiveRatio(posMatrix, blocking.anchorPointX, blocking.anchorPointY);
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
    insertCollisionBox(collisionBox: Array<number>, ignorePlacement: boolean, tileID: number, boxStartIndex: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        const key = { tileID: tileID, boxIndex: boxStartIndex };
        grid.insert(key, collisionBox[0], collisionBox[1], collisionBox[2], collisionBox[3]);
    }

    insertCollisionCircles(collisionCircles: Array<any>, ignorePlacement: boolean, tileID: number, boxStartIndex: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        for (let k = 0; k < collisionCircles.length; k += 4) {
            const key = { tileID: tileID, boxIndex: boxStartIndex + collisionCircles[k + 3] };
            grid.insertCircle(key, collisionCircles[k],
                collisionCircles[k + 1],
                collisionCircles[k + 2]);
        }
    }

    projectAnchor(posMatrix: mat4, x: number, y: number) {
        const p = [x, y, 0, 1];
        projection.xyTransformMat4(p, p, posMatrix);
        return {
            perspectiveRatio: 0.5 + 0.5 * (p[3] / this.transform.cameraToCenterDistance),
            cameraDistance: p[3]
        };
    }

    projectPoint(posMatrix: mat4, x: number, y: number) {
        const p = [x, y, 0, 1];
        projection.xyTransformMat4(p, p, posMatrix);
        return new Point(
            (((p[0] / p[3] + 1) / 2) * this.transform.width) + viewportPadding,
            (((-p[1] / p[3] + 1) / 2) * this.transform.height) + viewportPadding
        );
    }

    projectAndGetPerspectiveRatio(posMatrix: mat4, x: number, y: number) {
        const p = [x, y, 0, 1];
        projection.xyTransformMat4(p, p, posMatrix);
        const a = new Point(
            (((p[0] / p[3] + 1) / 2) * this.transform.width) + viewportPadding,
            (((-p[1] / p[3] + 1) / 2) * this.transform.height) + viewportPadding
        );
        return {
            point: a,
            perspectiveRatio: 0.5 + 0.5 * (p[3] / this.transform.cameraToCenterDistance)
        };
    }

}

module.exports = CollisionIndex;
