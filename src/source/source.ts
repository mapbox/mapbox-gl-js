import {bindAll} from '../util/util';
import {CanonicalTileID} from './tile_id';

import vector from '../source/vector_tile_source';
import raster from '../source/raster_tile_source';
import rasterDem from '../source/raster_dem_tile_source';
import rasterArray from '../source/raster_array_tile_source';
import geojson from '../source/geojson_source';
import video from '../source/video_source';
import image from '../source/image_source';
import canvas from '../source/canvas_source';
import custom from '../source/custom_source';
import model from '../../3d-style/source/model_source';
import tiled3DModel from '../../3d-style/source/tiled_3d_model_source';

import type Tile from './tile';
import type Dispatcher from '../util/dispatcher';
import type {Map} from '../ui/map';
import type {Class} from '../types/class';
import type {Callback} from '../types/callback';
import type {MapEvent} from '../ui/events';
import type {Event, Evented} from '../util/evented';
import type {OverscaledTileID} from './tile_id';
import type {Source} from './source_types';
import type {SourceSpecification} from '../style-spec/types';

export type {Source};

export type SourceRasterLayer = {
    id: string;
    maxzoom?: number;
    minzoom?: number;
    fields?: {
        bands?: Array<string | number>;
        range?: [number, number];
    };
};

export type SourceVectorLayer = {
    id: string;
    maxzoom?: number;
    minzoom?: number;
};

/**
 * The `Source` interface must be implemented by each source type, including "core" types like `vector`, `raster`,
 * or `video`) and all custom, third-party types.
 *
 * @private
 *
 * @param {string} id The id for the source. Must not be used by any existing source.
 * @param {Object} options Source options, specific to the source type (except for `options.type`, which is always
 * required).
 * @param {string} options.type The source type, matching the value of `name` used in {@link Style#addSourceType}.
 * @param {Dispatcher} dispatcher A {@link Dispatcher} instance, which can be used to send messages to the workers.
 *
 * @fires Map.event:data Fires `data` with `{dataType: 'source', sourceDataType: 'metadata'}`
 * to indicate that any necessary metadata has been loaded so that it's okay to call `loadTile`;
 * fires `data` with `{dataType: 'source', sourceDataType: 'content'}`
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
export interface ISource {
    readonly type: string;
    id: string;
    scope: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    attribution?: string;
    roundZoom?: boolean;
    isTileClipped?: boolean;
    mapbox_logo?: boolean;
    tileID?: CanonicalTileID;
    reparseOverscaled?: boolean;
    minTileCacheSize?: number | null | undefined;
    maxTileCacheSize?: number | null | undefined;
    language?: string | null | undefined;
    worldview?: string | null | undefined;
    readonly usedInConflation?: boolean;
    vectorLayers?: Array<SourceVectorLayer>;
    vectorLayerIds?: Array<string>;
    rasterLayers?: Array<SourceRasterLayer>;
    rasterLayerIds?: Array<string>;
    hasTransition(): boolean;
    loaded(): boolean;
    fire(event: Event): unknown;
    on(type: MapEvent, listener: (arg1: any) => any): Evented;
    off(type: MapEvent, listener: (arg1: any) => any): Evented;
    setEventedParent(parent?: Evented | null | undefined, data?: any | (() => any)): Evented;
    readonly onAdd?: (map: Map) => void;
    readonly onRemove?: (map: Map) => void;
    loadTile(
        tile: Tile,
        callback: Callback<undefined>,
        tileWorkers?: {
            [key: string]: Actor;
        },
    ): void;
    readonly hasTile?: (tileID: OverscaledTileID) => boolean;
    readonly abortTile?: (tile: Tile, callback: Callback<undefined>) => void;
    readonly unloadTile?: (tile: Tile, callback: Callback<undefined>) => void;
    readonly reload?: () => void;
    /**
     * @returns A plain (stringifiable) JS object representing the current state of the source.
     * Creating a source using the returned object as the `options` should result in a Source that is
     * equivalent to this one.
     * @private
     */
    serialize(): any;
    readonly prepare?: () => void;
    readonly afterUpdate?: () => void;
    readonly _clear?: () => void;
}

type SourceStatics = {
    /*
     * An optional URL to a script which, when run by a Worker, registers a {@link WorkerSource}
     * implementation for this Source type by calling `self.registerWorkerSource(workerSource: WorkerSource)`.
     */
    workerSourceURL?: URL;
};

export type SourceClass = Class<ISource> & SourceStatics;

const sourceTypes: Record<Source['type'], Class<ISource>> = {
    vector,
    raster,
    'raster-dem': rasterDem,
    'raster-array': rasterArray,
    geojson,
    video,
    image,
    model,
    'batched-model': tiled3DModel,
    canvas,
    custom
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
export const create = function(
    id: string,
    specification: SourceSpecification,
    dispatcher: Dispatcher,
    eventedParent: Evented,
): Source {
    const source = new sourceTypes[specification.type](id, specification, dispatcher, eventedParent);

    if (source.id !== id) {
        throw new Error(`Expected Source id to be ${id} instead of ${source.id}`);
    }

    bindAll(['load', 'abort', 'unload', 'serialize', 'prepare'], source);
    // @ts-expect-error - TS2322 - Type 'ISource' is not assignable to type 'Source'.
    return source;
};

export const getType = function(name: string): Class<ISource> {
    return sourceTypes[name];
};

export const setType = function (name: string, type: Class<ISource>) {
    sourceTypes[name] = type;
};

export interface Actor {
    send(type: string, data: any, callback: Callback<any>): void;
}
