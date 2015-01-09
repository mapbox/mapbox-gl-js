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

    onAdd(map) {
        this.map = map;
    },

    loaded() {
        return this._pyramid && this._pyramid.loaded();
    },

    update(transform) {
        if (this._pyramid) {
            this._pyramid.update(this.used, transform);
        }
    },

    render: Source._renderTiles,
    featuresAt: Source._vectorFeaturesAt,

    _loadTile(tile) {
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

        tile.workerID = this.dispatcher.send('load tile', params, (err, data) => {
            if (tile.aborted)
                return;

            if (err)
                return this.fire('tile.error', {tile: tile});

            tile.loadVectorData(data, this.style.buckets);
            this.fire('tile.load', {tile: tile});
        });
    },

    _abortTile(tile) {
        tile.aborted = true;
        this.dispatcher.send('abort tile', { id: tile.uid, source: this.id }, null, tile.workerID);
    },

    _addTile(tile) {
        this.fire('tile.add', {tile: tile});
    },

    _removeTile(tile) {
        this.fire('tile.remove', {tile: tile});
    },

    _unloadTile(tile) {
        tile.unloadVectorData(this.map.painter);
        this.glyphAtlas.removeGlyphs(tile.uid);
        this.dispatcher.send('remove tile', { id: tile.uid, source: this.id }, null, tile.workerID);
    }
});
