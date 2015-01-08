'use strict';

var util = require('../util/util');
var Evented = require('../util/evented');
var TilePyramid = require('./tile_pyramid');

module.exports = GeoJSONSource;

function GeoJSONSource(options) {
    options = options || {};

    this._data = options.data;

    if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;

    this._pyramid = new TilePyramid({
        tileSize: 512,
        minzoom: this.minzoom,
        maxzoom: this.maxzoom,
        cacheSize: 20,
        load: this._loadTile.bind(this),
        abort: this._abortTile.bind(this),
        unload: this._unloadTile.bind(this),
        add: this._addTile.bind(this),
        remove: this._removeTile.bind(this)
    });
}

GeoJSONSource.prototype = util.inherit(Evented, {
    minzoom: 0,
    maxzoom: 14,
    _dirty: true,

    setData(data) {
        this._data = data;
        this._dirty = true;
        this.fire('change');
        return this;
    },

    onAdd(map) {
        this.map = map;
    },

    loaded() {
        return this._loaded && this._pyramid.loaded();
    },

    update(transform) {
        if (this._dirty) {
            this._updateData();
        }

        if (this._loaded) {
            this._pyramid.update(this.used, transform);
        }
    },

    render(layers, painter) {
        if (this._loaded) {
            this._pyramid.renderedIDs().forEach((id) => {
                painter.drawTile(id, this._pyramid.getTile(id), layers);
            });
        }
    },

    _updateData() {
        this._dirty = false;
        this.workerID = this.dispatcher.send('parse geojson', {
            data: this._data,
            tileSize: 512,
            source: this.id,
            maxZoom: this.maxzoom
        }, (err) => {
            if (err) {
                this.fire('error', {error: err});
                return;
            }
            this._loaded = true;
            this._pyramid.clearTiles();
            this.fire('change');
        });
    },

    _loadTile(tile) {
        var params = {
            id: tile.uid,
            tileId: tile.id,
            zoom: tile.zoom,
            maxZoom: this.maxzoom,
            tileSize: this.tileSize,
            source: this.id,
            depth: tile.zoom >= this.maxzoom ? this.map.options.maxZoom - tile.zoom : 1
        };

        this.dispatcher.send('load geojson tile', params, (err, data) => {
            if (tile.aborted)
                return;

            if (err)
                return this.fire('tile.error', {tile: tile});

            tile.loadVectorData(data, this.style.buckets);
            this.fire('tile.load', {tile: tile});
        }, this.workerID);
    },

    _abortTile(tile) {
        tile.aborted = true;
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
        this.dispatcher.send('remove tile', { id: tile.uid, source: this.id }, null, this.workerID);
    },

    featuresAt(point, params, callback) {
        if (!this._pyramid)
            return callback(null, []);

        var result = this._pyramid.tileAt(point);
        if (!result)
            return callback(null, []);

        this.dispatcher.send('query features', {
            id: result.tile.uid,
            x: result.x,
            y: result.y,
            scale: result.scale,
            source: this.id,
            params: params
        }, callback, this.workerID);
    }
});
