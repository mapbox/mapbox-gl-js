// @flow

import Point from '@mapbox/point-geometry';
import {getBounds, clamp, polygonizeBounds, bufferConvexPolygon} from '../util/util.js';
import {polygonIntersectsBox, polygonContainsPoint} from '../util/intersection_tests.js';
import EXTENT from '../data/extent.js';
import type {PointLike} from '@mapbox/point-geometry';
import type Transform from '../geo/transform.js';
import type Tile from '../source/tile.js';
import pixelsToTileUnits from '../source/pixels_to_tile_units.js';
import {vec3, vec4, mat4} from 'gl-matrix';
import {Ray} from '../util/primitives.js';
import MercatorCoordinate, {mercatorXfromLng} from '../geo/mercator_coordinate.js';
import type {OverscaledTileID} from '../source/tile_id.js';
import {getTilePoint, getTileVec3} from '../geo/projection/tile_transform.js';
import resample from '../geo/projection/resample.js';
import {GLOBE_RADIUS} from '../geo/projection/globe_util.js';
import {number as interpolate} from '../style-spec/util/interpolate.js';

type CachedPolygon = {
    // Query rectangle projected on the map plane
    polygon: MercatorCoordinate[];

    // A flag tellingwhether the query polygon might span across mercator boundaries [0, 1]
    unwrapped: boolean;
};

/**
 * A data-class that represents a screenspace query from `Map#queryRenderedFeatures`.
 * All the internal geometries and data are intented to be immutable and read-only.
 * Its lifetime is only for the duration of the query and fixed state of the map while the query is being processed.
 *
 * @class QueryGeometry
 */
export class QueryGeometry {
    screenBounds: Point[];
    cameraPoint: Point;
    screenGeometry: Point[];
    screenGeometryMercator: CachedPolygon;

    _screenRaycastCache: { [_: number]: CachedPolygon};
    _cameraRaycastCache: { [_: number]: CachedPolygon};

    isAboveHorizon: boolean;

    constructor(screenBounds: Point[], cameraPoint: Point, aboveHorizon: boolean, transform: Transform) {
        this.screenBounds = screenBounds;
        this.cameraPoint = cameraPoint;
        this._screenRaycastCache = {};
        this._cameraRaycastCache = {};
        this.isAboveHorizon = aboveHorizon;

        this.screenGeometry = this.bufferedScreenGeometry(0);
        this.screenGeometryMercator = this._bufferedScreenMercator(0, transform);
    }

    /**
     * Factory method to help contruct an instance  while accounting for current map state.
     *
     * @static
     * @param {(PointLike | [PointLike, PointLike])} geometry The query geometry.
     * @param {Transform} transform The current map transform.
     * @returns {QueryGeometry} An instance of the QueryGeometry class.
     */
    static createFromScreenPoints(geometry: PointLike | [PointLike, PointLike], transform: Transform): QueryGeometry {
        let screenGeometry;
        let aboveHorizon;
        if (geometry instanceof Point || typeof geometry[0] === 'number') {
            const pt = Point.convert(geometry);
            screenGeometry = [Point.convert(geometry)];
            aboveHorizon = transform.isPointAboveHorizon(pt);
        } else {
            const tl = Point.convert(geometry[0]);
            const br = Point.convert(geometry[1]);
            screenGeometry = [tl, br];
            aboveHorizon = polygonizeBounds(tl, br).every((p) => transform.isPointAboveHorizon(p));
        }

        return new QueryGeometry(screenGeometry, transform.getCameraPoint(), aboveHorizon, transform);
    }

    /**
     * Returns true if the initial query by the user was a single point.
     *
     * @returns {boolean} Returns `true` if the initial query geometry was a single point.
     */
    isPointQuery(): boolean {
        return this.screenBounds.length === 1;
    }

    /**
     * Due to data-driven styling features do not uniform size(eg `circle-radius`) and can be offset differntly
     * from their original location(for example with `*-translate`). This means we have to expand our query region for
     * each tile to account for variation in these properties.
     * Each tile calculates a tile level max padding value (in screenspace pixels) when its parsed, this function
     * lets us calculate a buffered version of the screenspace query geometry for each tile.
     *
     * @param {number} buffer The tile padding in screenspace pixels.
     * @returns {Point[]} The buffered query geometry.
     */
    bufferedScreenGeometry(buffer: number): Point[] {
        return polygonizeBounds(
            this.screenBounds[0],
            this.screenBounds.length === 1 ? this.screenBounds[0] : this.screenBounds[1],
            buffer
        );
    }

