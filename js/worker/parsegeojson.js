'use strict';

var tileGeoJSON = require('../util/tilegeojson.js');
var WorkerTile = require('./workertile.js');
var worker = require('./worker.js');

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


// conform to vectortile api
function Wrapper(features) {
    this.features = features;
    this.length = features.length;
}

Wrapper.prototype.feature = function(i) {
    return new FeatureWrapper(this.features[i]);
};

var mapping = {
    'Point': 1,
    'LineString': 2,
    'Polygon': 3
};

function FeatureWrapper(feature) {
    this.feature = feature;
    this._type = mapping[feature.type];
    this.properties = feature.properties;
}

FeatureWrapper.prototype.loadGeometry = function() {
    return this.feature.coords;
};

FeatureWrapper.prototype.bbox = function() {
    var rings = this.feature.coords;

    var x1 = Infinity,
        x2 = -Infinity,
        y1 = Infinity,
        y2 = -Infinity;

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];

        for (var j = 0; j < ring.length; j++) {
            var coord = ring[j];

            x1 = Math.min(x1, coord.x);
            x2 = Math.max(x2, coord.x);
            y1 = Math.min(y1, coord.y);
            y2 = Math.max(y2, coord.y);
        }
    }

    return [x1, y1, x2, y2];
};
