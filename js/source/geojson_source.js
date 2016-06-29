'use strict';

var util = require('../util/util');
var Evented = require('../util/evented');
var TilePyramid = require('./tile_pyramid');
var Source = require('./source');
var urlResolve = require('resolve-url');
var EXTENT = require('../data/bucket').EXTENT;

module.exports = GeoJSONSource;

/**
 * A datasource containing GeoJSON.
 *
 * @class GeoJSONSource
 * @param {Object} [options]
 * @param {Object|string} options.data A GeoJSON data object or a URL to one. The latter is preferable in the case of large GeoJSON objects.
 * @param {number} [options.maxzoom=18] The maximum zoom level at which to preserve detail (1-20).
 * @param {number} [options.buffer=128] The tile buffer, measured in pixels. The buffer extends each
 *   tile's data just past its visible edges, helping to ensure seamless rendering across tile boundaries.
 *   The default value, 128, is a safe value for label layers, preventing text clipping at boundaries.
 *   You can read more about buffers and clipping in the
 *   [Mapbox Vector Tile Specification](https://www.mapbox.com/vector-tiles/specification/#clipping).
 * @param {number} [options.tolerance=0.375] The simplification tolerance, measured in pixels.
 *   This value is pass into a modified [Ramer–Douglas–Peucker algorithm](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm)
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
function GeoJSONSource(options) {
    options = options || {};

    this._data = options.data;

    if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;

    var scale = EXTENT / this.tileSize;

    this.geojsonVtOptions = {
        buffer: (options.buffer !== undefined ? options.buffer : 128) * scale,
        tolerance: (options.tolerance !== undefined ? options.tolerance : 0.375) * scale,
        extent: EXTENT,
        maxZoom: this.maxzoom
    };

    this.cluster = options.cluster || false;
    this.superclusterOptions = {
        maxZoom: Math.min(options.clusterMaxZoom, this.maxzoom - 1) || (this.maxzoom - 1),
        extent: EXTENT,
        radius: (options.clusterRadius || 50) * scale,
        log: false
    };

    this._pyramid = new TilePyramid({
        tileSize: this.tileSize,
        minzoom: this.minzoom,
        maxzoom: this.maxzoom,
        reparseOverscaled: true,
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
    maxzoom: 18,
    tileSize: 512,
    _dirty: true,
    isTileClipped: true,

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

    serialize: function() {
        return {
            type: 'geojson',
            data: this._data
        };
    },

    getVisibleCoordinates: Source._getVisibleCoordinates,
    getTile: Source._getTile,

    queryRenderedFeatures: Source._queryRenderedVectorFeatures,
    querySourceFeatures: Source._querySourceFeatures,

    _updateData: function() {
        this._dirty = false;
        var options = {
            tileSize: this.tileSize,
            source: this.id,
            geojsonVtOptions: this.geojsonVtOptions,
            cluster: this.cluster,
            superclusterOptions: this.superclusterOptions
        };

        var data = this._data;
        if (typeof data === 'string') {
            options.url = typeof window != 'undefined' ? urlResolve(window.location.href, data) : data;
        } else {
            options.data = JSON.stringify(data);
        }
        this.workerID = this.dispatcher.send('parse geojson', options, function(err) {
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
            tileSize: this.tileSize,
            source: this.id,
            overscaling: overscaling,
            angle: this.map.transform.angle,
            pitch: this.map.transform.pitch,
            showCollisionBoxes: this.map.showCollisionBoxes
        };

        tile.workerID = this.dispatcher.send('load geojson tile', params, function(err, data) {

            tile.unloadVectorData(this.map.painter);

            if (tile.aborted)
                return;

            if (err) {
                this.fire('tile.error', {tile: tile});
                return;
            }

            tile.loadVectorData(data, this.map.style);

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
        this.dispatcher.send('remove tile', { uid: tile.uid, source: this.id }, function() {}, tile.workerID);
    },

    redoPlacement: Source.redoPlacement,

    _redoTilePlacement: function(tile) {
        tile.redoPlacement(this);
    }
});
