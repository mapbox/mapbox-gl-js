'use strict';

if (typeof window === 'undefined') {
    require('./worker/worker.js');
} else {
    // jshint -W079
    var mapboxgl = module.exports = window.mapboxgl = {};

    mapboxgl.Map = require('./ui/map.js');
    mapboxgl.Navigation = require('./ui/navigation.js');

    mapboxgl.Source = require('./ui/source.js');
    mapboxgl.GeoJSONSource = require('./ui/geojsonsource');

    mapboxgl.Style = require('./style/style.js');
    mapboxgl.StyleDeclaration = require('./style/styledeclaration.js');

    mapboxgl.LatLng = require('./geometry/latlng.js');
    mapboxgl.LatLngBounds = require('./geometry/latlngbounds.js');
    mapboxgl.Point = require('./geometry/point.js');

    mapboxgl.Tile = require('./ui/tile.js');

    mapboxgl.Evented = require('./util/evented.js');
    mapboxgl.util = require('./util/util.js');
}
