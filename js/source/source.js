'use strict';

var util = require('../util/util');

var sourceTypes = {
    'vector': require('../source/vector_tile_source').create,
    'raster': require('../source/raster_tile_source').create,
    'geojson': require('../source/geojson_source').create,
    'video': require('../source/video_source').create,
    'image': require('../source/image_source').create
};

/**
 * A data source.
 * @typedef {Object} Source
 * @fires load to indicate source data has been loaded, so that it's okay to call `loadTile`
 * @fires change to indicate source data has changed, so that any current caches should be flushed
 * @property {string} id
 * @property {number} minzoom
 * @property {number} maxzoom
 * @property {boolean} isTileClipped
 * @property {boolean} reparseOverscaled
 * @property {boolean} roundZoom
 */

/*
 * @method
 * @name Source#loadTile
 * @param {Tile} tile
 * @param {Funtion} callback Called when tile has been loaded
 */

/*
 * @method
 * @name Source#abortTile
 * @param {Tile} tile
 */

/*
 * @method
 * @name Source#unloadTile
 * @param {Tile} tile
 */

/*
 * @method
 * @name Source#serialize
 * @returns {Object} A plain (stringifiable) JS object representing the current state of the source. Creating a source using the returned object as the `options` should result in a Source that is equivalent to this one.
 */

/*
 * @method
 * @name Source#prepare
 */

/**
 * @callback CreateSourceFuntion
 * @param {string} id
 * @param {Object} options
 * @param {string} options.type The source type, matching the value of `name` used in {@link Style#addSourceType}.
 * @param {Dispatcher} dispatcher
 * @returns {Source}
 */

/**
 * Supports a {@link Source} instance with code that can be run on the WebWorkers. In
 * addition to providing a custom {@link WorkerSource#loadTile}, any other
 * methods attached to a `WorkerSource` implementation may also be targeted by
 * the `Source` via `dispatcher.send('source-type.methodname', params, callback)`.
 *
 * @typedef {Object} WorkerSource
 */

/**
 * @member WorkerSource#loadTile
 *
 * Optional method that provides a custom implementation for loading a
 * VectorTile from the given params.
 *
 * @param {object} params The `params` that are sent by the {@link Source} when invokes the Worker's `load tile` or `reload tile` tasks.
 * @param {Function} callback Called with `{tile: VectorTile, rawTileData: Buffer}`
 * @returns {Function} A cancellation callback, called if a requested tile is no longer needed.
 */

/*
 * Creates a tiled data source instance given an options object.
 *
 * @param {string} id
 * @param {Object} options A source definition object compliant with [`mapbox-gl-style-spec`](https://www.mapbox.com/mapbox-gl-style-spec/#sources) or, for a third-party source type, with that type's requirements.
 * @param {string} options.type A source type like `raster`, `vector`, `video`, etc. Can include 3rd-party source types that have been added with {@link Style#addSourceType}.
 * @param {Dispatcher} dispatcher
 * @returns {Source}
 *
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
