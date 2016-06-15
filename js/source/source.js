'use strict';

var util = require('../util/util');

var sourceTypes = {};

/**
 * @interface Source
 *
 * @fires load to indicate source data has been loaded, so that it's okay to call `loadTile`
 * @fires change to indicate source data has changed, so that any current caches should be flushed
 */

/**
 * @member {string} Source#id
 */
/**
 * @member {number} Source#minzoom
 */
/**
 * @member {number} Source#maxzoom
 */
/**
 * @member {boolean} Source#isTileClipped
 */
/**
 * @member {boolean} Source#reparseOverscaled
 */
/**
 * @member {boolean} Source#roundZoom
 */

/**
 * @method
 * @name Source#loadTile
 * @param {Tile} tile
 * @param {Funtion} callback Called when tile has been loaded
 */

/**
 * @method
 * @name Source#abortTile
 * @param {Tile} tile
 */

/**
 * @method
 * @name Source#unloadTile
 * @param {Tile} tile
 */

/**
 * @method
 * @name Source#serialize
 * @returns {Object} A plain (stringifiable) JS object representing the current state of the source. Creating a source using the returned object as the `options` should result in a Source that is equivalent to this one.
 */

/**
 * @method
 * @name Source#prepare
 */

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
 *    url: 'mapbox://mapbox.mapbox-streets-v6'
 * });
 * map.addSource('some id', sourceObj); // add
 * map.removeSource('some id');  // remove
 */
exports.create = function(id, source, dispatcher) {
    source = sourceTypes[source.type](id, source, dispatcher);

    if (source.id !== id) {
        throw new Error('Expected Source id to be ' + id + ' instead of ' + source.id);
    }

    util.bindAll(['load', 'abort', 'unload', 'serialize', 'prepare'], source);
    return source;
};

exports.getType = function (name) {
    return sourceTypes[name];
};

exports.setType = function (name, type) {
    sourceTypes[name] = type;
};
