'use strict';

var util = require('../util/util'),
    Source = require('./source'),
    Cache = require('../util/mru_cache');

module.exports = GeoJSONSource;

function GeoJSONSource(options) {
    options = options || {};

    this._isGeoJSON = true;
    this._data = options.data;

    if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;

    // TODO deduplicate with Source
    this._tiles = {};
    this._cache = new Cache(this.cacheSize, function(tile) {
        tile.remove();
    });
}

GeoJSONSource.prototype = util.inherit(Source, {
    minzoom: 0,
    maxzoom: 14,
    type: 'vector',
    _dirty: true,

    setData(data) {
        this._data = data;
        this._dirty = true;

        // remove all tiles in current source, these contain old data
        for (var tileId in this._tiles) {
            this._removeTile(tileId);
        }

        // empty cache, since _removeTile adds removed tiles to this._cache for later use
        this._cache.reset();

        this.fire('change');
        return this;
    },

    update() {
        if (this._dirty) this._updateData();
        if (this._loaded) this._updateTiles();
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
            this.fire('change');
        });
    }
});
