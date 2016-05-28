'use strict';

var util = require('../util/util');
var urlResolve = require('resolve-url');
var EXTENT = require('../data/bucket').EXTENT;

var webworkify = require('webworkify');

module.exports.create = function (id, options, dispatcher, onChange, callback) {
    var source = new GeoJSONSource(id, options, dispatcher, onChange);

    //TODO: is it to aggressive to do this on source creation, as opposed to
    //lazily at the first tile request?
    source._updateData(function done(err) {
        if (err) {
            return callback(err);
        }
        callback(null, source);
    });
};

module.exports.workerSourceURL = URL.createObjectURL(
    webworkify(require('./geojson_worker_source'), {bare: true})
);

/**
 * Create a GeoJSON data source instance given an options object
 * @class GeoJSONSource
 * @param {Object} [options]
 * @param {Object|string} options.data A GeoJSON data object or URL to it. The latter is preferable in case of large GeoJSON files.
 * @param {number} [options.maxzoom=18] Maximum zoom to preserve detail at.
 * @param {number} [options.buffer] Tile buffer on each side in pixels.
 * @param {number} [options.tolerance] Simplification tolerance (higher means simpler) in pixels.
 * @param {number} [options.cluster] If the data is a collection of point features, setting this to true clusters the points by radius into groups.
 * @param {number} [options.clusterRadius=50] Radius of each cluster when clustering points, in pixels.
 * @param {number} [options.clusterMaxZoom] Max zoom to cluster points on. Defaults to one zoom less than `maxzoom` (so that last zoom features are not clustered).

 * @example
 * var sourceObj = new mapboxgl.GeoJSONSource({
 *    data: {
 *        "type": "FeatureCollection",
 *        "features": [{
 *            "type": "Feature",
 *            "geometry": {
 *                "type": "Point",
 *                "coordinates": [
 *                    -76.53063297271729,
 *                    39.18174077994108
 *                ]
 *            }
 *        }]
 *    }
 * });
 * map.addSource('some id', sourceObj); // add
 * map.removeSource('some id');  // remove
 */
function GeoJSONSource(id, options, dispatcher, onChange) {
    this.id = id;
    this.dispatcher = dispatcher;
    this._onChange = onChange;

    options = options || {};

    this._data = options.data;

    if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;

    this.type = options.type;

}

GeoJSONSource.prototype = /** @lends GeoJSONSource.prototype */{
    minzoom: 0,
    maxzoom: 18,
    tileSize: 512,
    isTileClipped: true,
    _dirty: true,

    onAdd: function (map) {
        this.map = map;
    },

    /**
     * Update source geojson data and rerender map
     *
     * @param {Object|string} data A GeoJSON data object or URL to it. The latter is preferable in case of large GeoJSON files.
     * @returns {GeoJSONSource} this
     */
    setData: function(data) {
        this._data = data;
        this._dirty = true;

        this._onChange();

        return this;
    },

    _updateData: function(cb) {
        this._dirty = false;
        var options = util.extend({
            source: this.id,
            extent: EXTENT,
            scale: EXTENT / this.tileSize,
            minZoom: this.minzoom,
            maxZoom: this.maxzoom
        }, this.options);

        var data = this._data;
        if (typeof data === 'string') {
            options.url = typeof window != 'undefined' ? urlResolve(window.location.href, data) : data;
        } else {
            options.data = JSON.stringify(data);
        }
        this.workerID = this.dispatcher.send(this.type + '.parse', options, function(err) {
            // TODO: not quite sure if we need this anymore
            this._loaded = true;
            cb(err);

        }.bind(this));
    },

    load: function (tile, callback) {
        if (!this._dirty) {
            return this._load(tile, callback);
        }

        this._updateData(function (err) {
            if (err) {
                return callback(err);
            }
            this._load(tile, callback);
        }.bind(this));
    },

    _load: function(tile, callback) {
        var overscaling = tile.coord.z > this.maxzoom ? Math.pow(2, tile.coord.z - this.maxzoom) : 1;
        var params = {
            type: this.type,
            uid: tile.uid,
            coord: tile.coord,
            zoom: tile.coord.z,
            maxZoom: this.maxzoom,
            tileSize: this.tileSize,
            source: this.id,
            overscaling: overscaling,
            angle: this.map.transform.angle,
            pitch: this.map.transform.pitch,
            showCollisionBoxes: this.map.showCollisionBoxes
        };

        tile.workerID = this.dispatcher.send('load tile', params, function(err, data) {

            tile.unloadVectorData(this.map.painter);

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

            return callback(null, data);

        }.bind(this), this.workerID);
    },

    abort: function(tile) {
        tile.aborted = true;
    },

    unload: function(tile) {
        tile.unloadVectorData(this.map.painter);
        this.dispatcher.send('remove tile', { uid: tile.uid, source: this.id }, null, tile.workerID);
    },

    serialize: function() {
        return {
            type: this.type,
            data: this._data
        };
    }
};
