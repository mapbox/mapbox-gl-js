// @flow

import MercatorCoordinate, {mercatorZfromAltitude} from '../geo/mercator_coordinate.js';
import DEMData from '../data/dem_data.js';
import SourceCache from '../source/source_cache.js';
import {number as interpolate} from '../style-spec/util/interpolate.js';
import EXTENT from '../data/extent.js';
import {vec3} from 'gl-matrix';
import Point from '@mapbox/point-geometry';
import {OverscaledTileID} from '../source/tile_id.js';

import type Projection from '../geo/projection/projection.js';
import type Tile from '../source/tile.js';
import type {Vec3} from 'gl-matrix';

/**
 * Options common to {@link Map#queryTerrainElevation} and {@link Map#unproject3d}, used to control how elevation
 * data is returned.
 *
 * @typedef {Object} ElevationQueryOptions
 * @property {boolean} exaggerated When set to `true` returns the value of the elevation with the terrains `exaggeration` on the style already applied,
 * when`false` it returns the raw value of the underlying data without styling applied.
 */
export type ElevationQueryOptions = {
    exaggerated: boolean
};

/**
 * Provides access to elevation data from raster-dem source cache.
 */
export class Elevation {

    /**
     * Helper that checks whether DEM data is available at a given mercator coordinate.
     * @param {MercatorCoordinate} point Mercator coordinate of the point to check against.
     * @returns {boolean} `true` indicating whether the data is available at `point`, and `false` otherwise.
     */
    isDataAvailableAtPoint(point: MercatorCoordinate): boolean {
        const sourceCache = this._source();
        if (this.isUsingMockSource() || !sourceCache || point.y < 0.0 || point.y > 1.0) {
            return false;
        }

        const cache: SourceCache = sourceCache;
        const z = cache.getSource().maxzoom;
        const tiles = 1 << z;
        const wrap = Math.floor(point.x);
        const px = point.x - wrap;
        const x = Math.floor(px * tiles);
        const y = Math.floor(point.y * tiles);
        const demTile = this.findDEMTileFor(new OverscaledTileID(z, wrap, z, x, y));

        return !!(demTile && demTile.dem);
    }

    /**
     * Helper around `getAtPoint` that guarantees that a numeric value is returned.
     * @param {MercatorCoordinate} point Mercator coordinate of the point.
     * @param {number} defaultIfNotLoaded Value that is returned if the dem tile of the provided point is not loaded.
     * @returns {number} Altitude in meters.
     */
    getAtPointOrZero(point: MercatorCoordinate, defaultIfNotLoaded: number = 0): number {
        return this.getAtPoint(point, defaultIfNotLoaded) || 0;
    }

    /**
     * Altitude above sea level in meters at specified point.
     * @param {MercatorCoordinate} point Mercator coordinate of the point.
     * @param {number} defaultIfNotLoaded Value that is returned if the DEM tile of the provided point is not loaded.
     * @param {boolean} exaggerated `true` if styling exaggeration should be applied to the resulting elevation.
     * @returns {number} Altitude in meters.
     * If there is no loaded tile that carries information for the requested
     * point elevation, returns `defaultIfNotLoaded`.
     * Doesn't invoke network request to fetch the data.
     */
    getAtPoint(point: MercatorCoordinate, defaultIfNotLoaded: ?number, exaggerated: boolean = true): number | null {
        if (this.isUsingMockSource()) {
            return null;
        }

        // Force a cast to null for both null and undefined
        if (defaultIfNotLoaded == null) defaultIfNotLoaded = null;

        const src = this._source();
        if (!src) return defaultIfNotLoaded;
        if (point.y < 0.0 || point.y > 1.0) {
            return defaultIfNotLoaded;
        }
        const cache: SourceCache = src;
        const z = cache.getSource().maxzoom;
        const tiles = 1 << z;
        const wrap = Math.floor(point.x);
        const px = point.x - wrap;
        const tileID = new OverscaledTileID(z, wrap, z, Math.floor(px * tiles), Math.floor(point.y * tiles));
        const demTile = this.findDEMTileFor(tileID);
        if (!(demTile && demTile.dem)) { return defaultIfNotLoaded; }
        const dem: DEMData = demTile.dem;
        const tilesAtTileZoom = 1 << demTile.tileID.canonical.z;
        const x = (px * tilesAtTileZoom - demTile.tileID.canonical.x) * dem.dim;
        const y = (point.y * tilesAtTileZoom - demTile.tileID.canonical.y) * dem.dim;
        const i = Math.floor(x);
        const j = Math.floor(y);
        const exaggeration = exaggerated ? this.exaggeration() : 1;

        return exaggeration * interpolate(
            interpolate(dem.get(i, j), dem.get(i, j + 1), y - j),
            interpolate(dem.get(i + 1, j), dem.get(i + 1, j + 1), y - j),
            x - i);
    }

