// @flow

import MercatorCoordinate from '../geo/mercator_coordinate';
import DEMData from '../data/dem_data';
import SourceCache from '../source/source_cache';
import {number as interpolate} from '../style-spec/util/interpolate';
import EXTENT from '../data/extent';
import {vec3} from 'gl-matrix';

import {OverscaledTileID} from '../source/tile_id';

import type Tile from '../source/tile';

/**
 * Provides access to elevation data from raster-dem source cache.
 */
export class Elevation {

    /**
     * Altitude above sea level in meters at specified point.
     * @param {MercatorCoordinate} point Mercator coordinate of the point.
     * @param {number} defaultIfNotLoaded Value that is returned if the dem tile of the provided point is not loaded
     * @returns {number} Altitude in meters.
     * If there is no loaded tile that carries information for the requested
     * point elevation, returns `defaultIfNotLoaded`.
     * Doesn't invoke network request to fetch the data.
     */
    getAtPoint(point: MercatorCoordinate, defaultIfNotLoaded: number = 0): number {
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

        return this.exaggeration() * interpolate(
            interpolate(dem.get(i, j), dem.get(i, j + 1), y - j),
            interpolate(dem.get(i + 1, j), dem.get(i + 1, j + 1), y - j),
            x - i);
    }

    /*
     * x and y are offset within tile, in 0 .. EXTENT coordinate space.
     */
    getAtTileOffset(tileID: OverscaledTileID, x: number, y: number): number {
        const tilesAtTileZoom = 1 << tileID.canonical.z;
        return this.getAtPoint(new MercatorCoordinate(
            tileID.wrap + (tileID.canonical.x + x / EXTENT) / tilesAtTileZoom,
            (tileID.canonical.y + y / EXTENT) / tilesAtTileZoom));
    }

    /*
     * Batch fetch for multiple tile points: points holds input and return value:
     * vec3's items on index 0 and 1 define x and y offset within tile, in [0 .. EXTENT]
     * range, respectively. vec3 item at index 2 is output value, in meters.
     * If a DEM tile that covers tileID is loaded, true is returned, otherwise false.
     * Nearest filter sampling on dem data is done (no interpolation).
     */
    getForTilePoints(tileID: OverscaledTileID, points: Array<vec3>, interpolated: ?boolean, useDemTile: ?Tile): boolean {
        const helper = DEMSampler.create(this, tileID, useDemTile);
        if (!helper) { return false; }

        points.forEach(p => {
            p[2] = this.exaggeration() * helper.getElevationAt(p[0], p[1], interpolated);
        });
        return true;
    }

    /**
     * Get elevation minimum and maximum for tile identified by `tileID`.
     * @param {*} tileID is a sub tile (or covers the same space) of the DEM tile we read the information from.
     */
    getMinMaxForTile(tileID: OverscaledTileID): ?{min: number, max: number} {
        const demTile = this.findDEMTileFor(tileID);
        if (!(demTile && demTile.dem)) { return null; }
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
     * Performs raycast against visible DEM tiles on the screen and returns the distance travelled along the ray.
     * x & y components of the position are expected to be in normalized mercator coordinates [0, 1] and z in meters.
    */
    raycast(position: vec3, dir: vec3, exaggeration: number): ?number {
        throw new Error('Pure virtual method called.');
    }

    /**
     * Given a point on screen, returns 3D MercatorCoordinate on terrain.
     * Reconstructs a picked world position by casting a ray from screen coordinates
     * and sampling depth from the custom depth buffer. This function (currently) introduces
     * a potential stall (few frames) due to it reading pixel information from the gpu.
     * Depth buffer will also be generated if it doesn't already exist.
     * @param {Point} screenPoint Screen point in pixels in top-left origin coordinate system.
     * @returns {vec3} If there is intersection with terrain, returns 3D MercatorCoordinate's of
     * intersection, as vec3(x, y, z), otherwise null.
     */ /* eslint no-unused-vars: ["error", { "args": "none" }] */
    pointCoordinate(screenPoint: Point): ?vec3 {
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
    _dem: DEMData;
    _scale: number;
    _offset: [number, number];

    constructor(dem: DEMData, scale: number, offset: [number, number]) {
        this._dem = dem;
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

        return new DEMSampler(dem, k, [xOffset, yOffset]);
    }

    getElevationAt(x: number, y: number, interpolated: ?boolean): number {
        const px = x * this._scale + this._offset[0];
        const py = y * this._scale + this._offset[1];
        const i = Math.floor(px);
        const j = Math.floor(py);
        const dem = this._dem;

        return interpolated ? interpolate(
            interpolate(dem.get(i, j), dem.get(i, j + 1), py - j),
            interpolate(dem.get(i + 1, j), dem.get(i + 1, j + 1), py - j),
            px - i) :
            dem.get(i, j);
    }
}
