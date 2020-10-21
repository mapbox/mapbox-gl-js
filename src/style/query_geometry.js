// @flow

import Point from '@mapbox/point-geometry';
import {getBounds, clamp, polygonizeBounds, bufferConvexPolygon} from '../util/util';
import {polygonIntersectsBox} from '../util/intersection_tests';
import EXTENT from '../data/extent';
import type {PointLike} from '@mapbox/point-geometry';
import type Transform from '../geo/transform';
import type Tile from '../source/tile';
import pixelsToTileUnits from '../source/pixels_to_tile_units';
import {vec3} from 'gl-matrix';
import {Ray} from '../util/primitives';
import MercatorCoordinate from '../geo/mercator_coordinate';
import type {OverscaledTileID} from '../source/tile_id';

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
     * @param {(PointLike | [PointLike, PointLike])} geometry
     * @param {Transform} transform
     * @returns {QueryGeometry}
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
     * Due to data-driven styling features do not uniform size(eg `circle-radius`) and can be offset differntly
     * from their original location(for eg. with `*-translate`). This means we have to expand our query region for
     * each tile to account for variation in these properties.
     * Each tile calculates a tile level max padding value (in screenspace pixels) when its parsed, this function
     * lets us calculate a buffered version of the screenspace query geometry for each tile.
     *
     * @param {number} buffer
     * @returns {Point[]}
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
     * This returns a geometry thats a triangle, with the base of the triangle being the far points
     * of the query frustum, and the top of the triangle being the point underneath the camera.
     * Similar to `bufferedScreenGeometry`, buffering is added to account for variation in paint properties.
     *
     * @param {number} buffer
     * @returns {Point[]}
     */
    bufferedCameraGeometry(buffer: number): Point[] {
        const cameraTriangle = [
            this.screenBounds[0],
            this.screenBounds.length === 1 ? this.screenBounds[0].add(new Point(1, 0)) : this.screenBounds[1],
            this.cameraPoint
        ];

        return bufferConvexPolygon(cameraTriangle, buffer);
    }

    /**
     * Checks if a tile is contained within this query geometry.
     *
     * @param {Tile} tile
     * @param {Transform} transform
     * @param {boolean} use3D
     * @returns {?TilespaceQueryGeometry} Returns undefined if the tile does not intersect
     */
    containsTile(tile: Tile, transform: Transform, use3D: boolean): ?TilespaceQueryGeometry {
        // The buffer around the query geometry is applied in screen-space.
        // Floating point errors when projecting into tilespace could leave a feature
        // outside the query volume even if it looks like it overlaps visually, a 1px bias value overcomes that.
        const bias = 1;
        const padding = tile.queryPadding + bias;

        const geometryForTileCheck = use3D ?
            this._bufferedCameraMercator(padding, transform).map((p) => tile.tileID.getTilePoint(p)) :
            this._bufferedScreenMercator(padding, transform).map((p) => tile.tileID.getTilePoint(p));
        const tilespaceVec3s = this.screenGeometryMercator.map((p) => tile.tileID.getTileVec3(p));
        const tilespaceGeometry = tilespaceVec3s.map((v) => new Point(v[0], v[1]));

        const cameraMercator = transform.getFreeCameraOptions().position || new MercatorCoordinate(0, 0, 0);
        const tilespaceCameraPosition = tile.tileID.getTileVec3(cameraMercator);
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
