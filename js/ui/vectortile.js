'use strict';

var Tile = require('./tile.js'),
    BufferSet = require('../geometry/bufferset.js'),
    util = require('../util/util.js');

var createBucket = require('../geometry/createbucket.js');

module.exports = VectorTile;

function VectorTile(id, source, url, callback) {
    this.id = id;
    this.loaded = false;
    this.url = url;
    this.zoom = Tile.fromID(id).z;
    this.map = source.map;
    this.options = source.options;
    this.id = util.uniqueId();
    this.callback = callback;
    this.source = source;

    if (this.zoom >= source.tileJSON.maxzoom) {
        this.depth = this.map.options.maxZoom - this.zoom;
    } else {
        this.depth = 1;
    }
    this.uses = 1;
    this._load();
}

VectorTile.prototype = Object.create(Tile);

VectorTile.prototype._load = function() {
    var tile = this;
    this.workerID = this.map.dispatcher.send('load tile', {
        url: this.url,
        id: this.id,
        zoom: this.zoom,
        maxZoom: this.source.tileJSON.maxzoom,
        tileSize: this.options.tileSize,
        source: this.source.id,
        depth: this.depth
    }, function(err, data) {
        if (!err && data) {
            tile.onTileLoad(data);
        }
        tile.callback(err);
    });
};

VectorTile.prototype.featuresAt = function(pos, params, callback) {
    this.map.dispatcher.send('query features', {
        id: this.id,
        x: pos.x,
        y: pos.y,
        scale: pos.scale,
        source: this.source.id,
        params: params
    }, callback, this.workerID);
};

VectorTile.prototype.onTileLoad = function(data) {

    // Tile has been removed from the map
    if (!this.map) return;

    this.buffers = new BufferSet(data.buffers);

    this.buckets = {};
    for (var b in data.elementGroups) {
        this.buckets[b] = createBucket(this.map.style.buckets[b], this.buffers, undefined, data.elementGroups[b]);
    }

    this.loaded = true;
};

VectorTile.prototype.remove = function() {
    this.map.dispatcher.send('remove tile', { id: this.id, source: this.source.id }, null, this.workerID);
    this.map.painter.glyphAtlas.removeGlyphs(this.id);

    var gl = this.map.painter.gl;
    var buffers = this.buffers;
    if (buffers) {
        for (var b in buffers) {
            buffers[b].destroy(gl);
        }
    }
    delete this.map;
};

VectorTile.prototype.abort = function() {
    this.map.dispatcher.send('abort tile', { id: this.id, source: this.source.id }, null, this.workerID);
};
