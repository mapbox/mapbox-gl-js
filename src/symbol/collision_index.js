// @flow

const Point = require('@mapbox/point-geometry');
const intersectionTests = require('../util/intersection_tests');

const Grid = require('./grid_index');
const glmatrix = require('@mapbox/gl-matrix');

const mat4 = glmatrix.mat4;

const projection = require('../symbol/projection');

import type Transform from '../geo/transform';
import type {OverscaledTileID} from '../source/tile_id';
import type {SingleCollisionBox} from '../data/bucket/symbol_bucket';
import type {
    CollisionBoxArray,
    GlyphOffsetArray,
    SymbolLineVertexArray
} from '../data/array_types';

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
 * There are two steps to insertion: first placeCollisionBox/Circles checks if
 * there's room for a symbol, then insertCollisionBox/Circles actually puts the
 * symbol in the index. The two step process allows paired symbols to be inserted
 * together even if they overlap.
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

    placeCollisionBox(collisionBox: SingleCollisionBox, allowOverlap: boolean, textPixelRatio: number, posMatrix: mat4): Array<number> {
        const projectedPoint = this.projectAndGetPerspectiveRatio(posMatrix, collisionBox.anchorPointX, collisionBox.anchorPointY);
        const tileToViewport = textPixelRatio * projectedPoint.perspectiveRatio;
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

    approximateTileDistance(tileDistance: any, lastSegmentAngle: number, pixelsToTileUnits: number, cameraToAnchorDistance: number, pitchWithMap: boolean): number {
        // This is a quick and dirty solution for chosing which collision circles to use (since collision circles are
        // laid out in tile units). Ideally, I think we should generate collision circles on the fly in viewport coordinates
        // at the time we do collision detection.
        // See https://github.com/mapbox/mapbox-gl-js/issues/5474

        // incidenceStretch is the ratio of how much y space a label takes up on a tile while drawn perpendicular to the viewport vs
        //  how much space it would take up if it were drawn flat on the tile
        // Using law of sines, camera_to_anchor/sin(ground_angle) = camera_to_center/sin(incidence_angle)
        // Incidence angle 90 -> head on, sin(incidence_angle) = 1, no stretch
        // Incidence angle 1 -> very oblique, sin(incidence_angle) =~ 0, lots of stretch
        // ground_angle = u_pitch + PI/2 -> sin(ground_angle) = cos(u_pitch)
        // incidenceStretch = 1 / sin(incidenceAngle)

        const incidenceStretch = pitchWithMap ? 1 : cameraToAnchorDistance / this.pitchfactor;
        const lastSegmentTile = tileDistance.lastSegmentViewportDistance * pixelsToTileUnits;
        return tileDistance.prevTileDistance +
            lastSegmentTile +
            (incidenceStretch - 1) * lastSegmentTile * Math.abs(Math.sin(lastSegmentAngle));
    }

    placeCollisionCircles(collisionCircles: Array<number>,
                          allowOverlap: boolean,
                          scale: number,
                          textPixelRatio: number,
                          key: string,
                          symbol: any,
                          lineVertexArray: SymbolLineVertexArray,
                          glyphOffsetArray: GlyphOffsetArray,
                          fontSize: number,
                          posMatrix: mat4,
                          labelPlaneMatrix: mat4,
                          showCollisionCircles: boolean,
                          pitchWithMap: boolean): Array<number> {
        const placedCollisionCircles = [];

        const projectedAnchor = this.projectAnchor(posMatrix, symbol.anchorX, symbol.anchorY);

        const projectionCache = {};
        const fontScale = fontSize / 24;
        const lineOffsetX = symbol.lineOffsetX * fontSize;
        const lineOffsetY = symbol.lineOffsetY * fontSize;

        const tileUnitAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
        // projection.project generates NDC coordinates, as opposed to the
        // pixel-based grid coordinates generated by this.projectPoint
        const labelPlaneAnchorPoint =
            projection.project(tileUnitAnchorPoint, labelPlaneMatrix).point;
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

        let collisionDetected = false;

        const tileToViewport = projectedAnchor.perspectiveRatio * textPixelRatio;
        // equivalent to pixel_to_tile_units
        const pixelsToTileUnits = tileToViewport / scale;

        let firstTileDistance = 0, lastTileDistance = 0;
        if (firstAndLastGlyph) {
            firstTileDistance = this.approximateTileDistance(firstAndLastGlyph.first.tileDistance, firstAndLastGlyph.first.angle, pixelsToTileUnits, projectedAnchor.cameraDistance, pitchWithMap);
            lastTileDistance = this.approximateTileDistance(firstAndLastGlyph.last.tileDistance, firstAndLastGlyph.last.angle, pixelsToTileUnits, projectedAnchor.cameraDistance, pitchWithMap);
        }

        for (let k = 0; k < collisionCircles.length; k += 5) {
            const anchorPointX = collisionCircles[k];
            const anchorPointY = collisionCircles[k + 1];
            const tileUnitRadius = collisionCircles[k + 2];
            const boxSignedDistanceFromAnchor = collisionCircles[k + 3];
            if (!firstAndLastGlyph ||
                (boxSignedDistanceFromAnchor < -firstTileDistance) ||
                (boxSignedDistanceFromAnchor > lastTileDistance)) {
                // The label either doesn't fit on its line or we
                // don't need to use this circle because the label
                // doesn't extend this far. Either way, mark the circle unused.
                markCollisionCircleUsed(collisionCircles, k, false);
                continue;
            }

            const projectedPoint = this.projectPoint(posMatrix, anchorPointX, anchorPointY);
            const radius = tileUnitRadius / tileToViewport;

            const atLeastOneCirclePlaced = placedCollisionCircles.length > 0;
            if (atLeastOneCirclePlaced) {
                const dx = projectedPoint.x - placedCollisionCircles[placedCollisionCircles.length - 4];
                const dy = projectedPoint.y - placedCollisionCircles[placedCollisionCircles.length - 3];
                // The circle edges touch when the distance between their centers is 2x the radius
                // When the distance is 1x the radius, they're doubled up, and we could remove
                // every other circle while keeping them all in touch.
                // We actually start removing circles when the distance is √2x the radius:
                //  thinning the number of circles as much as possible is a major performance win,
                //  and the small gaps introduced don't make a very noticeable difference.
                const placedTooDensely = radius * radius * 2 > dx * dx + dy * dy;
                if (placedTooDensely) {
                    const atLeastOneMoreCircle = (k + 8) < collisionCircles.length;
                    if (atLeastOneMoreCircle) {
                        const nextBoxDistanceToAnchor = collisionCircles[k + 8];
                        if ((nextBoxDistanceToAnchor > -firstTileDistance) &&
                        (nextBoxDistanceToAnchor < lastTileDistance)) {
                            // Hide significantly overlapping circles, unless this is the last one we can
                            // use, in which case we want to keep it in place even if it's tightly packed
                            // with the one before it.
                            markCollisionCircleUsed(collisionCircles, k, false);
                            continue;
                        }
                    }
                }
            }
            const collisionBoxArrayIndex = k / 5;
            placedCollisionCircles.push(projectedPoint.x, projectedPoint.y, radius, collisionBoxArrayIndex);
            markCollisionCircleUsed(collisionCircles, k, true);

            if (!allowOverlap) {
                if (this.grid.hitTestCircle(projectedPoint.x, projectedPoint.y, radius)) {
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
     * See https://github.com/mapbox/mapbox-gl-js/issues/5475
     *
     * @private
     */
    queryRenderedSymbols(queryGeometry: any, tileCoord: OverscaledTileID, textPixelRatio: number, collisionBoxArray: CollisionBoxArray, sourceID: string) {
        const sourceLayerFeatures = {};
        const result = [];

        if (queryGeometry.length === 0 || (this.grid.keysLength() === 0 && this.ignoredGrid.keysLength() === 0)) {
            return result;
        }

        const posMatrix = this.transform.calculatePosMatrix(tileCoord.toUnwrapped());

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

        const tileID = tileCoord.key;

        const thisTileFeatures = [];
        const features = this.grid.query(minX, minY, maxX, maxY);
        for (let i = 0; i < features.length; i++) {
            if (features[i].sourceID === sourceID && features[i].tileID === tileID) {
                thisTileFeatures.push(features[i].boxIndex);
            }
        }
        const ignoredFeatures = this.ignoredGrid.query(minX, minY, maxX, maxY);
        for (let i = 0; i < ignoredFeatures.length; i++) {
            if (ignoredFeatures[i].sourceID === sourceID && ignoredFeatures[i].tileID === tileID) {
                thisTileFeatures.push(ignoredFeatures[i].boxIndex);
            }
        }

        for (let i = 0; i < thisTileFeatures.length; i++) {
            const blocking = collisionBoxArray.get(thisTileFeatures[i]);
            const sourceLayer = blocking.sourceLayerIndex;
            const featureIndex = blocking.featureIndex;
            const bucketIndex = blocking.bucketIndex;

            // Skip already seen features.
            if (sourceLayerFeatures[sourceLayer] === undefined) {
                sourceLayerFeatures[sourceLayer] = {};
            }
            if (sourceLayerFeatures[sourceLayer][featureIndex] === undefined) {
                sourceLayerFeatures[sourceLayer][featureIndex] = {};
            }
            if (sourceLayerFeatures[sourceLayer][featureIndex][bucketIndex]) {
                continue;
            }

            // Check if query intersects with the feature box
            // "Collision Circles" for line labels are treated as boxes here
            // Since there's no actual collision taking place, the circle vs. square
            // distinction doesn't matter as much, and box geometry is easier
            // to work with.
            const projectedPoint = this.projectAndGetPerspectiveRatio(posMatrix, blocking.anchorPointX, blocking.anchorPointY);
            const tileToViewport = textPixelRatio * projectedPoint.perspectiveRatio;
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
            if (!intersectionTests.polygonIntersectsPolygon(query, bbox)) {
                continue;
            }

            sourceLayerFeatures[sourceLayer][featureIndex][bucketIndex] = true;
            result.push(thisTileFeatures[i]);
        }

        return result;
    }

    insertCollisionBox(collisionBox: Array<number>, ignorePlacement: boolean, tileID: number, sourceID: string, boxStartIndex: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        const key = { tileID: tileID, sourceID: sourceID, boxIndex: boxStartIndex };
        grid.insert(key, collisionBox[0], collisionBox[1], collisionBox[2], collisionBox[3]);
    }

    insertCollisionCircles(collisionCircles: Array<number>, ignorePlacement: boolean, tileID: number, sourceID: string, boxStartIndex: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        for (let k = 0; k < collisionCircles.length; k += 4) {
            const key = { tileID: tileID, sourceID: sourceID, boxIndex: boxStartIndex + collisionCircles[k + 3] };
            grid.insertCircle(key, collisionCircles[k], collisionCircles[k + 1], collisionCircles[k + 2]);
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

function markCollisionCircleUsed(collisionCircles: Array<number>, index: number, used: boolean) {
    collisionCircles[index + 4] = used ? 1 : 0;
}

module.exports = CollisionIndex;
