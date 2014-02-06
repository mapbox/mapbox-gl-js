'use strict';

if (typeof window === 'undefined') {
    require('./worker/worker.js');
} else {
    // jshint -W079
    var llmr = module.exports = window.llmr = {};

    llmr.Map = require('./ui/map.js');
    llmr.Layer = require('./ui/datasource.js');
    llmr.Style = require('./style/style.js');
    llmr.StyleDeclaration = require('./style/styledeclaration.js');
    llmr.Tile = require('./ui/tile.js');
    llmr.evented = require('./lib/evented.js');
    llmr.chroma = require('chroma-js');
    llmr.util = require('./util/util.js');
    llmr.assert = require('./util/assert.js');
    llmr.GeoJSONDatasource = require('./ui/geojsondatasource');
}
