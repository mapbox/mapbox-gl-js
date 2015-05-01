'use strict';

var util = require('../util/util');
var ajax = require('../util/ajax');
var browser = require('../util/browser');
var TilePyramid = require('./tile_pyramid');
var normalizeURL = require('../util/mapbox').normalizeSourceURL;

exports._loadTileJSON = function(options) {
    var loaded = function(err, tileJSON) {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        util.extend(this, util.pick(tileJSON,
            ['tiles', 'minzoom', 'maxzoom', 'attribution']));

        this._pyramid = new TilePyramid({
            tileSize: this.tileSize,
            cacheSize: 20,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
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

exports._renderedTiles = function() {
    var tiles = [];

    if (!this._pyramid)
        return tiles;

    var ids = this._pyramid.renderedIDs();
    for (var i = 0; i < ids.length; i++) {
        tiles.push(this._pyramid.getTile(ids[i]));
    }

    return tiles;
};

exports._vectorFeaturesAt = function(coord, params, callback) {
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
        source: this.id,
        params: params
    }, callback, result.tile.workerID);
};

/*
 * Create a tiled data source instance given an options object
 *
 * @param {Object} options
 * @param {String} options.type Either `raster` or `vector`.
 * @param {String} options.url A tile source URL. This should either be `mapbox://{mapid}` or a full `http[s]` url that points to a TileJSON endpoint.
 * @param {Array} options.tiles An array of tile sources. If `url` is not specified, `tiles` can be used instead to specify tile sources, as in the TileJSON spec. Other TileJSON keys such as `minzoom` and `maxzoom` can be specified in a source object if `tiles` is used.
 * @param {String} options.id An optional `id` to assign to the source
 * @param {Number} [options.tileSize=512] Optional tile size (width and height in pixels, assuming tiles are square). This option is only configurable for raster sources
 * @param {Number} options.cacheSize Optional max number of tiles to cache at any given time
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
        video: require('./video_source')
    };

    for (var type in sources) {
        if (source instanceof sources[type]) {
            return source;
        }
    }

    return new sources[source.type](source);
};
