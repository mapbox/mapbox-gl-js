'use strict';

var util = require('../util/util');
var Evented = require('../util/evented');
var TilePyramid = require('./tile_pyramid');
var Source = require('./source');
var urlResolve = require('resolve-url');
var WorkerTile = require('./worker_tile');
var ajax = require('../util/ajax');
var supercluster = require('supercluster');
var geojsonvt = require('geojson-vt');
var GeoJSONWrapper = require('../source/geojson_wrapper');

module.exports = GeoJSONSource;

/**
 * Create a GeoJSON data source instance given an options object
 * @class GeoJSONSource
 * @param {Object} [options]
 * @param {Object|string} options.data A GeoJSON data object or URL to it. The latter is preferable in case of large GeoJSON files.
 * @param {number} [options.maxzoom=14] Maximum zoom to preserve detail at.
 * @param {number} [options.buffer] Tile buffer on each side.
 * @param {number} [options.tolerance] Simplification tolerance (higher means simpler).
 * @param {number} [options.cluster] If the data is a collection of point features, setting this to true clusters the points by radius into groups.
 * @param {number} [options.clusterRadius=400] Radius of each cluster when clustering points, relative to `4096` tile.
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
function GeoJSONSource(options) {
    options = options || {};

    this._data = options.data;

    if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;

    this.geojsonVtOptions = {maxZoom: this.maxzoom};
    if (options.buffer !== undefined) this.geojsonVtOptions.buffer = options.buffer;
    if (options.tolerance !== undefined) this.geojsonVtOptions.tolerance = options.tolerance;

    this.cluster = options.cluster || false;
    this.superclusterOptions = {
        maxZoom: Math.max(options.clusterMaxZoom, this.maxzoom - 1) || (this.maxzoom - 1),
        extent: 4096,
        radius: options.clusterRadius || 400,
        log: false
    };

    this.skipWorker = options.skipWorker;

    this._pyramid = new TilePyramid({
        tileSize: 512,
        minzoom: this.minzoom,
        maxzoom: this.maxzoom,
        cacheSize: 20,
        load: this._loadTile.bind(this),
        abort: this._abortTile.bind(this),
        unload: this._unloadTile.bind(this),
        add: this._addTile.bind(this),
        remove: this._removeTile.bind(this),
        redoPlacement: this._redoTilePlacement.bind(this)
    });

    this._loadedTiles = {};
    this._geoJSONIndexes = {};
}

GeoJSONSource.prototype = util.inherit(Evented, /** @lends GeoJSONSource.prototype */{
    minzoom: 0,
    maxzoom: 14,
    _dirty: true,
    isTileClipped: true,

    /**
     * Update source geojson data and rerender map
     *
     * @param {Object|string} data A GeoJSON data object or URL to it. The latter is preferable in case of large GeoJSON files.
     * @returns {GeoJSONSource} this
     */
    setData: function(data) {
        this._data = data;
        this._dirty = true;

        this.fire('change');

        if (this.map)
            this.update(this.map.transform);

        return this;
    },

    onAdd: function(map) {
        this.map = map;
    },

    loaded: function() {
        return this._loaded && this._pyramid.loaded();
    },

    update: function(transform) {
        if (this._dirty) {
            this._updateData();
        }

        if (this._loaded) {
            this._pyramid.update(this.used, transform);
        }
    },

    reload: function() {
        if (this._loaded) {
            this._pyramid.reload();
        }
    },

    getVisibleCoordinates: Source._getVisibleCoordinates,
    getTile: Source._getTile,

    featuresAt: function(coord, params, callback) {
        if (!this._pyramid)
            return callback(null, []);

        var result = this._pyramid.tileAt(coord);
        if (!result)
            return callback(null, []);

        this._queryFeatures({
            uid: result.tile.uid,
            x: result.x,
            y: result.y,
            tileExtent: result.tile.tileExtent,
            scale: result.scale,
            source: this.id,
            params: params
        }, callback, result.tile.workerID);
    },

    featuresIn: function(bounds, params, callback) {
        if (!this._pyramid)
            return callback(null, []);

        var results = this._pyramid.tilesIn(bounds);
        if (!results)
            return callback(null, []);

        util.asyncAll(results, function queryTile(result, cb) {
            this._queryFeatures({
                uid: result.tile.uid,
                source: this.id,
                minX: result.minX,
                maxX: result.maxX,
                minY: result.minY,
                maxY: result.maxY,
                params: params
            }, cb, result.tile.workerID);
        }.bind(this), function done(err, features) {
            callback(err, Array.prototype.concat.apply([], features));
        });
    },

    _queryFeatures: function(params, callback, workerID) {
        if (this.skipWorker) {
            var tile = this._loadedTiles[params.source] && this._loadedTiles[params.source][params.uid];
            if (tile) {
                tile.featureTree.query(params, callback);
            } else {
                callback(null, []);
            }
        } else {
            this.dispatcher.send('query features', params, callback, workerID);
        }
    },

    _updateData: function() {
        this._dirty = false;
        var data = this._data;
        if (typeof data === 'string' && typeof window != 'undefined') {
            data = urlResolve(window.location.href, data);
        }

        var params = {
            data: data,
            tileSize: 512,
            source: this.id,
            geojsonVtOptions: this.geojsonVtOptions,
            cluster: this.cluster,
            superclusterOptions: this.superclusterOptions
        };

        var that = this;

        if (this.skipWorker) {
            var indexData = function(err, data) {
                if (err) return callback(err);
                if (typeof data != 'object') {
                    return callback(new Error("Input data is not a valid GeoJSON object."));
                }
                try {
                    this._geoJSONIndexes[params.source] = params.cluster ?
                        supercluster(params.superclusterOptions).load(data.features) :
                        geojsonvt(data, params.geojsonVtOptions);
                } catch (err) {
                    return callback(err);
                }
                callback(null);
            }.bind(this);

            // TODO accept params.url for urls instead

            // Not, because of same origin issues, urls must either include an
            // explicit origin or absolute path.
            // ie: /foo/bar.json or http://example.com/bar.json
            // but not ../foo/bar.json
            if (typeof params.data === 'string') {
                ajax.getJSON(params.data, indexData);
            }
            else indexData(null, params.data);
        } else {
            this.workerID = this.dispatcher.send('parse geojson', params, callback);
        }

        function callback(err) {
            that._loaded = true;
            if (err) {
                that.fire('error', {error: err});
            } else {
                that._pyramid.reload();
                that.fire('change');
            }
        }
    },

    _loadTile: function(tile) {
        var overscaling = tile.coord.z > this.maxzoom ? Math.pow(2, tile.coord.z - this.maxzoom) : 1;
        var params = {
            uid: tile.uid,
            coord: tile.coord,
            zoom: tile.coord.z,
            maxZoom: this.maxzoom,
            tileSize: 512,
            source: this.id,
            overscaling: overscaling,
            angle: this.map.transform.angle,
            pitch: this.map.transform.pitch,
            collisionDebug: this.map.collisionDebug
        };

        var that = this;

        if (this.skipWorker) {
            var source = params.source,
                coord = params.coord;

            if (!this._geoJSONIndexes[source]) return callback(null, null); // we couldn't load the file

            var geoJSONTile = this._geoJSONIndexes[source].getTile(coord.z, coord.x, coord.y);

            if (!geoJSONTile) return callback(null, null); // nothing in the given tile

            var workerTile = new WorkerTile(params);
            workerTile.parse(
                new GeoJSONWrapper(geoJSONTile.features),
                this.style._order.map(function(id) { return this.style._layers[id].json(); }, this), // layers
                null, // actor
                callback
            );

            this._loadedTiles[source] = this._loadedTiles[source] || {};
            this._loadedTiles[source][params.uid] = workerTile;
        } else {
            tile.workerID = this.dispatcher.send('load geojson tile', params, callback, this.workerID);
        }

        function callback(err, data) {
            tile.unloadVectorData(that.map.painter);

            if (tile.aborted)
                return;

            if (err) {
                that.fire('tile.error', {tile: tile});
                return;
            }

            tile.loadVectorData(data);

            if (tile.redoWhenDone) {
                tile.redoWhenDone = false;
                tile.redoPlacement(that);
            }

            that.fire('tile.load', {tile: tile});
        }

    },

    _abortTile: function(tile) {
        tile.aborted = true;
    },

    _addTile: function(tile) {
        this.fire('tile.add', {tile: tile});
    },

    _removeTile: function(tile) {
        this.fire('tile.remove', {tile: tile});
    },

    _unloadTile: function(tile) {
        tile.unloadVectorData(this.map.painter);
        this.dispatcher.send('remove tile', { uid: tile.uid, source: this.id }, null, tile.workerID);
    },

    redoPlacement: Source.redoPlacement,

    _redoTilePlacement: function(tile) {
        tile.redoPlacement(this);
    }
});
