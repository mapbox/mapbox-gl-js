'use strict';

var Tile = require('./tile.js');
var Transform = require('./transform.js');
var Geometry = require('../geometry/geometry.js');
var util = require('../util/util.js');

module.exports = GeoJSONTile;

function GeoJSONTile(map, data, zoom) {
    this.map = map;
    this.data = data;

    this.geometry = new Geometry();

}

GeoJSONTile.prototype = Object.create(Tile.prototype);

GeoJSONTile.prototype._parse = function(data) {
    var mapping = this.map.style.stylesheet.mapping;
    this.layers = { everything: startBucket(this) };

    for (var i = 0; i < data.length; i++) {
        var line = data[i];
        this.geometry.addLine(line);
    }

    endBucket(this.layers.everything, this);

};

GeoJSONTile.prototype._load = function() {
    if (this.loaded) return;
    this._parse(this.data);
    this.loaded = true;
};

// noops
GeoJSONTile.prototype.abort = function() { };
GeoJSONTile.prototype.remove = function() { };

function startBucket(tile) {
    var geometry = tile.geometry;
    var bucket = {
        lineVertexIndex: geometry.lineVertex.index,

        fillBufferIndex: geometry.fillBufferIndex,
        fillVertexIndex: geometry.fillVertex.index,
        fillElementsIndex: geometry.fillElements.index,

        glyphVertexIndex: geometry.glyphVertex.index
    };
    return bucket;
}


function endBucket(bucket, tile) {
    var geometry = tile.geometry;

    bucket.lineVertexIndexEnd = geometry.lineVertex.index;

    bucket.fillBufferIndexEnd = geometry.fillBufferIndex;
    bucket.fillVertexIndexEnd = geometry.fillVertex.index;
    bucket.fillElementsIndexEnd = geometry.fillElements.index;

    bucket.glyphVertexIndexEnd = geometry.glyphVertex.index;

    return bucket;
}