    /*
     * x and y are offset within tile, in 0 .. EXTENT coordinate space.
     */
    getAtTileOffset(tileID: OverscaledTileID, x: number, y: number): number {
        const tilesAtTileZoom = 1 << tileID.canonical.z;
        return this.getAtPointOrZero(new MercatorCoordinate(
            tileID.wrap + (tileID.canonical.x + x / EXTENT) / tilesAtTileZoom,
            (tileID.canonical.y + y / EXTENT) / tilesAtTileZoom));
    }

    getAtTileOffsetFunc(tileID: OverscaledTileID, lat: number, worldSize: number, projection: Projection): Function {
        return (p => {
            const elevation = this.getAtTileOffset(tileID, p.x, p.y);
            const upVector = projection.upVector(tileID.canonical, p.x, p.y);
            const upVectorScale = projection.upVectorScale(tileID.canonical, lat, worldSize).metersToTile;
            // $FlowFixMe can't yet resolve tuple vs array incompatibilities
            vec3.scale(upVector, upVector, elevation * upVectorScale);
            return upVector;
        });
    }

    /*
     * Batch fetch for multiple tile points: points holds input and return value:
     * vec3's items on index 0 and 1 define x and y offset within tile, in [0 .. EXTENT]
     * range, respectively. vec3 item at index 2 is output value, in meters.
     * If a DEM tile that covers tileID is loaded, true is returned, otherwise false.
     * Nearest filter sampling on dem data is done (no interpolation).
     */
    getForTilePoints(tileID: OverscaledTileID, points: Array<Vec3>, interpolated: ?boolean, useDemTile: ?Tile): boolean {
        if (this.isUsingMockSource()) {
            return false;
        }

        const helper = DEMSampler.create(this, tileID, useDemTile);
        if (!helper) { return false; }

        points.forEach(p => {
            p[2] = this.exaggeration() * helper.getElevationAt(p[0], p[1], interpolated);
        });
        return true;
    }

    /**
     * Get elevation minimum and maximum for tile identified by `tileID`.
     * @param {OverscaledTileID} tileID The `tileId` is a sub tile (or covers the same space) of the DEM tile we read the information from.
     * @returns {?{min: number, max: number}} The min and max elevation.
     */
    getMinMaxForTile(tileID: OverscaledTileID): ?{min: number, max: number} {
        if (this.isUsingMockSource()) {
            return null;
        }

        const demTile = this.findDEMTileFor(tileID);

        if (!(demTile && demTile.dem)) {
            return null;
        }

        const dem: DEMData = demTile.dem;
        const tree = dem.tree;
        const demTileID = demTile.tileID;
        const scale = 1 << tileID.canonical.z - demTileID.canonical.z;
        let xOffset = tileID.canonical.x / scale - demTileID.canonical.x;
        let yOffset = tileID.canonical.y / scale - demTileID.canonical.y;
        let index = 0; // Start from DEM tree root.
        for (let i = 0; i < tileID.canonical.z - demTileID.canonical.z; i++) {
            if (tree.leaves[index]) break;
            xOffset *= 2;
            yOffset *= 2;
            const childOffset = 2 * Math.floor(yOffset) + Math.floor(xOffset);
            index = tree.childOffsets[index] + childOffset;
            xOffset = xOffset % 1;
            yOffset = yOffset % 1;
        }
        return {min: this.exaggeration() * tree.minimums[index], max: this.exaggeration() * tree.maximums[index]};
    }

    /**
     * Get elevation minimum below MSL for the visible tiles. This function accounts
     * for terrain exaggeration and is conservative based on the maximum DEM error,
     * do not expect accurate values from this function.
     * If no negative elevation is visible, this function returns 0.
     * @returns {number} The min elevation below sea level of all visible tiles.
     */
    getMinElevationBelowMSL(): number {
        throw new Error('Pure virtual method called.');
    }

    /**
     * Performs raycast against visible DEM tiles on the screen and returns the distance travelled along the ray.
     * `x` & `y` components of the position are expected to be in normalized mercator coordinates [0, 1] and z in meters.
     * @param {vec3} position The ray origin.
     * @param {vec3} dir The ray direction.
     * @param {number} exaggeration The terrain exaggeration.
    */
    raycast(position: Vec3, dir: Vec3, exaggeration: number): ?number {
        throw new Error('Pure virtual method called.');
    }

