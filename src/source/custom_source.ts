import Texture from '../render/texture';
import TileBounds from './tile_bounds';
import {extend, pick} from '../util/util';
import {Event, ErrorEvent, Evented} from '../util/evented';
import {makeFQID} from '../util/fqid';

import type Tile from './tile';
import type {Map} from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type {Callback} from '../types/callback';
import type {OverscaledTileID} from './tile_id';
import type {ISource, SourceEvents} from './source';
import type {AJAXError} from '../util/ajax';
import type {TextureImage} from '../render/texture';

type DataType = 'raster';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRaster(data: any): boolean {
    return data instanceof ImageData ||
        data instanceof HTMLCanvasElement ||
        data instanceof ImageBitmap ||
        data instanceof HTMLImageElement;
}

/**
 * Interface for custom sources. This is a specification for
 * implementers to model: it is not an exported method or class.
 *
 * Custom sources allow a user to load and modify their own tiles.
 * These sources can be added between any regular sources using {@link Map#addSource}.
 *
 * Custom sources must have a unique `id` and must have the `type` of `"custom"`.
 * They must implement `loadTile` and may implement `unloadTile`, `onAdd` and `onRemove`.
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
 * Called when the map starts loading tile for the current animation frame.
 *
 * @function
 * @memberof CustomSourceInterface
 * @instance
 * @name loadTile
 * @param {{ z: number, x: number, y: number }} tile Tile name to load in the XYZ scheme format.
 * @param {Object} options Options.
 * @param {AbortSignal} options.signal A signal object that communicates when the map cancels the tile loading request.
 * @returns {Promise<TextureImage | undefined | null>} The promise that resolves to the tile image data as an `HTMLCanvasElement`, `HTMLImageElement`, `ImageData`, `ImageBitmap` or object with `width`, `height`, and `data`.
 * If `loadTile` resolves to `undefined`, a map will render an overscaled parent tile in the tile’s space. If `loadTile` resolves to `null`, a map will render nothing in the tile’s space.
 */
export interface CustomSourceInterface<T> {
    id: string;
    type: 'custom';
    dataType?: DataType | null;
    minzoom?: number | null;
    maxzoom?: number | null;
    scheme?: string | null;
    tileSize?: number | null;
    minTileCacheSize?: number;
    maxTileCacheSize?: number;
    attribution?: string | null;
    mapbox_logo?: boolean;
    bounds?: [number, number, number, number] | null;
    hasTile?: (tileID: {z: number; x: number; y: number}) => boolean | null;
    loadTile: (tileID: {z: number; x: number; y: number}, options: {signal: AbortSignal}) => Promise<T | null | undefined>;
    unloadTile?: (tileID: {z: number; x: number; y: number}) => void | null;
    onAdd?: (map: Map) => void | null;
    onRemove?: (map: Map) => void | null;
}

class CustomSource<T> extends Evented<SourceEvents> implements ISource {
    id: string;
    scope: string;
    type: 'custom';
    scheme: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    attribution: string | undefined;
    // eslint-disable-next-line camelcase
    mapbox_logo: boolean | undefined;
    vectorLayers?: never;
    vectorLayerIds?: never;
    rasterLayers?: never;
    rasterLayerIds?: never;

    roundZoom: boolean | undefined;
    tileBounds: TileBounds | null | undefined;
    minTileCacheSize?: number;
    maxTileCacheSize?: number;
    reparseOverscaled: boolean | undefined;

    map: Map;
    _loaded: boolean;
    _dispatcher: Dispatcher;
    _dataType: DataType | null | undefined;
    _implementation: CustomSourceInterface<T>;

    reload: undefined;
    prepare: undefined;
    afterUpdate: undefined;
    _clear: undefined;

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

        // @ts-expect-error - TS2339 - Property 'update' does not exist on type 'CustomSourceInterface<T>'.
        implementation.update = this._update.bind(this);

        // @ts-expect-error - TS2339 - Property 'clearTiles' does not exist on type 'CustomSourceInterface<T>'.
        implementation.clearTiles = this._clearTiles.bind(this);

        // @ts-expect-error - TS2339 - Property 'coveringTiles' does not exist on type 'CustomSourceInterface<T>'.
        implementation.coveringTiles = this._coveringTiles.bind(this);

        extend(this, pick(implementation, ['dataType', 'scheme', 'minzoom', 'maxzoom', 'tileSize', 'attribution', 'minTileCacheSize', 'maxTileCacheSize']));
    }

    serialize() {
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

    loadTile(tile: Tile, callback: Callback<undefined>): void {
        const {x, y, z} = tile.tileID.canonical;
        const controller = new AbortController();
        const signal = controller.signal;

        // @ts-expect-error - TS2741 - Property 'cancel' is missing in type 'Promise<void | Awaited<T>>' but required in type 'Cancelable'.
        tile.request = Promise
            .resolve(this._implementation.loadTile({x, y, z}, {signal}))
            .then(tileLoaded.bind(this))
            .catch((error?: Error | DOMException | AJAXError) => {
                // silence AbortError
                if (error.name === 'AbortError') return;
                tile.state = 'errored';
                callback(error);
            });

        tile.request.cancel = () => controller.abort();

        function tileLoaded(data?: T | null) {
            delete tile.request;

            if (tile.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }

            // If the implementation returned `undefined` as tile data,
            // mark the tile as `errored` to indicate that we have no data for it.
            // A map will render an overscaled parent tile in the tile’s space.
            if (data === undefined) {
                tile.state = 'errored';
                return callback(null);
            }

            // If the implementation returned `null` as tile data,
            // mark the tile as `loaded` and use an an empty image as tile data.
            // A map will render nothing in the tile’s space.
            if (data === null) {
                const emptyImage = {width: this.tileSize, height: this.tileSize, data: null};
                this.loadTileData(tile, emptyImage);
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
        tile.setTexture(data as TextureImage, this.map.painter);
    }

    unloadTile(tile: Tile, callback?: Callback<undefined>): void {
        // Only raster data supported at the moment
        // Cache the tile texture to avoid re-allocating Textures if they'll just be reloaded
        if (tile.texture && tile.texture instanceof Texture) {
            // Clean everything else up owned by the tile, but preserve the texture.
            // Destroy first to prevent racing with the texture cache being popped.
            tile.destroy(true);

            // Save the texture to the cache
            if (tile.texture && tile.texture instanceof Texture) {
                this.map.painter.saveTileTexture(tile.texture);
            }
        } else {
            tile.destroy();
        }

        if (this._implementation.unloadTile) {
            const {x, y, z} = tile.tileID.canonical;
            this._implementation.unloadTile({x, y, z});
        }

        if (callback) callback();
    }

    abortTile(tile: Tile, callback?: Callback<undefined>): void {
        if (tile.request && tile.request.cancel) {
            tile.request.cancel();
            delete tile.request;
        }

        if (callback) callback();
    }

    hasTransition(): boolean {
        return false;
    }

    _coveringTiles(): {
        z: number;
        x: number;
        y: number;
    }[] {
        const tileIDs = this.map.transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            roundZoom: this.roundZoom
        });

        return tileIDs.map(tileID => ({x: tileID.canonical.x, y: tileID.canonical.y, z: tileID.canonical.z}));
    }

    _clearTiles() {
        const fqid = makeFQID(this.id, this.scope);
        this.map.style.clearSource(fqid);
    }

    _update() {
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
    }
}

export default CustomSource;
