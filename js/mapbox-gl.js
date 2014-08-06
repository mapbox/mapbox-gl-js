'use strict';

if (typeof window === 'undefined') {
    new (require('./source/worker.js'))(self);
} else {
    // jshint -W079
    var mapboxgl = module.exports = window.mapboxgl = {};

    mapboxgl.Map = require('./ui/map.js');
    mapboxgl.Navigation = require('./ui/navigation.js');

    mapboxgl.Source = require('./source/source');
    mapboxgl.GeoJSONSource = require('./source/geojsonsource');
    mapboxgl.VideoSource = require('./source/videosource');

    mapboxgl.Style = require('./style/style.js');
    mapboxgl.StyleDeclaration = require('./style/styledeclaration.js');

    mapboxgl.LatLng = require('./geo/latlng.js');
    mapboxgl.LatLngBounds = require('./geo/latlngbounds.js');
    mapboxgl.Point = require('point-geometry');

    mapboxgl.Tile = require('./source/tile.js');

    mapboxgl.Evented = require('./util/evented.js');
    mapboxgl.util = require('./util/util.js');

    var browser = require('./util/browser.js');
    mapboxgl.util.supported = browser.supported;

    var ajax = require('./util/ajax.js');
    mapboxgl.util.getJSON = ajax.getJSON;
    mapboxgl.util.getArrayBuffer = ajax.getArrayBuffer;

    var config = require('./util/config.js');
    mapboxgl.config = config;

    Object.defineProperty(mapboxgl, 'accessToken', {
        get: function() { return config.ACCESS_TOKEN; },
        set: function(token) { config.ACCESS_TOKEN = token; }
    });
}
