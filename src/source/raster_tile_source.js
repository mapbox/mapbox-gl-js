// @flow

import {extend, pick} from '../util/util.js';

import {getImage, ResourceType} from '../util/ajax.js';
import {Event, ErrorEvent, Evented} from '../util/evented.js';
import loadTileJSON from './load_tilejson.js';
import {postTurnstileEvent} from '../util/mapbox.js';
import TileBounds from './tile_bounds.js';
import browser from '../util/browser.js';

import {cacheEntryPossiblyAdded} from '../util/tile_request_cache.js';

import type {Source} from './source.js';
import type {OverscaledTileID} from './tile_id.js';
import type Map from '../ui/map.js';
import type Painter from '../render/painter.js';
import type Dispatcher from '../util/dispatcher.js';
import type Tile from './tile.js';
import type {Callback} from '../types/callback.js';
import type {Cancelable} from '../types/cancelable.js';
import type {TextureImage} from '../render/texture.js';
import type {
    RasterSourceSpecification,
    RasterDEMSourceSpecification
} from '../style-spec/types.js';

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
class RasterTileSource extends Evented implements Source {
    type: 'raster' | 'raster-dem';
    id: string;
    minzoom: number;
    maxzoom: number;
    url: string;
    scheme: string;
    tileSize: number;

    bounds: ?[number, number, number, number];
    tileBounds: TileBounds;
    roundZoom: boolean | void;
    dispatcher: Dispatcher;
    map: Map;
    tiles: Array<string>;

    _loaded: boolean;
    _options: RasterSourceSpecification | RasterDEMSourceSpecification;
    _tileJSONRequest: ?Cancelable;

    constructor(id: string, options: RasterSourceSpecification | RasterDEMSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
        this.setEventedParent(eventedParent);

        this.type = 'raster';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.roundZoom = true;
        this.scheme = 'xyz';
        this.tileSize = 512;
        this._loaded = false;

        this._options = extend({type: 'raster'}, options);
        extend(this, pick(options, ['url', 'scheme', 'tileSize']));
    }

    load(callback?: Callback<void>) {
        this._loaded = false;
        this.fire(new Event('dataloading', {dataType: 'source'}));
        this._tileJSONRequest = loadTileJSON(this._options, this.map._requestManager, null, null, (err, tileJSON) => {
            this._tileJSONRequest = null;
            this._loaded = true;
            if (err) {
                this.fire(new ErrorEvent(err));
            } else if (tileJSON) {
                extend(this, tileJSON);
                if (tileJSON.bounds) this.tileBounds = new TileBounds(tileJSON.bounds, this.minzoom, this.maxzoom);

                postTurnstileEvent(tileJSON.tiles);

                // `content` is included here to prevent a race condition where `Style#_updateSources` is called
                // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
                // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }

            if (callback) callback(err);
        });
    }

    loaded(): boolean {
        return this._loaded;
    }

    // $FlowFixMe[method-unbinding]
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
    // $FlowFixMe[method-unbinding]
    reload() {
        this.cancelTileJSONRequest();
        this.load(() => this.map.style._clearSource(this.id));
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

    // $FlowFixMe[method-unbinding]
    onRemove() {
        this.cancelTileJSONRequest();
    }

    serialize(): RasterSourceSpecification | RasterDEMSourceSpecification {
        return extend({}, this._options);
    }

    // $FlowFixMe[method-unbinding]
    hasTile(tileID: OverscaledTileID): boolean {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const use2x = browser.devicePixelRatio >= 2;
        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme), use2x, this.tileSize);
        tile.request = getImage(this.map._requestManager.transformRequest(url, ResourceType.Tile), (error, data, cacheControl, expires) => {
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

            if (this.map._refreshExpiredTiles) tile.setExpiryData({cacheControl, expires});
            tile.setTexture(data, this.map.painter);
            tile.state = 'loaded';

            cacheEntryPossiblyAdded(this.dispatcher);
            callback(null);
        });
    }

    static loadTileData(tile: Tile, data: TextureImage, painter: Painter) {
        tile.setTexture(data, painter);
    }

    static unloadTileData(tile: Tile, painter: Painter) {
        if (tile.texture) {
            painter.saveTileTexture(tile.texture);
        }
    }

    // $FlowFixMe[method-unbinding]
    abortTile(tile: Tile, callback: Callback<void>) {
        if (tile.request) {
            tile.request.cancel();
            delete tile.request;
        }
        callback();
    }

    // $FlowFixMe[method-unbinding]
    unloadTile(tile: Tile, callback: Callback<void>) {
        if (tile.texture) this.map.painter.saveTileTexture(tile.texture);
        callback();
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
