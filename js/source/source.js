'use strict';

var util = require('../util/util');
var ajax = require('../util/ajax');
var browser = require('../util/browser');
var TilePyramid = require('./tile_pyramid');
var normalizeURL = require('../util/mapbox').normalizeSourceURL;

exports._loadTileJSON = function(options) {
    var loaded = (err, tileJSON) => {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        util.extend(this, util.pick(tileJSON,
            'tiles', 'minzoom', 'maxzoom', 'attribution'));

        this._pyramid = new TilePyramid({
            tileSize: this.tileSize,
            cacheSize: 20,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            load: this._loadTile.bind(this),
            abort: this._abortTile.bind(this),
            unload: this._unloadTile.bind(this),
            add: this._addTile.bind(this),
            remove: this._removeTile.bind(this)
        });

        this.fire('load');
    };

    if (options.url) {
        ajax.getJSON(normalizeURL(options.url), loaded);
    } else {
        browser.frame(loaded.bind(this, null, options));
    }
};

exports._renderTiles = function(layers, painter) {
    if (this._pyramid) {
        this._pyramid.renderedIDs().forEach((id) => {
            painter.drawTile(id, this._pyramid.getTile(id), layers);
        });
    }
};

exports._vectorFeaturesAt = function(point, params, callback) {
    if (!this._pyramid)
        return callback(null, []);

    var result = this._pyramid.tileAt(point);
    if (!result)
        return callback(null, []);

    this.dispatcher.send('query features', {
        id: result.tile.uid,
        x: result.x,
        y: result.y,
        scale: result.scale,
        source: this.id,
        params: params
    }, callback, result.tile.workerID);
};

var sources = {
    vector: require('./vector_tile_source'),
    raster: require('./raster_tile_source'),
    geojson: require('./geojson_source'),
    video: require('./video_source')
};

exports.create = function(source) {
    return new sources[source.type](source);
};
