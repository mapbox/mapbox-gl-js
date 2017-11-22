// @flow

const util = require('../util/util');

import type Dispatcher from '../util/dispatcher';
import type Evented from '../util/evented';
import type Map from '../ui/map';
import type Tile from './tile';
import type TileCoord from './tile_coord';
import type {Callback} from '../types/callback';

/**
 * The `Source` interface must be implemented by each source type, including "core" types (`vector`, `raster`,
 * `video`, etc.) and all custom, third-party types.
 *
 * @class Source
 * @private
 *
 * @param {string} id The id for the source. Must not be used by any existing source.
 * @param {Object} options Source options, specific to the source type (except for `options.type`, which is always
 * required).
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
 * @property {boolean} reparseOverscaled `true` if tiles should be sent back to the worker for each overzoomed zoom
 * level, `false` if not.
 * @property {boolean} roundZoom `true` if zoom levels are rounded to the nearest integer in the source data, `false`
 * if they are floor-ed to the nearest integer.
 */
export interface Source {
    /**
     * An optional URL to a script which, when run by a Worker, registers a {@link WorkerSource}
     * implementation for this Source type by calling `self.registerWorkerSource(workerSource: WorkerSource)`.
     * @private
     */
    static workerSourceURL?: URL;

    +type: string;
    id: string;
    minzoom: number,
    maxzoom: number,
    tileSize: number,
    attribution?: string,

    roundZoom?: boolean,
    reparseOverscaled?: boolean,
    vectorLayerIds?: Array<string>,

    hasTransition(): boolean;

    fire(type: string, data: Object): mixed;

    +onAdd?: (map: Map) => void;
    +onRemove?: (map: Map) => void;

    loadTile(tile: Tile, callback: Callback<void>): void;
    +hasTile?: (coord: TileCoord) => boolean;
    +abortTile?: (tile: Tile, callback: Callback<void>) => void;
    +unloadTile?: (tile: Tile, callback: Callback<void>) => void;

    /**
     * @returns A plain (stringifiable) JS object representing the current state of the source.
     * Creating a source using the returned object as the `options` should result in a Source that is
     * equivalent to this one.
     * @private
     */
    serialize(): Object;

    +prepare?: () => void;
}

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
 * @param {Object} source A source definition object compliant with
 * [`mapbox-gl-style-spec`](https://www.mapbox.com/mapbox-gl-style-spec/#sources) or, for a third-party source type,
  * with that type's requirements.
 * @param {Dispatcher} dispatcher
 * @returns {Source}
 */
exports.create = function(id: string, specification: SourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
    const source = new sourceTypes[specification.type](id, (specification: any), dispatcher, eventedParent);

    if (source.id !== id) {
        throw new Error(`Expected Source id to be ${id} instead of ${source.id}`);
    }

    util.bindAll(['load', 'abort', 'unload', 'serialize', 'prepare'], source);
    return source;
};

exports.getType = function (name: string) {
    return sourceTypes[name];
};

exports.setType = function (name: string, type: Class<Source>) {
    sourceTypes[name] = type;
};

export interface Actor {
    send(type: string, data: Object, callback: Callback<any>): void;
}
