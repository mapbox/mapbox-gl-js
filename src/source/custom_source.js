// @flow

import Tile from './tile.js';
import window from '../util/window.js';
import TileBounds from './tile_bounds.js';
import RasterTileSource from './raster_tile_source.js';
import {extend, pick} from '../util/util.js';
import {Event, ErrorEvent, Evented} from '../util/evented.js';

import type Map from '../ui/map.js';
import type Dispatcher from '../util/dispatcher.js';
import type {Source} from './source.js';
import type {Callback} from '../types/callback.js';
import type {OverscaledTileID} from './tile_id.js';

type DataType = 'raster';

function isRaster(data: any): boolean {
    return data instanceof window.ImageData ||
        data instanceof window.ImageBitmap ||
        data instanceof window.HTMLCanvasElement;
}

/**
 * Interface for custom sources. This is a specification for
 * implementers to model: it is not an exported method or class.
 *
 * Custom sources allow a user to load and modify their own tiles.
 * These sources can be added between any regular sources using {@link Map#addSource}.
 *
 * Custom sources must have a unique `id` and must have the `type` of `"custom"`.
 * They must implement `loadTile` and may implement `unloadTile`, `prepareTile`, `onAdd` and `onRemove`.
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
 * @param {{ z: number, x: number, y: number }} tile Tile name to unload in the XYZ scheme format.
 */

/**
 * Optional method called during a render frame to check if there is a tile to render.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name hasTile
 * @param {{ z: number, x: number, y: number }} tile Tile name to prepare in the XYZ scheme format.
 * @returns {boolean} True if tile exists, otherwise false.
 */

/**
 * Optional method called during a render frame to allow a source to prepare and modify a tile texture if needed.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name prepareTile
 * @param {{ z: number, x: number, y: number }} tile Tile name to prepare in the XYZ scheme format.
 * @returns {TextureImage} The tile image data as an `HTMLImageElement`, `ImageData`, `ImageBitmap` or object with `width`, `height`, and `data`.
 */

/**
 * Called when the map starts loading tile for the current animation frame.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name loadTile
 * @param {{ z: number, x: number, y: number }} tile Tile name to load in the XYZ scheme format.
 * @param {Object} options Options.
 * @param {AbortSignal} options.signal A signal object that allows the map to cancel tile loading request.
 * @returns {Promise<TextureImage>} The tile image data as an `HTMLImageElement`, `ImageData`, `ImageBitmap` or object with `width`, `height`, and `data`.
 */
