'use strict';

var util = require('../util/util');
var ajax = require('../util/ajax');
var browser = require('../util/browser');
var normalizeURL = require('../util/mapbox').normalizeSourceURL;
var TileCoord = require('./tile_coord');

exports._loadTileJSON = function(options, callback) {
    var loaded = function(err, tileJSON) {
        if (err) {
            return callback(err);
        }

        var result = util.pick(tileJSON, ['tiles', 'minzoom', 'maxzoom', 'attribution']);

        if (tileJSON.vector_layers) {
            result.vectorLayers = tileJSON.vector_layers;
            result.vectorLayerIds = result.vectorLayers.map(function(layer) { return layer.id; });
        }

        callback(null, result);
    };

    if (options.url) {
        ajax.getJSON(normalizeURL(options.url), loaded);
    } else {
        browser.frame(loaded.bind(null, null, options));
    }
};

function sortTilesIn(a, b) {
    var coordA = a.coord;
    var coordB = b.coord;
    return (coordA.z - coordB.z) || (coordA.y - coordB.y) || (coordA.w - coordB.w) || (coordA.x - coordB.x);
}

function mergeRenderedFeatureLayers(tiles) {
    var result = tiles[0] || {};
    for (var i = 1; i < tiles.length; i++) {
        var tile = tiles[i];
        for (var layerID in tile) {
            var tileFeatures = tile[layerID];
            var resultFeatures = result[layerID];
            if (resultFeatures === undefined) {
                resultFeatures = result[layerID] = tileFeatures;
            } else {
                for (var f = 0; f < tileFeatures.length; f++) {
                    resultFeatures.push(tileFeatures[f]);
                }
            }
        }
    }
    return result;
}

exports._queryRenderedVectorFeatures = function(queryGeometry, params, zoom, bearing) {
    if (!this._pyramid || !this.map)
        return {};

    var tilesIn = this._pyramid.tilesIn(queryGeometry);

    tilesIn.sort(sortTilesIn);

    var styleLayers = this.map.style._layers;

    var renderedFeatureLayers = [];
    for (var r = 0; r < tilesIn.length; r++) {
        var tileIn = tilesIn[r];
        if (!tileIn.tile.featureIndex) continue;

        renderedFeatureLayers.push(tileIn.tile.featureIndex.query({
            queryGeometry: tileIn.queryGeometry,
            scale: tileIn.scale,
            tileSize: tileIn.tile.tileSize,
            bearing: bearing,
            params: params
        }, styleLayers));
    }
    return mergeRenderedFeatureLayers(renderedFeatureLayers);
};

exports._querySourceFeatures = function(params) {
    if (!this._pyramid) {
        return [];
    }

    var pyramid = this._pyramid;
    var tiles = pyramid.renderedIDs().map(function(id) {
        return pyramid.getTile(id);
    });

    var result = [];

    var dataTiles = {};
    for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        var dataID = new TileCoord(Math.min(tile.sourceMaxZoom, tile.coord.z), tile.coord.x, tile.coord.y, 0).id;
        if (!dataTiles[dataID]) {
            dataTiles[dataID] = true;
            tile.querySourceFeatures(result, params);
        }
    }

    return result;
};

var sourceTypes = {};

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
exports.create = function(id, source, dispatcher, onChange, callback) {
    return exports.is(source) ? source :
        sourceTypes[source.type](id, source, dispatcher, onChange, callback);
};

exports.is = function(source) {
    // TODO: with the Source interface being factory-based, instanceof doesn't
    // work as naturally for this.  Is Source.is() still needed?

    return source && source.id;
    // for (var type in sourceTypes) {
    //     if (source instanceof sourceTypes[type]) {
    //         return true;
    //     }
    // }
    // return false;
};

exports.getType = function (name) {
    return sourceTypes[name];
};

exports.setType = function (name, type) {
    sourceTypes[name] = type;
};
