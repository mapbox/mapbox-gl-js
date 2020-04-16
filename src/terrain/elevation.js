// @flow

import MercatorCoordinate from '../geo/mercator_coordinate';
import DEMData from '../data/dem_data';
import SourceCache from '../source/source_cache';
import {number as interpolate} from '../style-spec/util/interpolate';

import {OverscaledTileID} from '../source/tile_id';

/**
 * Provides access to elevation data from raster-dem source cache.
 */
export class Elevation {

    /**
     * Altitude above sea level in meters at specified point.
     * @param {MercatorCoordinate} point Mercator coordinate of the point.
     * @returns {number} Altitude in meters.
     * If there is no loaded tile that carries information for the requested
     * point elevation, returns 0.
     * Doesn't invoke network request to fetch the data.
     */
    getAtPoint(point: MercatorCoordinate): number {
        const cache = this._source();
        const z = cache.getSource().maxzoom + 1; // lookup uses findLoadedParent, start just a bit out of range.
        const tiles = 1 << z;
        const wrap = Math.floor(point.x);
        const px = point.x - wrap;
        const tileID = new OverscaledTileID(z, wrap, z, Math.floor(px * tiles), Math.floor(point.y * tiles));
        const demTile = cache.findLoadedParent(tileID, 0);
        if (!(demTile && demTile.dem)) { return 0; }
        const dem: DEMData = demTile.dem;
        const tilesAtTileZoom = 1 << demTile.tileID.canonical.z;
        const x = (px * tilesAtTileZoom - demTile.tileID.canonical.x) * demTile.tileSize;
        const y = (point.y * tilesAtTileZoom - demTile.tileID.canonical.y) * demTile.tileSize;
        const i = Math.floor(x);
        const j = Math.floor(y);

        return interpolate(
            interpolate(dem.get(i, j), dem.get(i, j + 1), y - j),
            interpolate(dem.get(i + 1, j), dem.get(i + 1, j + 1), y - j),
            x - i);
    }

    /**
     * Implementation provides SourceCache of raster-dem source type cache, in
     * order to access already loaded cached tiles.
     */
    _source(): SourceCache {
        throw new Error('Pure virtual method called.');
    }

}
