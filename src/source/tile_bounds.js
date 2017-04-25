'use strict';

const LngLatBounds = require('../geo/lng_lat_bounds');
const clamp = require('../util/util').clamp;

class TileBounds {
    constructor(bounds, minzoom, maxzoom) {
        this.bounds = this.validateBounds(bounds) ? LngLatBounds.convert(bounds) : LngLatBounds.convert([-180, -90, 180, 90]);
        this.minzoom = minzoom || 0;
        this.maxzoom = maxzoom || 24;
    }

    validateBounds(bounds) {
        if (!Array.isArray(bounds) || bounds.length !== 4) return false;
        if (bounds[0] < -180 || bounds[1] < -90 || bounds[2] > 180 || bounds[3] > 90) return false;
        return true;
    }

    contains(coord, maxzoom) {
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

    lngX(lng, zoom) {
        return (lng + 180) * (Math.pow(2, zoom) / 360);
    }

    latY(lat, zoom) {
        const f = clamp(Math.sin(Math.PI / 180 * lat), -0.9999, 0.9999);
        const scale = Math.pow(2, zoom) / (2 * Math.PI);
        return Math.pow(2, zoom - 1) + 0.5 * Math.log((1 + f) / (1 - f)) * -scale;
    }
}

module.exports = TileBounds;
