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

mapboxgl.GeoJSONSource = require('./source/geojson_source');
mapboxgl.VideoSource = require('./source/video_source');
mapboxgl.ImageSource = require('./source/image_source');

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
