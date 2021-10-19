// @flow

import Point from '@mapbox/point-geometry';
import {getBounds, clamp, polygonizeBounds, bufferConvexPolygon} from '../util/util.js';
import {polygonIntersectsBox} from '../util/intersection_tests.js';
import EXTENT from '../data/extent.js';
import type {PointLike} from '@mapbox/point-geometry';
import type Transform from '../geo/transform.js';
import type Tile from '../source/tile.js';
import pixelsToTileUnits from '../source/pixels_to_tile_units.js';
import {vec3} from 'gl-matrix';
import {Ray} from '../util/primitives.js';
import MercatorCoordinate from '../geo/mercator_coordinate.js';
import type {OverscaledTileID} from '../source/tile_id.js';
import {getTilePoint, getTileVec3} from '../geo/projection/tile_transform.js';

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
    screenGeometryMercator: MercatorCoordinate[];
    cameraGeometry: Point[];

    _screenRaycastCache: { [_: number]: MercatorCoordinate[]};
    _cameraRaycastCache: { [_: number]: MercatorCoordinate[]};

    isAboveHorizon: boolean;

    constructor(screenBounds: Point[], cameraPoint: Point, aboveHorizon: boolean, transform: Transform) {
        this.screenBounds = screenBounds;
        this.cameraPoint = cameraPoint;
        this._screenRaycastCache = {};
        this._cameraRaycastCache = {};
        this.isAboveHorizon = aboveHorizon;

        this.screenGeometry = this.bufferedScreenGeometry(0);
        this.screenGeometryMercator = this.screenGeometry.map((p) => transform.pointCoordinate3D(p));
        this.cameraGeometry = this.bufferedCameraGeometry(0);
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

    /**
     * Checks if a tile is contained within this query geometry.
     *
     * @param {Tile} tile The tile to check.
     * @param {Transform} transform The current map transform.
     * @param {boolean} use3D A boolean indicating whether to query 3D features.
     * @returns {?TilespaceQueryGeometry} Returns `undefined` if the tile does not intersect.
     */
    containsTile(tile: Tile, transform: Transform, use3D: boolean): ?TilespaceQueryGeometry {
        // The buffer around the query geometry is applied in screen-space.
        // Floating point errors when projecting into tilespace could leave a feature
        // outside the query volume even if it looks like it overlaps visually, a 1px bias value overcomes that.
        const bias = 1;
        const padding = tile.queryPadding + bias;
        const wrap = tile.tileID.wrap;

        const geometryForTileCheck = use3D ?
            this._bufferedCameraMercator(padding, transform).map((p) => getTilePoint(tile.tileTransform, p, wrap)) :
            this._bufferedScreenMercator(padding, transform).map((p) => getTilePoint(tile.tileTransform, p, wrap));
        const tilespaceVec3s = this.screenGeometryMercator.map((p) => getTileVec3(tile.tileTransform, p, wrap));
        const tilespaceGeometry = tilespaceVec3s.map((v) => new Point(v[0], v[1]));

        const cameraMercator = transform.getFreeCameraOptions().position || new MercatorCoordinate(0, 0, 0);
        const tilespaceCameraPosition = getTileVec3(tile.tileTransform, cameraMercator, wrap);
        const tilespaceRays = tilespaceVec3s.map((tileVec) => {
            const dir = vec3.sub(tileVec, tileVec, tilespaceCameraPosition);
            vec3.normalize(dir, dir);
            return new Ray(tilespaceCameraPosition, dir);
        });
        const pixelToTileUnitsFactor = pixelsToTileUnits(tile, 1, transform.zoom);

        if (polygonIntersectsBox(geometryForTileCheck, 0, 0, EXTENT, EXTENT)) {
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
    }

    /**
     * These methods add caching on top of the terrain raycasting provided by `Transform#pointCoordinate3d`.
     * Tiles come with different values of padding, however its very likely that multiple tiles share the same value of padding
     * based on the style. In that case we want to reuse the result from a previously computed terrain raycast.
     */

    _bufferedScreenMercator(padding: number, transform: Transform): MercatorCoordinate[] {
        const key = cacheKey(padding);
        if (this._screenRaycastCache[key]) {
            return this._screenRaycastCache[key];
        } else {
            const poly = this.bufferedScreenGeometry(padding).map((p) => transform.pointCoordinate3D(p));
            this._screenRaycastCache[key] = poly;
            return poly;
        }
    }

    _bufferedCameraMercator(padding: number, transform: Transform): MercatorCoordinate[] {
        const key = cacheKey(padding);
        if (this._cameraRaycastCache[key]) {
            return this._cameraRaycastCache[key];
        } else {
            const poly = this.bufferedCameraGeometry(padding).map((p) => transform.pointCoordinate3D(p));
            this._cameraRaycastCache[key] = poly;
            return poly;
        }
    }
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
