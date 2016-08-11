'use strict';

var Evented = require('../util/evented');
var util = require('../util/util');
var loadTileJSON = require('./load_tilejson');
var normalizeURL = require('../util/mapbox').normalizeTileURL;

module.exports = VectorTileSource;

function VectorTileSource(id, options, dispatcher) {
    this.id = id;
    this.dispatcher = dispatcher;
    util.extend(this, util.pick(options, ['url', 'scheme', 'tileSize']));
    this._options = util.extend({ type: 'vector' }, options);

    if (this.tileSize !== 512) {
        throw new Error('vector tile sources must have a tileSize of 512');
    }

    loadTileJSON(options, function (err, tileJSON) {
        if (err) {
            this.fire('error', err);
            return;
        }
        util.extend(this, tileJSON);
        this.fire('load');
    }.bind(this));
}

VectorTileSource.prototype = util.inherit(Evented, {
    minzoom: 0,
    maxzoom: 22,
    scheme: 'xyz',
    tileSize: 512,
    reparseOverscaled: true,
    isTileClipped: true,

    onAdd: function(map) {
        this.map = map;
    },

    serialize: function() {
        return util.extend({}, this._options);
    },

    loadTile: function(tile, callback) {
        var overscaling = tile.coord.z > this.maxzoom ? Math.pow(2, tile.coord.z - this.maxzoom) : 1;
        var params = {
            url: normalizeURL(tile.coord.url(this.tiles, this.maxzoom, this.scheme), this.url),
            uid: tile.uid,
            coord: tile.coord,
            zoom: tile.coord.z,
            tileSize: this.tileSize * overscaling,
            source: this.id,
            overscaling: overscaling,
            angle: this.map.transform.angle,
            pitch: this.map.transform.pitch,
            showCollisionBoxes: this.map.showCollisionBoxes
        };

        if (tile.workerID) {
            if (tile.state === 'loading') {
                // schedule tile reloading after it has been loaded
                tile.reloadCallback = callback;
            } else {
                params.rawTileData = tile.rawTileData;
                this.dispatcher.send('reload tile', params, done.bind(this), tile.workerID);
            }
        } else {
            tile.workerID = this.dispatcher.send('load tile', params, done.bind(this));
        }

        function done(err, data) {
            if (tile.aborted)
                return;

            if (err) {
                return callback(err);
            }

            tile.loadVectorData(data, this.map.style);

            if (tile.redoWhenDone) {
                tile.redoWhenDone = false;
                tile.redoPlacement(this);
            }

            callback(null);

            if (tile.reloadCallback) {
                this.loadTile(tile, tile.reloadCallback);
                tile.reloadCallback = null;
            }
        }
    },

    abortTile: function(tile) {
        this.dispatcher.send('abort tile', { uid: tile.uid, source: this.id }, null, tile.workerID);
    },

    unloadTile: function(tile) {
        tile.unloadVectorData(this.map.painter);
        this.dispatcher.send('remove tile', { uid: tile.uid, source: this.id }, null, tile.workerID);
    }
});
