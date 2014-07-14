'use strict';

if (typeof window === 'undefined') {
    new (require('./worker/worker.js'))(self);
} else {
    // jshint -W079
    var mapboxgl = module.exports = window.mapboxgl = {};

    mapboxgl.Map = require('./ui/map.js');
    mapboxgl.Navigation = require('./ui/navigation.js');

    mapboxgl.Source = require('./ui/source.js');
    mapboxgl.GeoJSONSource = require('./ui/geojsonsource');
    mapboxgl.VideoSource = require('./ui/videosource');

    mapboxgl.Style = require('./style/style.js');
    mapboxgl.StyleDeclaration = require('./style/styledeclaration.js');

    mapboxgl.LatLng = require('./geometry/latlng.js');
    mapboxgl.LatLngBounds = require('./geometry/latlngbounds.js');
    mapboxgl.Point = require('point-geometry');

    mapboxgl.Tile = require('./ui/tile.js');

    mapboxgl.Evented = require('./util/evented.js');
    mapboxgl.util = require('./util/util.js');

    var browser = require('./util/browser.js');
    mapboxgl.util.supported = browser.supported;

    var ajax = require('./util/ajax.js');
    mapboxgl.util.getJSON = ajax.getJSON;
    mapboxgl.util.getArrayBuffer = ajax.getArrayBuffer;
}
