'use strict';
// @Flow

const browser = require('./util/browser');

const version: string = require('../package.json').version;
const workerCount = Math.max(Math.floor(browser.hardwareConcurrency / 2), 1);

const Map = require('./ui/map');
const NavigationControl = require('./ui/control/navigation_control');
const GeolocateControl = require('./ui/control/geolocate_control');
const AttributionControl = require('./ui/control/attribution_control');
const ScaleControl = require('./ui/control/scale_control');
const FullscreenControl = require('./ui/control/fullscreen_control');
const Popup = require('./ui/popup');
const Marker = require('./ui/marker');

const Style = require('./style/style');

const LngLat = require('./geo/lng_lat');
const LngLatBounds = require('./geo/lng_lat_bounds');
const Point = require('point-geometry');

const Evented = require('./util/evented');
const supported = require('./util/browser').supported;

const config = require('./util/config');

const rtlTextPlugin = require('./source/rtl_text_plugin');

 /**
  * Sets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text).
  * Necessary for supporting languages like Arabic and Hebrew that are written right-to-left.
  *
  * @function setRTLTextPlugin
  * @param {string} pluginURL URL pointing to the Mapbox RTL text plugin source.
  * @param {Function} callback Called with an error argument if there is an error.
  * @example
  * mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.1.0/mapbox-gl-rtl-text.js');
  * @see [Add support for right-to-left scripts](https://www.mapbox.com/mapbox-gl-js/example/mapbox-gl-rtl-text/)
  */

const mapboxgl = {
    version,
    workerCount,
    Map,
    NavigationControl,
    GeolocateControl,
    AttributionControl,
    ScaleControl,
    FullscreenControl,
    Popup,
    Marker,
    Style,
    LngLat,
    LngLatBounds,
    Point,
    Evented,
    supported,
    config,
    setRTLTextPlugin: rtlTextPlugin.setRTLTextPlugin
};

Object.defineProperty(mapboxgl, 'accessToken', {
    get: function() { return config.ACCESS_TOKEN; },
    set: function(token) { config.ACCESS_TOKEN = token; }
});

module.exports = mapboxgl;

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
