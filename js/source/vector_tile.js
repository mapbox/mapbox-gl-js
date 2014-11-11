'use strict';

var Tile = require('./tile');
var TileCoord = require('./tile_coord');
var BufferSet = require('../data/buffer/buffer_set');
var util = require('../util/util');
var createBucket = require('../data/create_bucket');

module.exports = VectorTile;

function VectorTile(id, source, url, callback) {
    this.id = id;
    this.loaded = false;
    this.url = url;
    this.zoom = TileCoord.fromID(id).z;
    this.map = source.map;
    this.id = util.uniqueId();
    this.callback = callback;
    this.source = source;

    if (this.zoom >= source.maxzoom) {
        this.depth = this.map.options.maxZoom - this.zoom;
    } else {
        this.depth = 1;
    }
    this.uses = 1;

    this.workerID = this.map.dispatcher.send('load tile', {
        url: this.url,
        id: this.id,
        zoom: this.zoom,
        maxZoom: this.source.maxzoom,
        tileSize: this.source.tileSize,
        source: this.source.id,
        depth: this.depth
    }, this._loaded.bind(this));
}

VectorTile.prototype = util.inherit(Tile, {
    _loaded: function(err, data) {
        // Tile has been removed from the map
        if (!this.map) return;

        if (err) return this.callback(err);

        this.buffers = new BufferSet(data.buffers);
        this.buckets = {};
        for (var b in data.elementGroups) {
            this.buckets[b] = createBucket(this.map.style.buckets[b], this.buffers, undefined, data.elementGroups[b]);
        }

        this.loaded = true;
        this.callback(null, this);
    },

    remove: function() {

        // reuse prerendered textures
        for (var bucket in this.buckets) {
            if (this.buckets[bucket].prerendered) this.map.painter.saveTexture(this.buckets[bucket].prerendered.texture);
        }

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
    },

    abort: function() {
        this.map.dispatcher.send('abort tile', { id: this.id, source: this.source.id }, null, this.workerID);
    }
});
