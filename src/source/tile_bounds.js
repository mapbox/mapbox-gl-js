// @flow

const LngLatBounds = require('../geo/lng_lat_bounds');
const clamp = require('../util/util').clamp;

import type TileCoord from './tile_coord';

class TileBounds {
    bounds: LngLatBounds;
    minzoom: number;
    maxzoom: number;

    constructor(bounds: [number, number, number, number], minzoom: ?number, maxzoom: ?number) {
        this.bounds = LngLatBounds.convert(this.validateBounds(bounds));
        this.minzoom = minzoom || 0;
        this.maxzoom = maxzoom || 24;
    }

    validateBounds(bounds: [number, number, number, number]) {
        // make sure the bounds property contains valid longitude and latitudes
        if (!Array.isArray(bounds) || bounds.length !== 4) return [-180, -90, 180, 90];
        return [Math.max(-180, bounds[0]), Math.max(-90, bounds[1]), Math.min(180, bounds[2]), Math.min(90, bounds[3])];
    }

    contains(coord: TileCoord, maxzoom: number) {
        // TileCoord returns incorrect z for overscaled tiles, so we use this
        // to make sure overzoomed tiles still get displayed.
        const tileZ = maxzoom ? Math.min(coord.z, maxzoom) : coord.z;

        const level = {
            minX: Math.floor(this.lngX(this.bounds.getWest(), tileZ)),
            minY: Math.floor(this.latY(this.bounds.getNorth(), tileZ)),
            maxX: Math.ceil(this.lngX(this.bounds.getEast(), tileZ)),
            maxY: Math.ceil(this.latY(this.bounds.getSouth(), tileZ))
        };
        const hit = coord.x >= level.minX && coord.x < level.maxX && coord.y >= level.minY && coord.y < level.maxY;
        return hit;
    }

    lngX(lng: number, zoom: number) {
        return (lng + 180) * (Math.pow(2, zoom) / 360);
    }

    latY(lat: number, zoom: number) {
        const f = clamp(Math.sin(Math.PI / 180 * lat), -0.9999, 0.9999);
        const scale = Math.pow(2, zoom) / (2 * Math.PI);
        return Math.pow(2, zoom - 1) + 0.5 * Math.log((1 + f) / (1 - f)) * -scale;
    }
}

module.exports = TileBounds;
