// @flow

import Tile from './tile.js';
import window from '../util/window.js';
import RasterTileSource from './raster_tile_source.js';
import {Source} from './source.js';
import {extend, pick} from '../util/util.js';
import {OverscaledTileID} from './tile_id.js';
import {Event, ErrorEvent, Evented} from '../util/evented.js';
import {cacheEntryPossiblyAdded} from '../util/tile_request_cache.js';

import type Map from '../ui/map.js';
import type {CanonicalTileID} from './tile_id.js';
import type Dispatcher from '../util/dispatcher.js';
import type {Callback} from '../types/callback.js';

type DataType = 'raster'; // vector | geojson

function isRaster(data: any): boolean {
    return data instanceof window.ImageBitmap || data instanceof window.HTMLCanvasElement;
}

/**
 * Interface for custom sources. This is a specification for
 * implementers to model: it is not an exported method or class.
 *
 * Custom sources allow a user to load and modify their own tiles.
 * These sources can be added between any regular sources using {@link Map#addSource}.
 *
 * Custom sources must have a unique `id` and must have the `type` of `"custom"`.
 * They must implement `loadTile` and may implement `unloadTile`, `abortTile`, `prepareTile`, `onAdd` and `onRemove`.
 * They can trigger rendering using {@link Map#triggerRepaint}.
 *
 * @interface CustomSourceInterface
 * @property {string} id A unique source id.
 * @property {string} type The source's type. Must be `"custom"`.
 * @example
 * // Custom source implemented as ES6 class
 * class CustomSource {
 *     constructor() {
 *         this.id = 'custom-source';
 *         this.type = 'custom';
 *         this.tileSize = 256;
 *         this.tilesUrl = 'https://stamen-tiles.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg';
 *         this.attribution = 'Map tiles by Stamen Design, under CC BY 3.0';
 *     }
 *
 *     async loadTile(tile, {signal}) {
 *         const url = this.tilesUrl
 *             .replace('{z}', String(tile.z))
 *             .replace('{x}', String(tile.x))
 *             .replace('{y}', String(tile.y));
 *
 *         const response = await fetch(url, {signal});
 *         const data = await response.arrayBuffer();
 *
 *         const blob = new window.Blob([new Uint8Array(data)], {type: 'image/png'});
 *         const imageBitmap = await window.createImageBitmap(blob);
 *
 *         return imageBitmap;
 *     }
 * }
 *
 * map.on('load', () => {
 *     map.addSource('custom-source', new CustomSource());
 *     map.addLayer({
 *         id: 'layer',
 *         type: 'raster',
 *         source: 'custom-source'
 *     });
 * });
 */

/**
 * Optional method called when the source has been added to the Map with {@link Map#addSource}.
 * This gives the source a chance to initialize resources and register event listeners.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name onAdd
 * @param {Map} map The Map this custom source was just added to.
 */

/**
 * Optional method called when the source has been removed from the Map with {@link Map#removeSource}.
 * This gives the source a chance to clean up resources and event listeners.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name onRemove
 * @param {Map} map The Map this custom source was added to.
 */

/**
 * Optional method called after the tile is unloaded from the map viewport. This
 * gives the source a chance to clean up resources and event listeners.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name unloadTile
 * @param {OverscaledTileID} tileID The key of the tile to unload.
 * @param {Function} callback A callback to be called when the tile is unloaded.
 */

/**
 * Optional method called if the map canceled request in loadTile. This
 * gives the source a chance to clean up resources and event listeners.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name abortTile
 * @param {OverscaledTileID} tileID The key of the tile to unload.
 * @param {Function} callback A callback to be called when the tile is aborted.
 */

/**
 * Optional method called during a render frame to allow a source to prepare and modify a tile texture if needed.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name prepareTile
 * @param {OverscaledTileID} tileID The key of the tile to prepare.
 * @returns {TextureImage} The tile image data as an `HTMLImageElement`, `ImageData`, `ImageBitmap` or object with `width`, `height`, and `data`.
 */

/**
 * Called when the map starts loading tile for the current animation frame.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name loadTile
 * @param {OverscaledTileID} tileID The key of the tile to prepare.
 * @param {Object} options Options.
 * @param {AbortSignal} options.signal A signal object that allows the map to cancel tile loading request.
 * @returns {Promise<TextureImage>} The tile image data as an `HTMLImageElement`, `ImageData`, `ImageBitmap` or object with `width`, `height`, and `data`.
 */
