// @flow

export type TileUrlOptions = {
    snapZoom: Map;
    snapPrecision: Map;
    simplifyPrecision: Map;
};

const LngLatBounds = require('../geo/lng_lat_bounds');
const TileCoord = require('../source/tile_coord');

exports.getTileUrlFromUrlTemplate = function(tileUrlTemplate: string, tileCoord: TileCoord, zoom: number, options: TileUrlOptions): string {
    const tilePolygonWKT = tilePolygonString(tileCoord);
    return tileUrlTemplate
        .replace(/{{'(.*)' column condition}}/g, function(entireMatch, columnId){
          return `intersects(${columnId}, '${tilePolygonWKT}')`;
        })
        .replace(/{snap_zoom}/g, getSnapZoom(options, zoom))
        .replace(/{snap_precision}/g, getSnapPrecision(options, zoom))
        .replace(/{simplify_precision}/g, getSnapPrecision(options, zoom));
}

function getSnapZoom(options: TileUrlOptions, zoom: number):number {
    const defaultSnapZoom = Math.max(zoom - 6, 1);
    const snapZoomOption = options.snapZoom || {};

    return snapZoomOption[zoom] || defaultSnapZoom;
}

function getSnapPrecision(options: TileUrlOptions, zoom: number):number {
    const defaultSnapPrecision = 0.0001 / (2 * zoom);
    const snapPrecisionOption = options.snapPrecision || {};

    return Math.max(snapPrecisionOption[zoom] || defaultSnapPrecision, 0.0000001);
}

function getSimplifyPrecision(options: TileUrlOptions, zoom: number):number {
    const defaultSimplifyPrecision = 0.0001 / (2 * zoom);
    const simplifyPrecisionOption = options.simplifyPrecision || {};

    return Math.max(simplifyPrecisionOption[zoom] || defaultSimplifyPrecision, 0.0000001);
}

function tileCoordToBounds(tileCoord: TileCoord): LngLatBounds {
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

function tilePolygonString(tileCoord: tileCoord): string {
  const tileLatLngBounds = tileCoordToBounds(tileCoord);
  return `POLYGON(( ` +
      `${tileLatLngBounds.getWest()} ${tileLatLngBounds.getSouth()} ,` +
      `${tileLatLngBounds.getWest()} ${tileLatLngBounds.getNorth()} ,` +
      `${tileLatLngBounds.getEast()} ${tileLatLngBounds.getNorth()} ,` +
      `${tileLatLngBounds.getEast()} ${tileLatLngBounds.getSouth()} ,` +
      `${tileLatLngBounds.getWest()} ${tileLatLngBounds.getSouth()} ))`;
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
