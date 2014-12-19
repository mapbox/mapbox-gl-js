'use strict';

var Tile = require('./tile');
var TileCoord = require('./tile_coord');
var BufferSet = require('../data/buffer/buffer_set');
var util = require('../util/util');
var createBucket = require('../data/create_bucket');

module.exports = VectorTile;

function VectorTile(tileId, source, url, callback) {
    this.id = util.uniqueId();
    this.loaded = false;
    this.zoom = TileCoord.fromID(tileId).z;
    this.map = source.map;
    this.callback = callback;
    this.source = source;
    this.uses = 1;

    this.params = {
        url: url,
        id: this.id,
        tileId: tileId,
        zoom: this.zoom,
        maxZoom: this.source.maxzoom,
        tileSize: this.source.tileSize,
        source: this.source.id,
        depth: this.zoom >= source.maxzoom ? this.map.options.maxZoom - this.zoom : 1
    };

    this._loadTile();
}

VectorTile.prototype = util.inherit(Tile, {
    _loadTile() {
        if (this.source._isGeoJSON) {
            this.workerID = this.source.workerID;
            this.source.dispatcher.send('load geojson tile', this.params, this._loaded.bind(this), this.workerID);

        } else {
            this.workerID = this.source.dispatcher.send('load tile', this.params, this._loaded.bind(this));
        }
    },

    _loaded(err, data) {
        // Tile has been removed from the map
        if (!this.map) return;

        if (err) return this.callback(err);

        this.loaded = true;
        this.buckets = {};

        // empty GeoJSON tile
        if (!data) return this.callback(null, this);

        this.buffers = new BufferSet(data.buffers);
        for (var b in data.elementGroups) {
            this.buckets[b] = createBucket(this.source.style.buckets[b], this.buffers, undefined, data.elementGroups[b]);
        }

        this.callback(null, this);
    },

    remove() {
        // reuse prerendered textures
        for (var bucket in this.buckets) {
            if (this.buckets[bucket].prerendered) this.map.painter.saveTexture(this.buckets[bucket].prerendered.texture);
        }

        this.source.dispatcher.send('remove tile', { id: this.id, source: this.source.id }, null, this.workerID);
        this.source.glyphAtlas.removeGlyphs(this.id);

        var gl = this.map.painter.gl;
        var buffers = this.buffers;
        if (buffers) {
            for (var b in buffers) {
                buffers[b].destroy(gl);
            }
        }
        delete this.map;
    },

    abort() {
        this.source.dispatcher.send('abort tile', { id: this.id, source: this.source.id }, null, this.workerID);
    }
});
