'use strict';

if (typeof window === 'undefined') {
    require('./worker/worker.js');
} else {
    // jshint -W079
    var llmr = module.exports = window.llmr = {};

    llmr.Map = require('./ui/map.js');

    llmr.Source = require('./ui/source.js');
    llmr.GeoJSONSource = require('./ui/geojsonsource');

    llmr.Style = require('./style/style.js');
    llmr.StyleDeclaration = require('./style/styledeclaration.js');

    llmr.LatLng = require('./geometry/latlng.js');
    llmr.Point = require('./geometry/point.js');

    llmr.Tile = require('./ui/tile.js');

    llmr.Evented = require('./lib/evented.js');
    llmr.util = require('./util/util.js');
}
