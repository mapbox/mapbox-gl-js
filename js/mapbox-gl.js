'use strict';

if (typeof window === 'undefined') {
    new (require('./source/worker'))(self); /*eslint no-new: 0*/
} else {
    // jshint -W079
    var mapboxgl = module.exports = window.mapboxgl = {};

    mapboxgl.Map = require('./ui/map');
    mapboxgl.Navigation = require('./ui/control/navigation');
    mapboxgl.Attribution = require('./ui/control/attribution');
    mapboxgl.Popup = require('./ui/popup');

    mapboxgl.Source = require('./source/source');
    mapboxgl.GeoJSONSource = require('./source/geojson_source');
    mapboxgl.VideoSource = require('./source/video_source');

    mapboxgl.Style = require('./style/style');

    mapboxgl.LatLng = require('./geo/lat_lng');
    mapboxgl.LatLngBounds = require('./geo/lat_lng_bounds');
    mapboxgl.Point = require('point-geometry');

    mapboxgl.Evented = require('./util/evented');
    mapboxgl.util = require('./util/util');

    var browser = require('./util/browser');
    mapboxgl.util.supported = browser.supported;

    var ajax = require('./util/ajax');
    mapboxgl.util.getJSON = ajax.getJSON;
    mapboxgl.util.getArrayBuffer = ajax.getArrayBuffer;

    var config = require('./util/config');
    mapboxgl.config = config;

    Object.defineProperty(mapboxgl, 'accessToken', {
        get: function() { return config.ACCESS_TOKEN; },
        set: function(token) { config.ACCESS_TOKEN = token; }
    });
}
