const LngLatBounds = require('../geo/lng_lat_bounds');
const clamp = require('../util/util').clamp;

class TileBounds {
  constructor(bounds, minzoom, maxzoom) {
    this.bounds = LngLatBounds.convert(bounds);
    this.minzoom = minzoom || 0;
    this.maxzoom = maxzoom || 24;
    this.cache = {};
    this.updateCache();
  }

  contains(coord) {
    const level = this.cache[coord.z];
    let hit = coord.x >= level[0][0] && coord.x < level[1][0] && coord.y >= level[0][1] && coord.y < level[1][1];
    return hit;
  }

  updateCache() {
    for (let i = this.minzoom; i <= this.maxzoom; i++) {
      this.cache[i] = [
        [Math.floor(this.lngX(this.bounds.getWest(), i)), Math.floor(this.latY(this.bounds.getNorth(), i))],
        [Math.ceil(this.lngX(this.bounds.getEast(), i)), Math.ceil(this.latY(this.bounds.getSouth(), i))]
      ]
    }
  }

  lngX(lng, zoom) {
    return (lng + 180) * (Math.pow(2, zoom) / 360);
  }

  latY(lat, zoom) {
    let f = clamp(Math.sin(Math.PI / 180 * lat), -0.9999, 0.9999);
    let scale = Math.pow(2, zoom) / (2 * Math.PI);
    return Math.pow(2, zoom-1) + 0.5 * Math.log((1 + f) / (1 - f)) * -scale;
    return y;
  }
}

module.exports = TileBounds;
