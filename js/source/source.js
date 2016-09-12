'use strict';

var util = require('../util/util');

var sourceTypes = {
    'vector': require('../source/vector_tile_source'),
    'raster': require('../source/raster_tile_source'),
    'geojson': require('../source/geojson_source'),
    'video': require('../source/video_source'),
    'image': require('../source/image_source')
};

/*
 * Creates a tiled data source instance given an options object.
 *
 * @param {string} id
 * @param {Object} source A source definition object compliant with [`mapbox-gl-style-spec`](https://www.mapbox.com/mapbox-gl-style-spec/#sources) or, for a third-party source type, with that type's requirements.
 * @param {string} options.type A source type like `raster`, `vector`, `video`, etc.
 * @param {Dispatcher} dispatcher
 * @returns {Source}
 */
exports.create = function(id, source, dispatcher) {
    source = new sourceTypes[source.type](id, source, dispatcher);

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

/**
 * The `Source` interface must be implemented by each source type, including "core" types (`vector`, `raster`, `video`, etc.) and all custom, third-party types.
 *
 * @class Source
 * @private
 *
 * @param {string} id The id for the source. Must not be used by any existing source.
 * @param {Object} options Source options, specific to the source type (except for `options.type`, which is always required).
 * @param {string} options.type The source type, matching the value of `name` used in {@link Style#addSourceType}.
 * @param {Dispatcher} dispatcher A {@link Dispatcher} instance, which can be used to send messages to the workers.
 *
 * @fires load to indicate source data has been loaded, so that it's okay to call `loadTile`
 * @fires change to indicate source data has changed, so that any current caches should be flushed
 * @property {string} id The id for the source.  Must match the id passed to the constructor.
 * @property {number} minzoom
 * @property {number} maxzoom
 * @property {boolean} isTileClipped `false` if tiles can be drawn outside their boundaries, `true` if they cannot.
 * @property {boolean} reparseOverscaled `true` if tiles should be sent back to the worker for each overzoomed zoom level, `false` if not.
 * @property {boolean} roundZoom `true` if zoom levels are rounded to the nearest integer in the source data, `false` if they are floor-ed to the nearest integer.
 */

/**
 * An optional URL to a script which, when run by a Worker, registers a {@link WorkerSource} implementation for this Source type by calling `self.registerWorkerSource(workerSource: WorkerSource)`.
 *
 * @member {URL|undefined} workerSourceURL
 * @memberof Source
 * @static
 */

/**
 * @method
 * @name loadTile
 * @param {Tile} tile
 * @param {Funtion} callback Called when tile has been loaded
 * @memberof Source
 * @instance
 */

/**
 * @method
 * @name abortTile
 * @param {Tile} tile
 * @memberof Source
 * @instance
 */

/**
 * @method
 * @name unloadTile
 * @param {Tile} tile
 * @memberof Source
 * @instance
 */

/**
 * @method
 * @name serialize
 * @returns {Object} A plain (stringifiable) JS object representing the current state of the source. Creating a source using the returned object as the `options` should result in a Source that is equivalent to this one.
 * @memberof Source
 * @instance
 */

/**
 * @method
 * @name prepare
 * @memberof Source
 * @instance
 */



/**
 * May be implemented by custom source types to provide code that can be run on
 * the WebWorkers. In addition to providing a custom
 * {@link WorkerSource#loadTile}, any other methods attached to a `WorkerSource`
 * implementation may also be targeted by the {@link Source} via
 * `dispatcher.send('source-type.methodname', params, callback)`.
 *
 * @see {@link Map#addSourceType}
 * @private
 *
 * @class WorkerSource
 * @param {Actor} actor
 * @param {object} styleLayers An accessor provided by the Worker to get the current style layers and layer families.
 * @param {Function} styleLayers.getLayers
 * @param {Function} styleLayers.getLayerFamilies
 */

/**
 * Loads a tile from the given params and parse it into buckets ready to send
 * back to the main thread for rendering.  Should call the callback with:
 * `{ buckets, featureIndex, collisionTile, symbolInstancesArray, symbolQuadsArray, rawTileData}`.
 *
 * @method
 * @name loadTile
 * @param {object} params Parameters sent by the main-thread Source identifying the tile to load.
 * @param {Function} callback
 * @memberof WorkerSource
 * @instance
 */

/**
 * Re-parses a tile that has already been loaded.  Yields the same data as
 * {@link WorkerSource#loadTile}.
 *
 * @method
 * @name reloadTile
 * @param {object} params
 * @param {Function} callback
 * @memberof WorkerSource
 * @instance
 */

/**
 * Aborts loading a tile that is in progress.
 * @method
 * @name abortTile
 * @param {object} params
 * @memberof WorkerSource
 * @instance
 */

/**
 * Removes this tile from any local caches.
 * @method
 * @name removeTile
 * @memberof WorkerSource
 * @instance
 */
