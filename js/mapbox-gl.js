'use strict';

// jshint -W079
var mapboxgl = module.exports = {};

mapboxgl.version = require('../package.json').version;

mapboxgl.Map = require('./ui/map');
mapboxgl.Control = require('./ui/control/control');
mapboxgl.Navigation = require('./ui/control/navigation');
mapboxgl.Geolocate = require('./ui/control/geolocate');
mapboxgl.Attribution = require('./ui/control/attribution');
mapboxgl.Popup = require('./ui/popup');
mapboxgl.Marker = require('./ui/marker');

mapboxgl.Style = require('./style/style');

mapboxgl.LngLat = require('./geo/lng_lat');
mapboxgl.LngLatBounds = require('./geo/lng_lat_bounds');
mapboxgl.Point = require('point-geometry');

mapboxgl.Evented = require('./util/evented');
mapboxgl.util = require('./util/util');

mapboxgl.supported = require('./util/browser').supported;

var ajax = require('./util/ajax');
mapboxgl.util.getJSON = ajax.getJSON;
mapboxgl.util.getArrayBuffer = ajax.getArrayBuffer;

var config = require('./util/config');
mapboxgl.config = config;

Object.defineProperty(mapboxgl, 'accessToken', {
    get: function() { return config.ACCESS_TOKEN; },
    set: function(token) { config.ACCESS_TOKEN = token; }
});

/**
 * Gets and sets the map's [access token](https://www.mapbox.com/help/define-access-token/).
 *
 * @var {string} accessToken
 * @example
 * mapboxgl.accessToken = myAccessToken;
 */

/**
 * The version of Mapbox GL JS in use as specified in `package.json`,
 * `CHANGELOG.md`, and the GitHub release.
 *
 * @var {string} version
 */

/**
 * Returns a Boolean indicating whether the browser [supports Mapbox GL JS](https://www.mapbox.com/help/mapbox-browser-support/#mapbox-gl-js).
 *
 * @function supported
 * @param {Object} options
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] If `true`,
 *   the function will return `false` if the performance of Mapbox GL JS would
 *   be dramatically worse than expected (i.e. a software renderer would be used).
 * @return {boolean}
 * @example
 * mapboxgl.supported() // = true
 */
