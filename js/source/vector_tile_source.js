'use strict';

var util = require('../util/util');
var ajax = require('../util/ajax');
var browser = require('../util/browser');
var normalizeURL = require('../util/mapbox').normalizeSourceURL;
var Evented = require('../util/evented');
var TilePyramid = require('./tile_pyramid');
var TileCoord = require('./tile_coord');

module.exports = VectorTileSource;

function VectorTileSource(options) {
    util.extend(this, util.pick(options, 'url', 'tileSize'));

    if (this.tileSize !== 512) {
        throw new Error('vector tile sources must have a tileSize of 512');
    }

    var loaded = (err, tileJSON) => {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        util.extend(this, util.pick(tileJSON,
            'tiles', 'minzoom', 'maxzoom', 'attribution'));

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

        this.fire('load');
    };

    if (this.url) {
        ajax.getJSON(normalizeURL(this.url), loaded);
    } else {
        browser.frame(loaded.bind(this, null, options));
    }
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

    update() {
        if (this._pyramid) {
            this._pyramid.update(this.used, this.map.transform);
        }
    },

    render(layers, painter) {
        if (this._pyramid) {
            this._pyramid.renderedIDs().forEach((id) => {
                painter.drawTile(id, this._pyramid.getTile(id), layers);
            });
        }
    },

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
        }, callback, result.tile.workerID);
    }
});
