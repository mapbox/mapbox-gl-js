'use strict';

var tileGeoJSON = require('../util/tilegeojson.js');
var WorkerTile = require('./workertile.js');
var worker = require('./worker.js');
var Wrapper = require('./geojsonwrapper.js');

module.exports = parseGeoJSON;
function parseGeoJSON(params) {
    var data = params.data;

    var zooms = params.zooms;

    for (var i = 0; i < zooms.length; i++) {
        var zoom = zooms[i];
        var tiles = tileGeoJSON(data, zoom);

        for (var id in tiles) {
            var tile = tiles[id];
            new WorkerTile(undefined, new Wrapper(tile), id, zoom, params.tileSize, params.glyphs, params.source, sendFromWorker(id, params.source));
        }
    }
}

function sendFromWorker(id, source) {
    return function(err, params, buffers) {
        params.source = source;
        params.id = id;
        worker.send('add geojson tile', params, undefined, buffers);
    };
}