    /**
     * Given a point on screen, returns 3D MercatorCoordinate on terrain.
     * Helper function that wraps `raycast`.
     *
     * @param {Point} screenPoint Screen point in pixels in top-left origin coordinate system.
     * @returns {vec3} If there is intersection with terrain, returns 3D MercatorCoordinate's of
     * intersection, as vec3(x, y, z), otherwise null.
     */ /* eslint no-unused-vars: ["error", { "args": "none" }] */
    pointCoordinate(screenPoint: Point): ?Vec3 {
        throw new Error('Pure virtual method called.');
    }

    /*
     * Implementation provides SourceCache of raster-dem source type cache, in
     * order to access already loaded cached tiles.
     */
    _source(): ?SourceCache {
        throw new Error('Pure virtual method called.');
    }

    /*
     * Whether the SourceCache instance is a mock source cache.
     * This mock source cache is used solely for the Globe projection and with terrain disabled,
     * where we only want to leverage the draping rendering pipeline without incurring DEM-tile
     * download overhead. This function is useful to skip DEM processing as the mock data source
     * placeholder contains only 0 height.
     */
    isUsingMockSource(): boolean {
        throw new Error('Pure virtual method called.');
    }

    /*
     * A multiplier defined by style as terrain exaggeration. Elevation provided
     * by getXXXX methods is multiplied by this.
     */
    exaggeration(): number {
        throw new Error('Pure virtual method called.');
    }

    /**
     * Lookup DEM tile that corresponds to (covers) tileID.
     * @private
     */
    findDEMTileFor(_: OverscaledTileID): ?Tile {
        throw new Error('Pure virtual method called.');
    }

    /**
     * Get list of DEM tiles used to render current frame.
     * @private
     */
    get visibleDemTiles(): Array<Tile> {
        throw new Error('Getter must be implemented in subclass.');
    }
}

/**
 * Helper class computes and caches data required to lookup elevation offsets at the tile level.
 */
export class DEMSampler {
    _demTile: Tile;
    _dem: DEMData;
    _scale: number;
    _offset: [number, number];

    constructor(demTile: Tile, scale: number, offset: [number, number]) {
        this._demTile = demTile;
        // demTile.dem will always exist because the factory method `create` does the check
        // Make flow happy with a cast through any
        this._dem = (((this._demTile.dem): any): DEMData);
        this._scale = scale;
        this._offset = offset;
    }

    static create(elevation: Elevation, tileID: OverscaledTileID, useDemTile: ?Tile): ?DEMSampler {
        const demTile = useDemTile || elevation.findDEMTileFor(tileID);
        if (!(demTile && demTile.dem)) { return; }
        const dem: DEMData = demTile.dem;
        const demTileID = demTile.tileID;
        const scale = 1 << tileID.canonical.z - demTileID.canonical.z;
        const xOffset = (tileID.canonical.x / scale - demTileID.canonical.x) * dem.dim;
        const yOffset = (tileID.canonical.y / scale - demTileID.canonical.y) * dem.dim;
        const k = demTile.tileSize / EXTENT / scale;

        return new DEMSampler(demTile, k, [xOffset, yOffset]);
    }

    tileCoordToPixel(x: number, y: number): Point {
        const px = x * this._scale + this._offset[0];
        const py = y * this._scale + this._offset[1];
        const i = Math.floor(px);
        const j = Math.floor(py);
        return new Point(i, j);
    }

    getElevationAt(x: number, y: number, interpolated: ?boolean, clampToEdge: ?boolean): number {
        const px = x * this._scale + this._offset[0];
        const py = y * this._scale + this._offset[1];
        const i = Math.floor(px);
        const j = Math.floor(py);
        const dem = this._dem;

        clampToEdge = !!clampToEdge;

        return interpolated ? interpolate(
            interpolate(dem.get(i, j, clampToEdge), dem.get(i, j + 1, clampToEdge), py - j),
            interpolate(dem.get(i + 1, j, clampToEdge), dem.get(i + 1, j + 1, clampToEdge), py - j),
            px - i) :
            dem.get(i, j, clampToEdge);
    }

    getElevationAtPixel(x: number, y: number, clampToEdge: ?boolean): number {
        return this._dem.get(x, y, !!clampToEdge);
    }

    getMeterToDEM(lat: number): number {
        return (1 << this._demTile.tileID.canonical.z) * mercatorZfromAltitude(1, lat) * this._dem.stride;
    }
}