    /**
     * When the map is pitched, some of the 3D features that intersect a query will not intersect
     * the query at the surface of the earth. Instead the feature may be closer and only intersect
     * the query because it extrudes into the air.
     *
     * This returns a geometry that is a convex polygon that encompasses the query frustum and the point underneath the camera.
     * Similar to `bufferedScreenGeometry`, buffering is added to account for variation in paint properties.
     *
     * Case 1: point underneath camera is exactly behind query volume
     *              +----------+
     *              |          |
     *              |          |
     *              |          |
     *              +          +
     *               X        X
     *                X      X
     *                 X    X
     *                  X  X
     *                   XX.
     *
     * Case 2: point is behind and to the right
     *              +----------+
     *              |          X
     *              |           X
     *              |           XX
     *              +            X
     *              XXX          XX
     *                 XXXX       X
     *                    XXX     XX
     *                        XX   X
     *                           XXX.
     *
     * Case 3: point is behind and to the left
     *              +----------+
     *             X           |
     *             X           |
     *            XX           |
     *            X            +
     *           X          XXXX
     *          XX       XXX
     *          X    XXXX
     *         X XXXX
     *         XXX.
     *
     * @param {number} buffer The tile padding in screenspace pixels.
     * @returns {Point[]} The buffered query geometry.
     */
    bufferedCameraGeometry(buffer: number): Point[] {
        const min = this.screenBounds[0];
        const max = this.screenBounds.length === 1 ? this.screenBounds[0].add(new Point(1, 1)) : this.screenBounds[1];
        const cameraPolygon = polygonizeBounds(min, max, 0, false);

        // Only need to account for point underneath camera if its behind query volume
        if (this.cameraPoint.y > max.y) {
            //case 1: insert point in the middle
            if (this.cameraPoint.x > min.x && this.cameraPoint.x < max.x) {
                cameraPolygon.splice(3, 0, this.cameraPoint);
            //case 2: replace btm right point
            } else if (this.cameraPoint.x >= max.x) {
                cameraPolygon[2] = this.cameraPoint;
            //case 3: replace btm left point
            } else if (this.cameraPoint.x <= min.x) {
                cameraPolygon[3] = this.cameraPoint;
            }
        }

        return bufferConvexPolygon(cameraPolygon, buffer);
    }

    // Creates a convex polygon in screen coordinates that encompasses the query frustum and
    // the camera location at globe's surface. Camera point can be at any side of the query polygon as
    // opposed to `bufferedCameraGeometry` which restricts the location to underneath the polygon.
    bufferedCameraGeometryGlobe(buffer: number): Point[] {
        const min = this.screenBounds[0];
        const max = this.screenBounds.length === 1 ? this.screenBounds[0].add(new Point(1, 1)) : this.screenBounds[1];

        // Padding is added to the query polygon before inclusion of the camera location.
        // Otherwise the buffered (narrow) polygon could penetrate the globe creating a lot of false positives
        const cameraPolygon = polygonizeBounds(min, max, buffer);

        const camPos = this.cameraPoint.clone();
        const column = (camPos.x > min.x) + (camPos.x > max.x);
        const row = (camPos.y > min.y) + (camPos.y > max.y);
        const sector = row * 3 + column;

        switch (sector) {
        case 0:     // replace top-left point (closed polygon)
            cameraPolygon[0] = camPos;
            cameraPolygon[4] = camPos.clone();
            break;
        case 1:     // insert point in the middle of top-left and top-right
            cameraPolygon.splice(1, 0, camPos);
            break;
        case 2:     // replace top-right point
            cameraPolygon[1] = camPos;
            break;
        case 3:     // insert point in the middle of top-left and bottom-left
            cameraPolygon.splice(4, 0, camPos);
            break;
        case 5:     // insert point in the middle of top-right and bottom-right
            cameraPolygon.splice(2, 0, camPos);
            break;
        case 6:     // replace bottom-left point
            cameraPolygon[3] = camPos;
            break;
        case 7:     // insert point in the middle of bottom-left and bottom-right
            cameraPolygon.splice(3, 0, camPos);
            break;
        case 8:     // replace bottom-right point
            cameraPolygon[2] = camPos;
            break;
        }

        return cameraPolygon;
    }

