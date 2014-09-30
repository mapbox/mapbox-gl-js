'use strict';

var util = require('../util/util');
var ajax = require('../util/ajax');
var Source = require('./source');
var GeoJSONTile = require('./geojson_tile');

module.exports = GeoJSONSource;

function GeoJSONSource(options) {
    this._tiles = {};
    this._alltiles = {};
    this.enabled = true;
    this.zooms = [1, 5, 9, 13];
    this.minTileZoom = this.zooms[0];
    this.maxTileZoom = this.zooms[this.zooms.length - 1];

    if (options.url) {
        ajax.getJSON(options.url, function(err, data) {
            this.setData(data);
        }.bind(this));
    } else {
        this.data = options.data;
    }
}

GeoJSONSource.prototype = util.inherit(Source, {
    minzoom: 1,
    maxzoom: 13,

    setData: function(data) {
        this.data = data;
        if (this.map) this._updateData();
        return this;
    },

    onAdd: function(map) {
        this.map = map;
        this.painter = map.painter;

        if (this.map.style) this._updateData();
        map.on('style.change', this._updateData.bind(this));
    },

    _updateData: function() {
        if (!this.data) return;

        var source = this;
        this.workerID = this.map.dispatcher.send('parse geojson', {
            data: this.data,
            zooms: this.zooms,
            tileSize: 512,
            source: this.id
        }, function(err, tiles) {
            if (err) return;
            for (var i = 0; i < tiles.length; i++) {
                source._alltiles[tiles[i].id] = new GeoJSONTile(tiles[i].id, source, tiles[i]);
            }
            if (source.map) source.map.update();
        }.bind(this));
        return this;
    },

    _addTile: function(id) {
        var tile = this._alltiles[id];
        if (tile) {
            tile._load();
            this._tiles[id] = tile;
            this.fire('tile.add', {tile: tile});
        }
        return tile || {};
    },

    _coveringZoomLevel: function() {
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
