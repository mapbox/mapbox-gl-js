// @flow

const LngLatBounds = require('../geo/lng_lat_bounds');
const TileCoord = require('../source/tile_coord');

exports.tileCoordToBounds = function(tileCoord: TileCoord): LngLatBounds {
  const nwPoint = {x: tileCoord.x, y: tileCoord.y};
  const sePoint = {x: nwPoint.x + 1, y: nwPoint.y + 1};

  const northWest = unproject(nwPoint, tileCoord.z);
  const southEast = unproject(sePoint, tileCoord.z);

  // northWest, southEast --> northEast, southWest
  const neLngLat = {lng: southEast.lng, lat: northWest.lat};
  const swLngLat = {lng: northWest.lng, lat: southEast.lat};

  return new LngLatBounds(
    swLngLat,
    neLngLat
  );
}

/**
* Unprojects a Google XYZ tile coord to lng/lat coords.
*/
function unproject(point, zoom) {
  return {
    lng: xLng(point.x, zoom),
    lat: yLat(point.y, zoom)
  };
}

/**
* Transform tile-x coordinate (Google XYZ) to a longitude value.
* @param  {number} x  -
* @param  {number} zoom  -
* @return {number} -
*/
function xLng(x, zoom) {
  return x * 360 / Math.pow(2, zoom) - 180;
}

/**
* Transform tile-y coordinate (Google XYZ) to a latitude value.
* @param  {number} y  -
* @param  {number} zoom  -
* @return {number} -
*/
function yLat(y, zoom) {
  const y2 = 180 - y * 360 / Math.pow(2, zoom);
  return 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
}
