'use strict';

var util = require('../util/util');
var Source = require('./source');
var GeoJSONTile = require('./geojson_tile');

module.exports = GeoJSONSource;

function GeoJSONSource(options) {
    this._tiles = {};
    this._alltiles = {};
    this.zooms = [1, 5, 9, 13];
    this.minTileZoom = this.zooms[0];
    this.maxTileZoom = this.zooms[this.zooms.length - 1];
    this.data = options.data;
}

GeoJSONSource.prototype = util.inherit(Source, {
    minzoom: 1,
    maxzoom: 13,
    _dirty: true,

    setData(data) {
        this.data = data;
        this._dirty = true;
        this.fire('change');
        return this;
    },

    update() {
        if (this._dirty) this._updateData();
        if (this._loaded) this._updateTiles();
    },

    _updateData() {
        this._dirty = false;
        this.workerID = this.map.dispatcher.send('parse geojson', {
            data: this.data,
            zooms: this.zooms,
            tileSize: 512,
            source: this.id
        }, (err, tiles) => {
            if (err) return;
            this._loaded = true;
            for (var i = 0; i < tiles.length; i++) {
                this._alltiles[tiles[i].id] = new GeoJSONTile(tiles[i].id, this, tiles[i]);
            }
            this.fire('change');
        });
        return this;
    },

    _addTile(id) {
        var tile = this._alltiles[id];
        if (tile) {
            tile._load();
            this._tiles[id] = tile;
            this.fire('tile.add', {tile: tile});
        }
        return tile || {};
    },

    _coveringZoomLevel() {
        var zoom = this._getZoom();
        for (var i = this.zooms.length - 1; i >= 0; i--) {
            if (this.zooms[i] <= zoom) {
                var z = this.zooms[i];
                return z;
            }
        }
        return 0;
    }
});
