function substituteSoqlParams(tileUrl, resourceType) {
  if (resourceType !== 'Tile') {
    return;
  }

  var tileParams = getTileParams(tileUrl);

  if (tileParams === null) {
    return;
  }

  var tilePolygonWKT = tilePolygonString(tileParams);
  var transformedUrl = tileUrl
    .replace(/{{'(.*)' column condition}}/g, function(entireMatch, columnId){
      return `intersects(${columnId}, '${tilePolygonWKT}')`;
    })
    .replace(/{snap_zoom}/g, getSnapZoom(tileParams))
    .replace(/{snap_precision}/g, getSnapPrecision(tileParams))
    .replace(/{simplify_precision}/g, getSnapPrecision(tileParams));

  return {
    url: transformedUrl
  }
}

function getTileParams(tileUrl) {
  var match = tileUrl.match(/#substituteSoqlParams_tileParams=(.*)\|(.*)\|(.*)/)
  if (match) {
    return {
      z: Number(match[1]),
      x: Number(match[2]),
      y: Number(match[3])
    }
  } else {
    return null;
  }
}

function getSnapZoom(tileParams) {
  var zoom = tileParams.z;
  var defaultSnapZoom = Math.max(zoom - 6, 1);
  var snapZoomOption = mapConstants.tileUrlOptions.snapZoom || {};

  return snapZoomOption[zoom] || defaultSnapZoom;
}

function getSnapPrecision(tileParams) {
  var zoom = tileParams.z;
  var defaultSnapPrecision = 0.0001 / (2 * zoom);
  var snapPrecisionOption = mapConstants.tileUrlOptions.snapPrecision || {};

  return Math.max(snapPrecisionOption[zoom] || defaultSnapPrecision, 0.0000001);
}

function getSimplifyPrecision(tileParams) {
  var zoom = tileParams.z;
  var defaultSimplifyPrecision = 0.0001 / (2 * zoom);
  var simplifyPrecisionOption = mapConstants.tileUrlOptions.simplifyPrecision || {};

  return Math.max(simplifyPrecisionOption[zoom] || defaultSimplifyPrecision, 0.0000001);
}

function tileParamsToBounds(tileParams) {
  var nwPoint = {x: tileParams.x, y: tileParams.y};
  var sePoint = {x: nwPoint.x + 1, y: nwPoint.y + 1};

  var northWest = unproject(nwPoint, tileParams.z);
  var southEast = unproject(sePoint, tileParams.z);

  // northWest, southEast --> northEast, southWest
  var neLngLat = {lng: southEast.lng, lat: northWest.lat};
  var swLngLat = {lng: northWest.lng, lat: southEast.lat};

  return new mapboxgl.LngLatBounds(
    swLngLat,
    neLngLat
  );
}

function tilePolygonString(tileParams) {
  var tileLatLngBounds = tileParamsToBounds(tileParams);
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
  var y2 = 180 - y * 360 / Math.pow(2, zoom);
  return 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
}