export type CustomSourceInterface<T> = {
    id: string;
    type: 'custom',
    dataType: ?DataType,
    minzoom: ?number,
    maxzoom: ?number,
    scheme: ?string;
    tileSize: ?number,
    attribution: ?string,
    bounds: ?[number, number, number, number];
    hasTile: ?(tileID: { z: number, x: number, y: number }) => boolean,
    loadTile: (tileID: { z: number, x: number, y: number }, options: { signal: AbortSignal }) => Promise<T>,
    prepareTile: ?(tileID: { z: number, x: number, y: number }) => ?T,
    unloadTile: ?(tileID: { z: number, x: number, y: number }) => void,
    onAdd: ?(map: Map) => void,
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
    tileBounds: ?TileBounds;
    minTileCacheSize: ?number;
    maxTileCacheSize: ?number;

    _map: Map;
    _loaded: boolean;
    _dispatcher: Dispatcher;
    _dataType: ?DataType;
    _implementation: CustomSourceInterface<T>;

    constructor(id: string, implementation: CustomSourceInterface<T>, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'custom';
        this._dataType = 'raster';
        this._dispatcher = dispatcher;
        this._implementation = implementation;
        this.setEventedParent(eventedParent);

        this.scheme = 'xyz';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;

        this._loaded = false;
        this.roundZoom = true;

        if (!this._implementation) {
            this.fire(new ErrorEvent(new Error(`Missing implementation for ${this.id} custom source`)));
        }

        if (!this._implementation.loadTile) {
            this.fire(new ErrorEvent(new Error(`Missing loadTile implementation for ${this.id} custom source`)));
        }

        if (this._implementation.bounds) {
            this.tileBounds = new TileBounds(this._implementation.bounds, this.minzoom, this.maxzoom);
        }

        // $FlowFixMe[prop-missing]
        implementation.update = this._update.bind(this);

        // $FlowFixMe[prop-missing]
        implementation.coveringTiles = this._coveringTiles.bind(this);

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
        this._map = map;
        this._loaded = false;
        this.fire(new Event('dataloading', {dataType: 'source'}));
        if (this._implementation.onAdd) this._implementation.onAdd(map);
        this.load();
    }

    onRemove(map: Map): void {
        if (this._implementation.onRemove) {
            this._implementation.onRemove(map);
        }
    }

    hasTile(tileID: OverscaledTileID): boolean {
        if (this._implementation.hasTile) {
            const {x, y, z} = tileID.canonical;
            return this._implementation.hasTile({x, y, z});
        }

        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    loadTile(tile: Tile, callback: Callback<void>): void {
        const {x, y, z} = tile.tileID.canonical;
        const controller = new window.AbortController();
        const signal = controller.signal;

        const request = this._implementation.loadTile({x, y, z}, {signal});
        if (!request) {
            // Create an empty image and set the tile state to `loaded`
            // if the implementation didn't return the async tile request
            const emptyImage = {width: this.tileSize, height: this.tileSize, data: null};
            this.loadTileData(tile, (emptyImage: any));
            tile.state = 'loaded';
            return callback(null);
        }

        // $FlowFixMe[prop-missing]
        request.cancel = () => controller.abort();

        // $FlowFixMe[prop-missing]
        tile.request = request.then(tileLoaded.bind(this))
            .catch(error => {
                // silence AbortError
                if (error.code === 20) return;
                tile.state = 'errored';
                callback(error);
            });

        function tileLoaded(data) {
            delete tile.request;

            if (tile.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }

            if (!data) {
                // Create an empty image and set the tile state to `loaded`
                // if the implementation returned no tile data
                const emptyImage = {width: this.tileSize, height: this.tileSize, data: null};
                this.loadTileData(tile, (emptyImage: any));
                tile.state = 'loaded';
                return callback(null);
            }

            if (!isRaster(data)) {
                tile.state = 'errored';
                return callback(new Error(`Can't infer data type for ${this.id}, only raster data supported at the moment`));
            }

            this.loadTileData(tile, data);
            tile.state = 'loaded';
            callback(null);
        }
    }

    loadTileData(tile: Tile, data: T): void {
        // Only raster data supported at the moment
        RasterTileSource.loadTileData(tile, (data: any), this._map.painter);
    }

    unloadTileData(tile: Tile): void {
        // Only raster data supported at the moment
        RasterTileSource.unloadTileData(tile, this._map.painter);
    }

    prepareTile(tile: Tile): ?T {
        if (!this._implementation.prepareTile) return null;

        const {x, y, z} = tile.tileID.canonical;
        const data = this._implementation.prepareTile({x, y, z});
        if (!data) return null;

        this.loadTileData(tile, data);
        tile.state = 'loaded';
        return data;
    }

    unloadTile(tile: Tile, callback: Callback<void>): void {
        this.unloadTileData(tile);
        if (this._implementation.unloadTile) {
            const {x, y, z} = tile.tileID.canonical;
            this._implementation.unloadTile({x, y, z});
        }

        callback();
    }

    abortTile(tile: Tile, callback: Callback<void>): void {
        if (tile.request && tile.request.cancel) {
            tile.request.cancel();
            delete tile.request;
        }

        callback();
    }

    hasTransition(): boolean {
        return false;
    }

    _coveringTiles(): { z: number, x: number, y: number }[] {
        const tileIDs = this._map.transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            roundZoom: this.roundZoom
        });

        return tileIDs.map(tileID => ({x: tileID.canonical.x, y: tileID.canonical.y, z: tileID.canonical.z}));
    }

    _update() {
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
    }
}

export default CustomSource;