    /**
     * Checks if a tile is contained within this query geometry.
     *
     * @param {Tile} tile The tile to check.
     * @param {Transform} transform The current map transform.
     * @param {boolean} use3D A boolean indicating whether to query 3D features.
     * @param {number} cameraWrap A wrap value for offsetting the camera position.
     * @returns {?TilespaceQueryGeometry} Returns `undefined` if the tile does not intersect.
     */
    containsTile(tile: Tile, transform: Transform, use3D: boolean, cameraWrap: number = 0): ?TilespaceQueryGeometry {
        // The buffer around the query geometry is applied in screen-space.
        // transform._pixelsPerMercatorPixel is used to compensate any extra scaling applied from the currently active projection.
        // Floating point errors when projecting into tilespace could leave a feature
        // outside the query volume even if it looks like it overlaps visually, a 1px bias value overcomes that.
        const bias = 1;
        const padding = tile.queryPadding / transform._pixelsPerMercatorPixel + bias;

        const cachedQuery = use3D ?
            this._bufferedCameraMercator(padding, transform) :
            this._bufferedScreenMercator(padding, transform);

        let wrap = tile.tileID.wrap + (cachedQuery.unwrapped ? cameraWrap : 0);
        const geometryForTileCheck = cachedQuery.polygon.map((p) => getTilePoint(tile.tileTransform, p, wrap));

        if (!polygonIntersectsBox(geometryForTileCheck, 0, 0, EXTENT, EXTENT)) {
            return undefined;
        }

        wrap = tile.tileID.wrap + (this.screenGeometryMercator.unwrapped ? cameraWrap : 0);
        const tilespaceVec3s = this.screenGeometryMercator.polygon.map((p) => getTileVec3(tile.tileTransform, p, wrap));
        const tilespaceGeometry = tilespaceVec3s.map((v) => new Point(v[0], v[1]));

        const cameraMercator = transform.getFreeCameraOptions().position || new MercatorCoordinate(0, 0, 0);
        const tilespaceCameraPosition = getTileVec3(tile.tileTransform, cameraMercator, wrap);
        const tilespaceRays = tilespaceVec3s.map((tileVec) => {
            const dir = vec3.sub(tileVec, tileVec, tilespaceCameraPosition);
            vec3.normalize(dir, dir);
            return new Ray(tilespaceCameraPosition, dir);
        });
        const pixelToTileUnitsFactor = pixelsToTileUnits(tile, 1, transform.zoom) * transform._pixelsPerMercatorPixel;

        return {
            queryGeometry: this,
            tilespaceGeometry,
            tilespaceRays,
            bufferedTilespaceGeometry: geometryForTileCheck,
            bufferedTilespaceBounds: clampBoundsToTileExtents(getBounds(geometryForTileCheck)),
            tile,
            tileID: tile.tileID,
            pixelToTileUnitsFactor
        };
    }

    /**
     * These methods add caching on top of the terrain raycasting provided by `Transform#pointCoordinate3d`.
     * Tiles come with different values of padding, however its very likely that multiple tiles share the same value of padding
     * based on the style. In that case we want to reuse the result from a previously computed terrain raycast.
     */

    _bufferedScreenMercator(padding: number, transform: Transform): CachedPolygon {
        const key = cacheKey(padding);
        if (this._screenRaycastCache[key]) {
            return this._screenRaycastCache[key];
        } else {
            let poly: CachedPolygon;

            if (transform.projection.name === 'globe') {
                poly = this._projectAndResample(this.bufferedScreenGeometry(padding), transform);
            } else {
                poly = {
                    polygon: this.bufferedScreenGeometry(padding).map((p) => transform.pointCoordinate3D(p)),
                    unwrapped: true
                };
            }

            this._screenRaycastCache[key] = poly;
            return poly;
        }
    }

