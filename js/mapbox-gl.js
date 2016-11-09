'use strict';

const browser = require('./util/browser');

// jshint -W079
const mapboxgl = module.exports = {};

mapboxgl.version = require('../package.json').version;
mapboxgl.workerCount = Math.max(Math.floor(browser.hardwareConcurrency / 2), 1);

mapboxgl.Map = require('./ui/map');
mapboxgl.NavigationControl = require('./ui/control/navigation_control');
mapboxgl.GeolocateControl = require('./ui/control/geolocate_control');
mapboxgl.AttributionControl = require('./ui/control/attribution_control');
mapboxgl.ScaleControl = require('./ui/control/scale_control');
mapboxgl.Popup = require('./ui/popup');
mapboxgl.Marker = require('./ui/marker');

mapboxgl.Style = require('./style/style');

mapboxgl.LngLat = require('./geo/lng_lat');
mapboxgl.LngLatBounds = require('./geo/lng_lat_bounds');
mapboxgl.Point = require('point-geometry');

mapboxgl.Evented = require('./util/evented');
mapboxgl.util = require('./util/util');

mapboxgl.supported = require('./util/browser').supported;

const ajax = require('./util/ajax');
mapboxgl.util.getJSON = ajax.getJSON;
mapboxgl.util.getArrayBuffer = ajax.getArrayBuffer;

const config = require('./util/config');
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
 * @see [Display a map](https://www.mapbox.com/mapbox-gl-js/examples/)
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
 * @see [Check for browser support](https://www.mapbox.com/mapbox-gl-js/example/check-for-support/)
 */
