'use strict';

var Evented = require('../util/Evented');
var util = require('../util/util');
var urlResolve = require('resolve-url');
var EXTENT = require('../data/bucket').EXTENT;

var webworkify = require('webworkify');

module.exports.create = function (id, options, dispatcher) {
    return new GeoJSONSource(id, options, dispatcher);
};

module.exports.workerSourceURL = URL.createObjectURL(
    webworkify(require('./geojson_worker_source'), {bare: true})
);

/**
 * A datasource containing GeoJSON.
 *
 * @class GeoJSONSource
 * @param {Object} [options]
 * @param {Object|string} [options.data] A GeoJSON data object or a URL to one. The latter is preferable in the case of large GeoJSON objects.
 * @param {number} [options.maxzoom=18] The maximum zoom level at which to preserve detail (1-20).
 * @param {number} [options.buffer=128] The tile buffer, measured in pixels. The buffer extends each
 *   tile's data just past its visible edges, helping to ensure seamless rendering across tile boundaries.
 *   The default value, 128, is a safe value for label layers, preventing text clipping at boundaries.
 *   You can read more about buffers and clipping in the
 *   [Mapbox Vector Tile Specification](https://www.mapbox.com/vector-tiles/specification/#clipping).
 * @param {number} [options.tolerance=0.375] The simplification tolerance, measured in pixels.
 *   This value is passed into a modified [Ramer–Douglas–Peucker algorithm](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm)
 *   to simplify (i.e. reduce the number of points) in curves. Higher values result in greater simplification.
 * @param {boolean} [options.cluster] If `true`, a collection of point features will be clustered into groups,
 *   according to `options.clusterRadius`.
 * @param {number} [options.clusterRadius=50] The radius of each cluster when clustering points, measured in pixels.
 * @param {number} [options.clusterMaxZoom] The maximum zoom level to cluster points in. By default, this value is
 *   one zoom level less than the map's `maxzoom`, so that at the highest zoom level features are not clustered.

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
function GeoJSONSource(id, options, dispatcher) {
    this.id = id;
    this.dispatcher = dispatcher;

    options = options || {};

    this._data = options.data;
    this.type = options.type;
    if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;

    this._updateData(function done(err) {
        if (err) {
            this.fire('error', err);
            return;
        }
        this.fire('load');
    }.bind(this));
}

GeoJSONSource.prototype = util.inherit(Evented, /** @lends GeoJSONSource.prototype */ {
    minzoom: 0,
    maxzoom: 18,
    tileSize: 512,
    isTileClipped: true,
    _dirty: true,

    onAdd: function (map) {
        this.map = map;
    },

    /**
     * Sets the GeoJSON data and re-renders the map.
     *
     * @param {Object|string} data A GeoJSON data object or a URL to one. The latter is preferable in the case of large GeoJSON files.
     * @returns {GeoJSONSource} this
     */
    setData: function(data) {
        this._data = data;
        this._dirty = true;

        this.fire('change');

        return this;
    },

    _updateData: function(callback) {
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
            this._loaded = true;
            callback(err);

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
        this.dispatcher.send('remove tile', { uid: tile.uid, source: this.id }, function() {}, tile.workerID);
    },

    serialize: function() {
        return {
            type: this.type,
            data: this._data
        };
    }
});
