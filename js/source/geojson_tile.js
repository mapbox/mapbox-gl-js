'use strict';

var Tile = require('./tile');
var BufferSet = require('../data/buffer/buffer_set');
var createBucket = require('../data/create_bucket');

module.exports = GeoJSONTile;

function GeoJSONTile(id, source, data) {
    this.id = id;
    this.source = source;
    this.data = data;
    this.workerID = source.workerID;
}

GeoJSONTile.prototype = Object.create(Tile.prototype);

GeoJSONTile.prototype._load = function() {
    if (this.loaded) return;
    this.loaded = true;

    var data = this.data;
    this.buffers = new BufferSet(data.buffers);

    this.buckets = {};
    for (var b in data.elementGroups) {
        this.buckets[b] = createBucket(this.source.map.style.buckets[b], this.buffers, undefined, data.elementGroups[b]);
    }


};

// noops
GeoJSONTile.prototype.abort = function() { };
GeoJSONTile.prototype.remove = function() { };
