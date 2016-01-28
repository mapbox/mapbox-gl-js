'use strict';

var util = require('../util/util');
var Evented = require('../util/evented');
var TilePyramid = require('./tile_pyramid');
var Source = require('./source');
var urlResolve = require('resolve-url');

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

    featuresAt: Source._vectorFeaturesAt,
    featuresIn: Source._vectorFeaturesIn,

    _updateData: function() {
        this._dirty = false;
        var data = this._data;
        if (typeof data === 'string' && typeof window != 'undefined') {
            data = urlResolve(window.location.href, data);
        }
        this.workerID = this.dispatcher.send('parse geojson', {
            data: data,
            tileSize: 512,
            source: this.id,
            geojsonVtOptions: this.geojsonVtOptions,
            cluster: this.cluster,
            superclusterOptions: this.superclusterOptions
        }, function(err) {
            this._loaded = true;
            if (err) {
                this.fire('error', {error: err});
            } else {
                this._pyramid.reload();
                this.fire('change');
            }

        }.bind(this));
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

        tile.workerID = this.dispatcher.send('load geojson tile', params, function(err, data) {

            tile.unloadVectorData(this.map.painter);

            if (tile.aborted)
                return;

            if (err) {
                this.fire('tile.error', {tile: tile});
                return;
            }

            tile.loadVectorData(data);

            if (tile.redoWhenDone) {
                tile.redoWhenDone = false;
                tile.redoPlacement(this);
            }

            this.fire('tile.load', {tile: tile});

        }.bind(this), this.workerID);
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