    _bufferedCameraMercator(padding: number, transform: Transform): CachedPolygon {
        const key = cacheKey(padding);
        if (this._cameraRaycastCache[key]) {
            return this._cameraRaycastCache[key];
        } else {
            let poly: CachedPolygon;

            if (transform.projection.name === 'globe') {
                poly = this._projectAndResample(this.bufferedCameraGeometryGlobe(padding), transform);
            } else {
                poly = {
                    polygon: this.bufferedCameraGeometry(padding).map((p) => transform.pointCoordinate3D(p)),
                    unwrapped: true
                };
            }

            this._cameraRaycastCache[key] = poly;
            return poly;
        }
    }

    _projectAndResample(polygon: Point[], transform: Transform): CachedPolygon {
        // Handle a special case where either north or south pole is inside the query polygon
        const polePolygon: ?CachedPolygon = projectPolygonCoveringPoles(polygon, transform);

        if (polePolygon) {
            return polePolygon;
        }

        // Resample the polygon by adding intermediate points so that straight lines of the shape
        // are correctly projected on the surface of the globe.
        const resampled = unwrapQueryPolygon(resamplePolygon(polygon, transform).map(p => new Point(wrap(p.x), p.y)), transform);

        return {
            polygon: resampled.polygon.map(p => new MercatorCoordinate(p.x, p.y)),
            unwrapped: resampled.unwrapped
        };
    }
}

// Checks whether the provided polygon is crossing the antimeridian line and unwraps it if necessary.
// The resulting polygon is continuous
export function unwrapQueryPolygon(polygon: Point[], tr: Transform): {polygon: Point[], unwrapped: boolean} {
    let unwrapped = false;

    // Traverse edges of the polygon and unwrap vertices that are crossing the antimeridian.
    let maxX = -Infinity;
    let startEdge = 0;

    for (let e = 0; e < polygon.length - 1; e++) {
        if (polygon[e].x > maxX) {
            maxX = polygon[e].x;
            startEdge = e;
        }
    }

    for (let i = 0; i < polygon.length - 1; i++) {
        const edge = (startEdge + i) % (polygon.length - 1);
        const a = polygon[edge];
        const b = polygon[edge + 1];

        if (Math.abs(a.x - b.x) > 0.5) {
            // A straight line drawn on the globe can't have longer length than 0.5 on the x-axis
            // without crossing the antimeridian
            if (a.x < b.x) {
                a.x += 1;

                if (edge === 0) {
                    // First and last points are duplicate for closed polygons
                    polygon[polygon.length - 1].x += 1;
                }
            } else {
                b.x += 1;

                if (edge + 1 === polygon.length - 1) {
                    polygon[0].x += 1;
                }
            }

            unwrapped = true;
        }
    }

    const cameraX = mercatorXfromLng(tr.center.lng);
    if (unwrapped && cameraX < Math.abs(cameraX - 1)) {
        polygon.forEach(p => { p.x -= 1; });
    }

    return {
        polygon,
        unwrapped
    };
}

