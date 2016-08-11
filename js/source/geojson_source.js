'use strict';

var Evented = require('../util/evented');
var util = require('../util/util');
var urlResolve = require('resolve-url');
var EXTENT = require('../data/bucket').EXTENT;

module.exports = GeoJSONSource;

/**
 * A source containing GeoJSON.
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
 *
 * @example
 * map.addSource('some id', {
 *     data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_ports.geojson'
 * });
 *
 * @example
 * map.addSource('some id', {
 *    type: 'geojson',
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
 *
 * @example
 * map.getSource('some id').setData({
 *     data: {
 *        "type": "FeatureCollection",
 *        "features": [{
 *            "type": "Feature",
 *            "properties": { "name": "Null Island" },
 *            "geometry": {
 *                "type": "Point",
 *                "coordinates": [ 0, 0 ]
 *            }
 *        }]
 *     }
 * });
 */
function GeoJSONSource(id, options, dispatcher) {
    options = options || {};
    this.id = id;
    this.dispatcher = dispatcher;

    this._data = options.data;

    if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;
    if (options.type) this.type = options.type;

    var scale = EXTENT / this.tileSize;

    // sent to the worker, along with `url: ...` or `data: literal geojson`,
    // so that it can load/parse/index the geojson data
    // extending with `options.workerOptions` helps to make it easy for
    // third-party sources to hack/reuse GeoJSONSource.
    this.workerOptions = util.extend({
        source: this.id,
        cluster: options.cluster || false,
        geojsonVtOptions: {
            buffer: (options.buffer !== undefined ? options.buffer : 128) * scale,
            tolerance: (options.tolerance !== undefined ? options.tolerance : 0.375) * scale,
            extent: EXTENT,
            maxZoom: this.maxzoom
        },
        superclusterOptions: {
            maxZoom: Math.min(options.clusterMaxZoom, this.maxzoom - 1) || (this.maxzoom - 1),
            extent: EXTENT,
            radius: (options.clusterRadius || 50) * scale,
            log: false
        }
    }, options.workerOptions);

    this._updateWorkerData(function done(err) {
        if (err) {
            this.fire('error', {error: err});
            return;
        }
        this.fire('load');
    }.bind(this));
}

GeoJSONSource.prototype = util.inherit(Evented, /** @lends GeoJSONSource.prototype */ {
    // `type` is a property rather than a constant to make it easy for 3rd
    // parties to use GeoJSONSource to build their own source types.
    type: 'geojson',
    minzoom: 0,
    maxzoom: 18,
    tileSize: 512,
    isTileClipped: true,
    reparseOverscaled: true,

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

        this._updateWorkerData(function (err) {
            if (err) {
                return this.fire('error', { error: err });
            }
            this.fire('change');
        }.bind(this));

        return this;
    },

    /*
     * Responsible for invoking WorkerSource's geojson.loadData target, which
     * handles loading the geojson data and preparing to serve it up as tiles,
     * using geojson-vt or supercluster as appropriate.
     */
    _updateWorkerData: function(callback) {
        var options = util.extend({}, this.workerOptions);
        var data = this._data;
        if (typeof data === 'string') {
            options.url = typeof window != 'undefined' ? urlResolve(window.location.href, data) : data;
        } else {
            options.data = JSON.stringify(data);
        }

        // target {this.type}.loadData rather than literally geojson.loadData,
        // so that other geojson-like source types can easily reuse this
        // implementation
        this.workerID = this.dispatcher.send(this.type + '.loadData', options, function(err) {
            this._loaded = true;
            callback(err);

        }.bind(this));
    },

    loadTile: function (tile, callback) {
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

            return callback(null);

        }.bind(this), this.workerID);
    },

    abortTile: function(tile) {
        tile.aborted = true;
    },

    unloadTile: function(tile) {
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