export type CustomSourceInterface<T> = {
    id: string;
    type: 'custom',
    dataType: ?DataType,
    minzoom: number,
    maxzoom: number,
    scheme: string;
    tileSize: number,
    attribution: ?string,
    loadTile: (tileID: CanonicalTileID, options: { signal: AbortSignal }) => Promise<T>,
    prepareTile: ?(tileID: CanonicalTileID) => ?T,
    unloadTile: ?(tileID: CanonicalTileID, callback: Callback<void>) => void,
    abortTile: ?(tileID: CanonicalTileID, callback: Callback<void>) => void,
    onAdd: ?(map: Map, callback: Callback<void>) => void,
    onRemove: ?(map: Map) => void,
}

class CustomSource<T> extends Evented implements Source {

    id: string;
    type: 'custom';
    scheme: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    attribution: string;
    roundZoom: boolean;

    minTileCacheSize: ?number;
    maxTileCacheSize: ?number;

    dataType: ?DataType;
    implementation: CustomSourceInterface<T>;

    map: Map;
    dispatcher: Dispatcher;
    _loaded: boolean;

    constructor(id: string, implementation: CustomSourceInterface<T>, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'custom';
        this.dataType = 'raster';
        this.dispatcher = dispatcher;
        this.setEventedParent(eventedParent);
        this.implementation = implementation;

        this.scheme = 'xyz';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;

        this._loaded = false;
        this.roundZoom = true;

        if (!implementation) {
            this.fire(new ErrorEvent(new Error(`Missing implementation for ${this.id} custom source`)));
        }

        // $FlowFixMe[prop-missing]
        implementation.update = this.update.bind(this);

        // $FlowFixMe[prop-missing]
        implementation.coveringTiles = this.coveringTiles.bind(this);

        extend(this, pick(implementation, ['dataType', 'scheme', 'minzoom', 'maxzoom', 'tileSize', 'attribution', 'minTileCacheSize', 'maxTileCacheSize']));
    }

    serialize(): Source {
        return pick(this, ['type', 'scheme', 'minzoom', 'maxzoom', 'tileSize', 'attribution']);
    }

    load() {
        this._loaded = true;
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
    }

    loaded(): boolean {
        return this._loaded;
    }

    onAdd(map: Map): void {
        this.map = map;
        if (this.implementation.onAdd) {
            this.implementation.onAdd(map, this.load);
        } else {
            this.load();
        }
    }

    onRemove(map: Map): void {
        if (this.implementation.onRemove) {
            this.implementation.onRemove(map);
        }
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const controller = new AbortController();
        const signal = controller.signal;

        // $FlowFixMe[prop-missing]
        tile.request = this.implementation.loadTile(tile.tileID.canonical, {signal})
            .then(tileLoaded.bind(this))
            .catch(error => {
                // silence AbortError and 404 errors
                if (error.code === 20 || error.code === 404) return;
                callback(error);
            });

        // $FlowFixMe[prop-missing]
        tile.request.cancel = () => controller.abort();

        function tileLoaded(data) {
            delete tile.request;

            if (tile.aborted) return callback(null);
            if (!data) return callback(null);
            if (!isRaster(data)) return callback(new Error(`Can't infer data type for ${this.id}, only raster data supported at the moment`));

            this.loadTileData(tile, data);
            tile.state = 'loaded';

            cacheEntryPossiblyAdded(this.dispatcher);
            callback(null);
        }
    }

    loadTileData(tile: Tile, data: T): void {
        RasterTileSource.loadTileData(tile, (data: any), this.map.painter);
    }

    unloadTileData(tile: Tile): void {
        RasterTileSource.unloadTileData(tile, this.map.painter);
    }

    prepareTile(tileID: OverscaledTileID): ?Tile {
        if (!this.implementation.prepareTile) return null;

        const data = this.implementation.prepareTile(tileID.canonical);
        if (!data) return null;

        const painter = this.map ? this.map.painter : null;
        const tile = new Tile(tileID, this.tileSize * tileID.overscaleFactor(), this.map.transform.tileZoom, painter, true);

        RasterTileSource.loadTileData(tile, (data: any), this.map.painter);
        tile.state = 'loaded';

        return tile;
    }

    unloadTile(tile: Tile, callback: Callback<void>): void {
        RasterTileSource.unloadTileData(tile, this.map.painter);

        if (this.implementation.unloadTile) {
            this.implementation.unloadTile(tile.tileID.canonical, callback);
        } else {
            callback();
        }
    }

    abortTile(tile: Tile, callback: Callback<void>): void {
        if (tile.request && tile.request.cancel) {
            tile.request.cancel();
            delete tile.request;
        }

        if (this.implementation.abortTile) {
            this.implementation.abortTile(tile.tileID.canonical, callback);
        } else {
            callback();
        }
    }

    hasTransition(): boolean {
        return false;
    }

    coveringTiles(): CanonicalTileID[] {
        const tileIDs = this.map.transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
        });

        return tileIDs.map(tileID => tileID.canonical);
    }

    update() {
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
    }
}

export default CustomSource;