// Special function for handling scenarios where one of the poles is inside the query polygon.
// Finding projection of these kind of polygons is more involving as projecting just the corners will
// produce a degenerate (self-intersecting, non-continuous, etc.) polygon in mercator coordinates
export function projectPolygonCoveringPoles(polygon: Point[], tr: Transform): ?CachedPolygon {
    const matrix = mat4.multiply([], tr.pixelMatrix, tr.globeMatrix);

    // Transform north and south pole coordinates to the screen to see if they're
    // inside the query polygon
    const northPole = [0, -GLOBE_RADIUS, 0, 1];
    const southPole = [0, GLOBE_RADIUS, 0, 1];
    const center = [0, 0, 0, 1];

    vec4.transformMat4(northPole, northPole, matrix);
    vec4.transformMat4(southPole, southPole, matrix);
    vec4.transformMat4(center, center, matrix);

    const screenNp = new Point(northPole[0] / northPole[3], northPole[1] / northPole[3]);
    const screenSp = new Point(southPole[0] / southPole[3], southPole[1] / southPole[3]);
    const containsNp = polygonContainsPoint(polygon, screenNp) && northPole[3] < center[3];
    const containsSp = polygonContainsPoint(polygon, screenSp) && southPole[3] < center[3];

    if (!containsNp && !containsSp) {
        return null;
    }

    // Project corner points of the polygon and traverse the ring to find the edge that's
    // crossing the zero longitude border.
    const result = findEdgeCrossingAntimeridian(polygon, tr, containsNp ? -1 : 1);

    if (!result) {
        return null;
    }

    // Start constructing the new polygon by resampling edges until the crossing edge
    const {idx, t} = result;
    let partA = idx > 1 ? resamplePolygon(polygon.slice(0, idx), tr) : [];
    let partB = idx < polygon.length ? resamplePolygon(polygon.slice(idx), tr) : [];

    partA = partA.map(p => new Point(wrap(p.x), p.y));
    partB = partB.map(p => new Point(wrap(p.x), p.y));

    // Resample first section of the ring (up to the edge that crosses the 0-line)
    const resampled = [...partA];

    if (resampled.length === 0) {
        resampled.push(partB[partB.length - 1]);
    }

    // Find location of the crossing by interpolating mercator coordinates.
    // This will produce slightly off result as the crossing edge is not actually
    // linear on the globe.
    const a = resampled[resampled.length - 1];
    const b = partB.length === 0 ? partA[0] : partB[0];
    const intersectionY = interpolate(a.y, b.y, t);

    let mid;

    if (containsNp) {
        mid = [
            new Point(0, intersectionY),
            new Point(0, 0),
            new Point(1, 0),
            new Point(1, intersectionY)
        ];
    } else {
        mid = [
            new Point(1, intersectionY),
            new Point(1, 1),
            new Point(0, 1),
            new Point(0, intersectionY)
        ];
    }

    resampled.push(...mid);

    // Resample to the second section of the ring
    if (partB.length === 0) {
        resampled.push(partA[0]);
    } else {
        resampled.push(...partB);
    }

    return {
        polygon: resampled.map(p => new MercatorCoordinate(p.x, p.y)),
        unwrapped: false
    };
}

function resamplePolygon(polygon: Point[], transform: Transform): Point[] {
    // Choose a tolerance value for the resampling logic that produces sufficiently
    // accurate polygons without creating too many points. The value 1 / 256 was chosen
    // based on empirical testing
    const tolerance = 1.0 / 256.0;
    return resample(
        polygon,
        p => {
            const mc = transform.pointCoordinate3D(p);
            p.x = mc.x;
            p.y = mc.y;
        },
        tolerance);
}

function wrap(mercatorX: number): number {
    return mercatorX < 0 ? 1 + (mercatorX % 1) : mercatorX % 1;
}

function findEdgeCrossingAntimeridian(polygon: Point[], tr: Transform, direction: number): ?{idx: number, t: number} {
    for (let i = 1; i < polygon.length; i++) {
        const a = wrap(tr.pointCoordinate3D(polygon[i - 1]).x);
        const b = wrap(tr.pointCoordinate3D(polygon[i]).x);

        // direction < 0: mercator coordinate 0 will be crossed from left
        // direction > 0: mercator coordinate 1 will be crossed from right
        if (direction < 0) {
            if (a < b) {
                return {idx: i, t: -a / (b - 1 - a)};
            }
        } else {
            if (b < a) {
                return {idx: i, t: (1 - a) / (b + 1 - a)};
            }
        }
    }

    return null;
}

//Padding is in screen pixels and is only used as a coarse check, so 2 decimal places of precision should be good enough for a cache.
function cacheKey(padding: number): number  {
    return (padding * 100) | 0;
}

export type TilespaceQueryGeometry = {
    queryGeometry: QueryGeometry,
    tilespaceGeometry: Point[],
    tilespaceRays: Ray[],
    bufferedTilespaceGeometry: Point[],
    bufferedTilespaceBounds: { min: Point, max: Point},
    tile: Tile,
    tileID: OverscaledTileID,
    pixelToTileUnitsFactor: number
};

function clampBoundsToTileExtents(bounds: {min: Point, max: Point}): {min: Point, max: Point} {
    bounds.min.x = clamp(bounds.min.x, 0, EXTENT);
    bounds.min.y = clamp(bounds.min.y, 0, EXTENT);

    bounds.max.x = clamp(bounds.max.x, 0, EXTENT);
    bounds.max.y = clamp(bounds.max.y, 0, EXTENT);
    return bounds;
}
