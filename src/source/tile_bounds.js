'use strict';

const LngLatBounds = require('../geo/lng_lat_bounds');
const clamp = require('../util/util').clamp;

class TileBounds {
    constructor(bounds, minzoom, maxzoom) {
        this.bounds = LngLatBounds.convert(bounds);
        this.minzoom = minzoom || 0;
        this.maxzoom = maxzoom || 24;
    }

    contains(coord) {
        const level = [
        [Math.floor(this.lngX(this.bounds.getWest(), coord.z)), Math.floor(this.latY(this.bounds.getNorth(), coord.z))],
        [Math.ceil(this.lngX(this.bounds.getEast(), coord.z)), Math.ceil(this.latY(this.bounds.getSouth(), coord.z))]
        ];
        const hit = coord.x >= level[0][0] && coord.x < level[1][0] && coord.y >= level[0][1] && coord.y < level[1][1];
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
