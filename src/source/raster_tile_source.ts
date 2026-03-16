import {getExpiryDataFromHeaders, pick} from '../util/util';
import {getImage, ResourceType} from '../util/ajax';
import {Event, ErrorEvent, Evented} from '../util/evented';
import loadTileJSON from './load_tilejson';
import {postTurnstileEvent} from '../util/mapbox';
import TileBounds from './tile_bounds';
import browser from '../util/browser';
import {cacheEntryPossiblyAdded} from '../util/tile_request_cache';
import {makeFQID} from '../util/fqid';
import Texture from '../render/texture';

import type {ISource, SourceEvents, SourceRasterLayer} from './source';
import type {OverscaledTileID} from './tile_id';
import type {Map} from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';
import type {
    RasterSourceSpecification,
    RasterDEMSourceSpecification,
    RasterArraySourceSpecification
} from '../style-spec/types';

/**
 * A source containing raster tiles.
 * See the [Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#raster) for detailed documentation of options.
 *
 * @example
 * map.addSource('some id', {
 *     type: 'raster',
 *     url: 'mapbox://mapbox.satellite',
 *     tileSize: 256
 * });
 *
 * @example
 * map.addSource('some id', {
 *     type: 'raster',
 *     tiles: ['https://img.nj.gov/imagerywms/Natural2015?bbox={bbox-epsg-3857}&format=image/png&service=WMS&version=1.1.1&request=GetMap&srs=EPSG:3857&transparent=true&width=256&height=256&layers=Natural2015'],
 *     tileSize: 256
 * });
 *
 * @see [Example: Add a raster tile source](https://docs.mapbox.com/mapbox-gl-js/example/map-tiles/)
 * @see [Example: Add a WMS source](https://docs.mapbox.com/mapbox-gl-js/example/wms/)
 */
class RasterTileSource<T = 'raster'> extends Evented<SourceEvents> implements ISource<T> {
    type: T;
    id: string;
    scope: string;
    minzoom: number;
    maxzoom: number;
    url: string;
    scheme: string;
    attribution: string | undefined;
    // eslint-disable-next-line camelcase
    mapbox_logo: boolean | undefined;
    tileSize: number;
    minTileCacheSize?: number;
    maxTileCacheSize?: number;
    vectorLayers?: never;
    vectorLayerIds?: never;
    rasterLayers?: Array<SourceRasterLayer>;
    rasterLayerIds?: Array<string>;

    bounds: [number, number, number, number] | null | undefined;
    tileBounds?: TileBounds;
    roundZoom: boolean | undefined;
    reparseOverscaled: boolean | undefined;
    dispatcher: Dispatcher;
    map: Map;
    tiles: Array<string>;

    _loaded: boolean;
    _options: RasterSourceSpecification | RasterDEMSourceSpecification | RasterArraySourceSpecification;
    _tileJSONRequest: Cancelable | null | undefined;

    prepare: undefined;
    afterUpdate: undefined;
    _clear: undefined;

    /**
     * Constructs a new RasterTileSource.
     *
     * @param id The unique source ID.
     * @param options The RasterSourceSpecification or compatible options object.
     * @param dispatcher Dispatcher for worker communication.
     * @param eventedParent Parent Evented object to bubble events.
     */
    constructor(id: string, options: RasterSourceSpecification | RasterDEMSourceSpecification | RasterArraySourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
        this.setEventedParent(eventedParent);

        this.type = 'raster' as T;
        this.minzoom = 0;
        this.maxzoom = 22;
        this.roundZoom = true;
        this.scheme = 'xyz';
        this.tileSize = 512;
        this._loaded = false;

        this._options = Object.assign({type: 'raster'}, options);
        Object.assign(this, pick(options, ['url', 'scheme', 'tileSize']));
    }

