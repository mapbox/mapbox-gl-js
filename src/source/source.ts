import {bindAll} from '../util/util';
import vector from '../source/vector_tile_source';
import raster from '../source/raster_tile_source';
import rasterDem from '../source/raster_dem_tile_source';
import geojson from '../source/geojson_source';
import video from '../source/video_source';
import image from '../source/image_source';
import canvas from '../source/canvas_source';
import custom from '../source/custom_source';

import type {CanonicalTileID, OverscaledTileID} from './tile_id';
import type Tile from './tile';
import type Dispatcher from '../util/dispatcher';
import type {Map} from '../ui/map';
import type {Class} from '../types/class';
import type {Source} from './source_types';
import type {Evented} from '../util/evented';
import type {Callback} from '../types/callback';
import type {MapEvents} from '../ui/events';
import type {SourceSpecification} from '../style-spec/types';
import type {CustomSourceInterface} from '../source/custom_source';
import type {CanvasSourceSpecification} from '../source/canvas_source';

export type {Source};

export type SourceEvents = Pick<MapEvents, 'data' | 'dataloading' | 'error'>;

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
    source?: string;
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
 * @param {string} options.type The source type.
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
export interface ISource<T = Source['type']> extends Evented<SourceEvents> {
    readonly type: T;
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
    minTileCacheSize?: number;
    maxTileCacheSize?: number;
    language?: string;
    worldview?: string;
    readonly usedInConflation?: boolean;
    vectorLayers?: Array<SourceVectorLayer>;
    vectorLayerIds?: Array<string>;
    rasterLayers?: Array<SourceRasterLayer>;
    rasterLayerIds?: Array<string>;
    readonly hasTransition: () => boolean;
    readonly loaded: () => boolean;
    readonly onAdd?: (map: Map) => void;
    readonly onRemove?: (map: Map) => void;
    readonly loadTile: (tile: Tile, callback: Callback<unknown>) => void;
    readonly hasTile?: (tileID: OverscaledTileID) => boolean;
    readonly abortTile?: (tile: Tile, callback?: Callback<unknown>) => void;
    readonly unloadTile?: (tile: Tile, callback?: Callback<unknown>) => void;
    readonly reload?: () => void;
    /**
     * @returns A plain (stringifiable) JS object representing the current state of the source.
     * Creating a source using the returned object as the `options` should result in a Source that is
     * equivalent to this one.
     * @private
     */
    readonly serialize: () => SourceSpecification | {type: 'custom', [key: string]: unknown};
    readonly prepare?: () => void;
    readonly afterUpdate?: () => void;
    readonly _clear?: () => void;
}

const sourceTypes: Partial<Record<Source['type'], Class<ISource>>> = {
    vector,
    raster,
    'raster-dem': rasterDem,
    geojson,
    video,
    image,
    canvas,
    custom
};

export type SourceType = Source['type'];

/*
 * Creates a tiled data source instance given an options object.
 *
 * @param id
 * @param {Object} source A source definition object compliant with
 * [`mapbox-gl-style-spec`](https://www.mapbox.com/mapbox-gl-style-spec/#sources).
 * @param {Dispatcher} dispatcher
 * @returns {Source}
 */
export const create = function (
    id: string,
    specification: SourceSpecification | CanvasSourceSpecification | CustomSourceInterface<unknown>,
    dispatcher: Dispatcher,
    eventedParent: Evented,
): Source {
    const SourceType = getType(specification.type);
    if (!SourceType) {
        throw new Error(`Unknown source type "${specification.type}"`);
    }

    const source = new SourceType(id, specification, dispatcher, eventedParent) as Source;

    if (source.id !== id) {
        throw new Error(`Expected Source id to be ${id} instead of ${source.id}`);
    }

    bindAll(['load', 'abort', 'unload', 'serialize', 'prepare'], source);
    return source;
};

export const getType = function (name: string): Class<ISource> | undefined {
    return Object.hasOwn(sourceTypes, name) ? sourceTypes[name as Source['type']] : undefined;
};

export const setType = function (name: string, type: Class<ISource>) {
    sourceTypes[name as Source['type']] = type;
};
