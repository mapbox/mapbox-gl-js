'use strict';

var util = require('../util/util');
var Evented = require('../util/evented');
var TileCoord = require('./tile_coord');
var Source = require('./source');

module.exports = VectorTileSource;

function VectorTileSource(options) {
    util.extend(this, util.pick(options, 'url', 'tileSize'));

    if (this.tileSize !== 512) {
        throw new Error('vector tile sources must have a tileSize of 512');
    }

    Source._loadTileJSON.call(this, options);
}

VectorTileSource.prototype = util.inherit(Evented, {
    minzoom: 0,
    maxzoom: 22,
    tileSize: 512,
    _loaded: false,

    onAdd: function(map) {
        this.map = map;
    },

    loaded: function() {
        return this._pyramid && this._pyramid.loaded();
    },

    update: function(transform) {
        if (this._pyramid) {
            this._pyramid.update(this.used, transform);
        }
    },

    reload: function() {
        this._pyramid.reload();
    },

    render: Source._renderTiles,
    featuresAt: Source._vectorFeaturesAt,

    _loadTile: function(tile) {
        var params = {
            url: TileCoord.url(tile.id, this.tiles),
            id: tile.uid,
            tileId: tile.id,
            zoom: tile.zoom,
            maxZoom: this.maxzoom,
            tileSize: this.tileSize,
            source: this.id,
            depth: tile.zoom >= this.maxzoom ? this.map.options.maxZoom - tile.zoom : 1
        };

        if (tile.workerID) {
            this.dispatcher.send('reload tile', params, this._tileLoaded.bind(this, tile), tile.workerID);
        } else {
            tile.workerID = this.dispatcher.send('load tile', params, this._tileLoaded.bind(this, tile));
        }
    },

    _tileLoaded: function(tile, err, data) {
        if (tile.aborted)
            return;

        if (err) {
            this.fire('tile.error', {tile: tile});
            return;
        }

        tile.loadVectorData(data);
        this.fire('tile.load', {tile: tile});
    },

    _abortTile: function(tile) {
        tile.aborted = true;
        this.dispatcher.send('abort tile', { id: tile.uid, source: this.id }, null, tile.workerID);
    },

    _addTile: function(tile) {
        this.fire('tile.add', {tile: tile});
    },

    _removeTile: function(tile) {
        this.fire('tile.remove', {tile: tile});
    },

    _unloadTile: function(tile) {
        tile.unloadVectorData(this.map.painter);
        this.glyphAtlas.removeGlyphs(tile.uid);
        this.dispatcher.send('remove tile', { id: tile.uid, source: this.id }, null, tile.workerID);
    }
});
