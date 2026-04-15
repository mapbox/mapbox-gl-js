import {getExpiryDataFromHeaders, pick} from '../util/util';
import {getImage, ResourceType} from '../util/ajax';
import {Event, ErrorEvent, Evented} from '../util/evented';
import loadTileJSON, {parseTileJSONRequest} from './load_tilejson';
import {postTurnstileEvent} from '../util/mapbox';
import TileBounds from './tile_bounds';
import browser from '../util/browser';
import {cacheEntryPossiblyAdded} from '../util/tile_request_cache';
import {makeFQID} from '../util/fqid';
import Texture from '../render/texture';
import {resolveTileProvider, loadTileProvider, processTileJSON} from './tile_provider';

import type {TileProvider} from './tile_provider';
import type {ISource, SourceEvents, SourceRasterLayer} from './source';
import type {OverscaledTileID} from './tile_id';
import type {Map} from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';
import type {TileJSON} from '../types/tilejson';
import type {RequestParameters} from '../util/ajax';
import type {
    RasterSourceSpecification,
    RasterDEMSourceSpecification,
    RasterArraySourceSpecification,
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
    provider?: string;
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
    _options: (RasterSourceSpecification | RasterDEMSourceSpecification | RasterArraySourceSpecification) & {provider?: string | false};
    _tileJSONRequest: Cancelable | null | undefined;
    _tileProvider?: TileProvider<ArrayBuffer>;

    prepare: undefined;
    afterUpdate: undefined;
    _clear: undefined;

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

    load(callback?: Callback<undefined>) {
        this._loaded = false;
        this.fire(new Event('dataloading', {dataType: 'source'}));
        const worldview = this.map.getWorldview();

        const done = (err?: Error | null, tileJSON?: TileJSON | null) => {
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

                this.tileBounds = TileBounds.fromTileJSON(tileJSON);
                postTurnstileEvent(tileJSON.tiles);

                // `content` is included here to prevent a race condition where `Style#updateSources` is called
                // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
                // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }

            if (callback) callback(err);
        };

        this.provider = typeof this._options.provider === 'string' ? this._options.provider : undefined;
        this._tileProvider = undefined;
        const tileProvider = resolveTileProvider(this._options);

        if (tileProvider instanceof Error) {
            this._loaded = true;
            this.fire(new ErrorEvent(tileProvider));
            if (callback) callback();
            return;
        }

        if (this.provider && !tileProvider) {
            this._loaded = true;
            this.fire(new ErrorEvent(new Error(`TileProvider "${this.provider}" is not registered`)));
            if (callback) callback();
            return;
        }

        if (tileProvider) {
            this._tileJSONRequest = this.loadTileJSONWithProvider(tileProvider, done);
            return;
        }

        this._tileJSONRequest = loadTileJSON(this._options, this.map._requestManager, null, worldview, done);
    }

    loadTileJSONWithProvider(tileProvider: {name: string; url: string}, callback: Callback<TileJSON>): Cancelable {
        this.provider = tileProvider.name;
        const {request, options} = parseTileJSONRequest(this._options, this.map._requestManager);

        const controller = new AbortController();
        loadTileProvider(tileProvider.name, tileProvider.url)
            .then((ProviderClass) => {
                if (controller.signal.aborted) return;
                const provider = new ProviderClass(options);
                if (provider.load && request) {
                    return provider.load({request}).then(tileJSON => {
                        this._tileProvider = provider;
                        return tileJSON;
                    });
                }
                this._tileProvider = provider;
                return null;
            })
            .then((tileJSON) => {
                if (controller.signal.aborted) return;
                const result = processTileJSON(this._options, tileJSON, this.map._requestManager);
                if (result instanceof Error) {
                    callback(result);
                } else {
                    callback(null, result);
                }
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                callback(err instanceof Error ? err : new Error(String(err)));
            });

        return {cancel: () => controller.abort()};
    }

    loaded(): boolean {
        return this._loaded;
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    /**
     * Reloads the source data and re-renders the map.
     *
     * @example
     * map.getSource('source-id').reload();
     */
    reload() {
        this.cancelTileJSONRequest();
        const fqid = makeFQID(this.id, this.scope);
        this.load(() => this.map.style.clearSource(fqid));
    }

    /**
     * Sets the source `tiles` property and re-renders the map.
     *
     * @param {string[]} tiles An array of one or more tile source URLs, as in the TileJSON spec.
     * @returns {RasterTileSource} Returns itself to allow for method chaining.
     * @example
     * map.addSource('source-id', {
     *     type: 'raster',
     *     tiles: ['https://some_end_point.net/{z}/{x}/{y}.png'],
     *     tileSize: 256
     * });
     *
     * // Set the endpoint associated with a raster tile source.
     * map.getSource('source-id').setTiles(['https://another_end_point.net/{z}/{x}/{y}.png']);
     */
    setTiles(tiles: Array<string>): this {
        this._options.tiles = tiles;
        this.reload();

        return this;
    }

    /**
     * Sets the source `url` property and re-renders the map.
     *
     * @param {string} url A URL to a TileJSON resource. Supported protocols are `http:`, `https:`, and `mapbox://<Tileset ID>`.
     * @returns {RasterTileSource} Returns itself to allow for method chaining.
     * @example
     * map.addSource('source-id', {
     *     type: 'raster',
     *     url: 'mapbox://mapbox.satellite'
     * });
     *
     * // Update raster tile source to a new URL endpoint
     * map.getSource('source-id').setUrl('mapbox://mapbox.satellite');
     */
    setUrl(url: string): this {
        this.url = url;
        this._options.url = url;
        this.reload();

        return this;
    }

    onRemove(_: Map) {
        this.cancelTileJSONRequest();
    }

    serialize(): RasterSourceSpecification | RasterDEMSourceSpecification | RasterArraySourceSpecification {
        return Object.assign({}, this._options);
    }

    hasTile(tileID: OverscaledTileID): boolean {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    loadTile(tile: Tile, callback: Callback<undefined>) {
        const use2x = browser.devicePixelRatio >= 2;
        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme), use2x, this.tileSize);
        const request = this.map._requestManager.transformRequest(url, ResourceType.Tile);

        if (this._tileProvider) {
            const controller = new AbortController();
            tile.request = {cancel: () => controller.abort()};
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.loadTileWithProvider(tile, this._tileProvider, request, controller, callback);
        } else {
            tile.request = getImage(request, (error, data, responseHeaders) => {
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
                tile.setTexture(data, this.map.painter);
                tile.state = 'loaded';

                cacheEntryPossiblyAdded(this.dispatcher);
                callback(null);
            });
        }
    }

    async loadTileWithProvider(tile: Tile, provider: TileProvider<ArrayBuffer>, request: RequestParameters, controller: AbortController, callback: Callback<undefined>) {
        const {z, x, y} = tile.tileID.canonical;
        try {
            const response = await provider.loadTile({z, x, y}, {request, signal: controller.signal});

            if (controller.signal.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }

            if (response == null) {
                const err: Error & {status?: number} = new Error('Tile not found');
                err.status = 404;
                tile.state = 'errored';
                return callback(err);
            }

            if (response.data == null) {
                tile.state = 'loaded';
                return callback(null);
            }

            const imageBitmap = await createImageBitmap(new Blob([response.data]));

            if (controller.signal.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }

            tile.setTexture(imageBitmap, this.map.painter);
            tile.state = 'loaded';

            if (this.map._refreshExpiredTiles) {
                tile.setExpiryData({
                    cacheControl: response.cacheControl,
                    expires: response.expires,
                });
            }

            // Tiles provider bypasses mapbox-tiles CacheStorage because
            // it's not yet integrated with the cache management.
            callback(null);
        } catch (err) {
            if (controller.signal.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }
            if (err instanceof DOMException && err.name === 'AbortError') {
                tile.state = 'unloaded';
                return callback(null);
            }
            tile.state = 'errored';
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            callback(err instanceof Error ? err : new Error(String(err)));
        } finally {
            delete tile.request;
        }
    }

    abortTile(tile: Tile, callback?: Callback<undefined>) {
        if (tile.request) {
            tile.request.cancel();
            delete tile.request;
        }
        if (callback) callback();
    }

    unloadTile(tile: Tile, callback?: Callback<undefined>) {
        // Cache the tile texture to avoid re-allocating Textures if they'll just be reloaded
        if (tile.texture && tile.texture instanceof Texture) {
            // Clean everything else up owned by the tile, but preserve the texture.
            // Destroy first to prevent racing with the texture cache being popped.
            tile.destroy(false);

            // Save the texture to the cache
            if (tile.texture && tile.texture instanceof Texture) {
                this.map.painter.saveTileTexture(tile.texture);
            }
        } else {
            tile.destroy();
        }

        if (callback) callback();
    }

    hasTransition(): boolean {
        return false;
    }

    cancelTileJSONRequest() {
        if (!this._tileJSONRequest) return;
        this._tileJSONRequest.cancel();
        this._tileJSONRequest = null;
    }
}

export default RasterTileSource;
