// @flow

const util = require('../util/util');

const sourceTypes = {
    'vector': require('../source/vector_tile_source'),
    'raster': require('../source/raster_tile_source'),
    'geojson': require('../source/geojson_source'),
    'video': require('../source/video_source'),
    'image': require('../source/image_source'),
    'canvas': require('../source/canvas_source')
};

/*
 * Creates a tiled data source instance given an options object.
 *
 * @param id
 * @param {Object} source A source definition object compliant with [`mapbox-gl-style-spec`](https://www.mapbox.com/mapbox-gl-style-spec/#sources) or, for a third-party source type, with that type's requirements.
 * @param {Dispatcher} dispatcher
 * @returns {Source}
 */
exports.create = function(id: string, source: any, dispatcher: any, eventedParent: any) {
    source = new sourceTypes[source.type](id, source, dispatcher, eventedParent);

    if (source.id !== id) {
        throw new Error(`Expected Source id to be ${id} instead of ${source.id}`);
    }

    util.bindAll(['load', 'abort', 'unload', 'serialize', 'prepare'], source);
    return source;
};

exports.getType = function (name: string) {
    return sourceTypes[name];
};

exports.setType = function (name: string, type: any) {
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
 * @fires data with `{dataType: 'source', sourceDataType: 'metadata'}` to indicate that any necessary metadata
 * has been loaded so that it's okay to call `loadTile`; and with `{dataType: 'source', sourceDataType: 'content'}`
 * to indicate that the source data has changed, so that any current caches should be flushed.
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


import type {TileCoord} from './tile_coord';
import type {Actor} from '../util/actor';
import type {StyleLayerIndex} from '../style/style_layer_index';

export type TileParameters = {
    source: string,
    uid: string,
};

export type PlacementConfig = {
    angle: number,
    pitch: number,
    cameraToCenterDistance: number,
    cameraToTileDistance: number,
    showCollisionBoxes: boolean,
};

export type WorkerTileParameters = TileParameters & {
    coord: TileCoord,
    url: string,
    zoom: number,
    maxZoom: number,
    tileSize: number,
    overscaling: number,
} & PlacementConfig;

export type WorkerTileResult = {
    buckets: any,
    featureIndex: any,
    collisionTile: any,
    rawTileData?: any,
};

export type WorkerTileCallback = (error: ?Error, result: ?WorkerTileResult, transferables: ?Array<Transferable>) => void;

export type RedoPlacementParameters = TileParameters & PlacementConfig;

export type RedoPlacementResult = {
    buckets: any,
    collisionTile: any
};

export type RedoPlacementCallback = (error: ?Error, result: ?RedoPlacementResult, transferables: ?Array<Transferable>) => void;

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
 * @param actor
 * @param layerIndex
 */
export interface WorkerSource {
    constructor(actor: Actor, layerIndex: StyleLayerIndex): WorkerSource;

    /**
     * Loads a tile from the given params and parse it into buckets ready to send
     * back to the main thread for rendering.  Should call the callback with:
     * `{ buckets, featureIndex, collisionTile, rawTileData}`.
     */
    loadTile(params: WorkerTileParameters, callback: WorkerTileCallback): void;

    /**
     * Re-parses a tile that has already been loaded.  Yields the same data as
     * {@link WorkerSource#loadTile}.
     */
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback): void;

    /**
     * Aborts loading a tile that is in progress.
     */
    abortTile(params: TileParameters): void;

    /**
     * Removes this tile from any local caches.
     */
    removeTile(params: TileParameters): void;

    redoPlacement(params: RedoPlacementParameters, callback: RedoPlacementCallback): void;
    removeSource?: (params: {source: string}) => void;
}

export interface VectorTile {
    layers: any;
}

/**
 * The result passed to the `loadVectorData` callback must conform to the interface established
 * by the `VectorTile` class from the [vector-tile](https://www.npmjs.com/package/vector-tile)
 * npm package. In addition, it must have a `rawData` property containing an `ArrayBuffer`
 * with protobuf data conforming to the
 * [Mapbox Vector Tile specification](https://github.com/mapbox/vector-tile-spec).
 *
 * @class AugmentedVectorTile
 * @property {ArrayBuffer} rawData
 * @private
 */
export type AugmentedVectorTile = VectorTile & {
     rawData: any;
     expires?: any;
     cacheControl?: any;
};