    /**
     * Loads the TileJSON for this source.
     *
     * @param callback Optional callback invoked once the source is loaded or an error occurs.
     */
    load(callback?: Callback<undefined>) {
        this._loaded = false;
        this.fire(new Event('dataloading', {dataType: 'source'}));

        const worldview = this.map.getWorldview();
        this._tileJSONRequest = loadTileJSON(this._options, this.map._requestManager, null, worldview, (err, tileJSON) => {
            this._tileJSONRequest = null;
            this._loaded = true;

            if (err) {
                this.fire(new ErrorEvent(err));
            } else if (tileJSON) {
                Object.assign(this, tileJSON);

                if (tileJSON.raster_layers) {
                    this.rasterLayers = tileJSON.raster_layers;
                    this.rasterLayerIds = this.rasterLayers.map(layer => layer.id);
                }

                // Compute tile bounds to check if tiles exist for requested coordinates
                this.tileBounds = TileBounds.fromTileJSON(tileJSON);

                // Send analytics event for TileJSON usage
                postTurnstileEvent(tileJSON.tiles);

                // Fire metadata and content events to ensure map updates correctly
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }

            if (callback) callback(err);
        });
    }

    /** Returns true if the TileJSON has been loaded. */
    loaded(): boolean {
        return this._loaded;
    }

    /** Called when the source is added to the map. */
    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    /**
     * Reloads the source data and triggers a map re-render.
     */
    reload() {
        this.cancelTileJSONRequest();
        const fqid = makeFQID(this.id, this.scope);
        this.load(() => this.map.style.clearSource(fqid));
    }

    /**
     * Sets the `tiles` property and reloads the source.
     */
    setTiles(tiles: Array<string>): this {
        this._options.tiles = tiles;
        this.reload();

        return this;
    }

    /**
     * Sets the `url` property and reloads the source.
     */
    setUrl(url: string): this {
        this.url = url;
        this._options.url = url;
        this.reload();

        return this;
    }

    /** Called when the source is removed from the map. Cancels any pending TileJSON request. */
    onRemove(_: Map) {
        this.cancelTileJSONRequest();
    }

    /** Returns a serializable representation of the source options. */
    serialize(): RasterSourceSpecification | RasterDEMSourceSpecification | RasterArraySourceSpecification {
        return Object.assign({}, this._options);
    }

    /** Returns true if the given tileID is within this source's bounds. */
    hasTile(tileID: OverscaledTileID): boolean {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    /**
     * Loads a raster tile image, sets it as the tile texture, and updates tile state.
     */
    loadTile(tile: Tile, callback: Callback<undefined>) {
        const use2x = browser.devicePixelRatio >= 2;
        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme), use2x, this.tileSize);

        tile.request = getImage(this.map._requestManager.transformRequest(url, ResourceType.Tile), (error, data, responseHeaders) => {
            delete tile.request;

            if (tile.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }

            if (error) {
                tile.state = 'errored';
                return callback(error);
            }

            if (!data) return callback(null);

            const expiryData = getExpiryDataFromHeaders(responseHeaders);
            if (this.map._refreshExpiredTiles) tile.setExpiryData(expiryData);

            // Set the loaded image as the tile's texture
            tile.setTexture(data, this.map.painter);
            tile.state = 'loaded';

            cacheEntryPossiblyAdded(this.dispatcher);
            callback(null);
        });
    }

    /** Aborts a tile request if it's in progress. */
    abortTile(tile: Tile, callback?: Callback<undefined>) {
        if (tile.request) {
            tile.request.cancel();
            delete tile.request;
        }
        if (callback) callback();
    }

    /**
     * Unloads a tile from memory.
     * Preserves the texture in the cache if possible to reduce memory allocations.
     */
    unloadTile(tile: Tile, callback?: Callback<undefined>) {
        if (tile.texture && tile.texture instanceof Texture) {
            tile.destroy(false);
            if (tile.texture && tile.texture instanceof Texture) {
                this.map.painter.saveTileTexture(tile.texture);
            }
        } else {
            tile.destroy();
        }

        if (callback) callback();
    }

    /** Raster sources do not have transitions, so always returns false. */
    hasTransition(): boolean {
        return false;
    }

    /** Cancels any pending TileJSON request. */
    cancelTileJSONRequest() {
        if (!this._tileJSONRequest) return;
        this._tileJSONRequest.cancel();
        this._tileJSONRequest = null;
    }
}

export default RasterTileSource;
