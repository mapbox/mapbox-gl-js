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

    this.updateAngle = util.throttle(this.updateAngle, 100, this);
}

VectorTileSource.prototype = util.inherit(Evented, {
    minzoom: 0,
    maxzoom: 22,
    tileSize: 512,
    reparseOverscaled: true,
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

    updateAngle: function() {
        var ids = this._pyramid.orderedIDs();
        for (var i = 0; i < ids.length; i++) {
            var tile = this._pyramid.getTile(ids[i]);
            this._redoTilePlacement(tile);
        }
    },

    render: Source._renderTiles,
    featuresAt: Source._vectorFeaturesAt,

    _loadTile: function(tile) {
        var overscaling = tile.zoom > this.maxzoom ? Math.pow(2, tile.zoom - this.maxzoom) : 1;
        var params = {
            url: TileCoord.url(tile.id, this.tiles, this.maxzoom),
            id: tile.uid,
            tileId: tile.id,
            zoom: tile.zoom,
            maxZoom: this.maxzoom,
            tileSize: this.tileSize * overscaling,
            source: this.id,
            overscaling: overscaling,
            angle: this.map.transform.angle
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
        this._redoTilePlacement(tile);
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
    },

    _redoTilePlacement: function(tile) {
        var source = this;

        this.dispatcher.send('redo placement', { id: tile.uid, source: this.id, angle: source.map.transform.angle }, done, tile.workerID);

        function done(_, data) {
            tile.reloadSymbolData(data, source.map.painter);
            source.fire('tile.load', {tile: tile});
        }
    }
});
