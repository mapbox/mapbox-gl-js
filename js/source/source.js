'use strict';

var util = require('../util/util');
var ajax = require('../util/ajax');
var browser = require('../util/browser');
var TilePyramid = require('./tile_pyramid');
var normalizeURL = require('../util/mapbox').normalizeSourceURL;
var TileCoord = require('./tile_coord');

exports._loadTileJSON = function(options) {
    var loaded = function(err, tileJSON) {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        util.extend(this, util.pick(tileJSON,
            ['tiles', 'minzoom', 'maxzoom', 'attribution']));

        if (tileJSON.vector_layers) {
            this.vectorLayers = tileJSON.vector_layers;
            this.vectorLayerIds = this.vectorLayers.map(function(layer) { return layer.id; });
        }

        this._pyramid = new TilePyramid({
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            roundZoom: this.roundZoom,
            reparseOverscaled: this.reparseOverscaled,
            load: this._loadTile.bind(this),
            abort: this._abortTile.bind(this),
            unload: this._unloadTile.bind(this),
            add: this._addTile.bind(this),
            remove: this._removeTile.bind(this),
            redoPlacement: this._redoTilePlacement ? this._redoTilePlacement.bind(this) : undefined
        });

        this.fire('load');
    }.bind(this);

    if (options.url) {
        ajax.getJSON(normalizeURL(options.url), loaded);
    } else {
        browser.frame(loaded.bind(this, null, options));
    }
};

exports.redoPlacement = function() {
    if (!this._pyramid) {
        return;
    }

    var ids = this._pyramid.orderedIDs();
    for (var i = 0; i < ids.length; i++) {
        var tile = this._pyramid.getTile(ids[i]);
        this._redoTilePlacement(tile);
    }
};

exports._getTile = function(coord) {
    return this._pyramid.getTile(coord.id);
};

exports._getVisibleCoordinates = function() {
    if (!this._pyramid) return [];
    else return this._pyramid.renderedIDs().map(TileCoord.fromID);
};

exports._vectorFeaturesAt = function(coord, params, classes, zoom, bearing, callback) {
    if (!this._pyramid)
        return callback(null, []);

    var result = this._pyramid.tileAt(coord);
    if (!result)
        return callback(null, []);

    this.dispatcher.send('query features', {
        uid: result.tile.uid,
        x: result.x,
        y: result.y,
        scale: result.scale,
        tileSize: result.tileSize,
        classes: classes,
        zoom: zoom,
        bearing: bearing,
        source: this.id,
        params: params
    }, callback, result.tile.workerID);
};


exports._vectorFeaturesIn = function(bounds, params, classes, zoom, bearing, callback) {
    if (!this._pyramid)
        return callback(null, []);

    var results = this._pyramid.tilesIn(bounds);
    if (!results)
        return callback(null, []);

    util.asyncAll(results, function queryTile(result, cb) {
        this.dispatcher.send('query features', {
            uid: result.tile.uid,
            source: this.id,
            minX: result.minX,
            maxX: result.maxX,
            minY: result.minY,
            maxY: result.maxY,
            scale: result.scale,
            tileSize: result.tileSize,
            classes: classes,
            zoom: zoom,
            bearing: bearing,
            params: params
        }, cb, result.tile.workerID);
    }.bind(this), function done(err, features) {
        callback(err, Array.prototype.concat.apply([], features));
    });
};

/*
 * Create a tiled data source instance given an options object
 *
 * @param {Object} options
 * @param {string} options.type Either `raster` or `vector`.
 * @param {string} options.url A tile source URL. This should either be `mapbox://{mapid}` or a full `http[s]` url that points to a TileJSON endpoint.
 * @param {Array} options.tiles An array of tile sources. If `url` is not specified, `tiles` can be used instead to specify tile sources, as in the TileJSON spec. Other TileJSON keys such as `minzoom` and `maxzoom` can be specified in a source object if `tiles` is used.
 * @param {string} options.id An optional `id` to assign to the source
 * @param {number} [options.tileSize=512] Optional tile size (width and height in pixels, assuming tiles are square). This option is only configurable for raster sources
 * @example
 * var sourceObj = new mapboxgl.Source.create({
 *    type: 'vector',
 *    url: 'mapbox://mapbox.mapbox-streets-v5'
 * });
 * map.addSource('some id', sourceObj); // add
 * map.removeSource('some id');  // remove
 */
exports.create = function(source) {
    // This is not at file scope in order to avoid a circular require.
    var sources = {
        vector: require('./vector_tile_source'),
        raster: require('./raster_tile_source'),
        geojson: require('./geojson_source'),
        video: require('./video_source'),
        image: require('./image_source')
    };

    return exports.is(source) ? source : new sources[source.type](source);
};

exports.is = function(source) {
    // This is not at file scope in order to avoid a circular require.
    var sources = {
        vector: require('./vector_tile_source'),
        raster: require('./raster_tile_source'),
        geojson: require('./geojson_source'),
        video: require('./video_source'),
        image: require('./image_source')
    };

    for (var type in sources) {
        if (source instanceof sources[type]) {
            return true;
        }
    }

    return false;
};
