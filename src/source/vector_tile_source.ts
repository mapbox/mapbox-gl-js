import {Event, ErrorEvent, Evented} from '../util/evented';
import {extend, pick} from '../util/util';
import loadTileJSON from './load_tilejson';
import {postTurnstileEvent} from '../util/mapbox';
import TileBounds from './tile_bounds';
import {ResourceType} from '../util/ajax';
import browser from '../util/browser';
import {cacheEntryPossiblyAdded} from '../util/tile_request_cache';
import {DedupedRequest, loadVectorTile} from './load_vector_tile';
import {makeFQID} from '../util/fqid';
import {isMapboxURL} from '../util/mapbox_url';

import type {ISource, SourceEvents, SourceVectorLayer} from './source';
import type {OverscaledTileID} from './tile_id';
import type {Map} from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';
import type {VectorSourceSpecification, PromoteIdSpecification} from '../style-spec/types';
import type Actor from '../util/actor';
import type {LoadVectorTileResult} from './load_vector_tile';
import type {WorkerSourceVectorTileRequest, WorkerSourceVectorTileResult} from './worker_source';
import type {AJAXError} from '../util/ajax';

/**
 * A source containing vector tiles in [Mapbox Vector Tile format](https://docs.mapbox.com/vector-tiles/reference/).
 * See the [Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#vector) for detailed documentation of options.
 *
 * @example
 * map.addSource('some id', {
 *     type: 'vector',
 *     url: 'mapbox://mapbox.mapbox-streets-v8'
 * });
 *
 * @example
 * map.addSource('some id', {
 *     type: 'vector',
 *     tiles: ['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt'],
 *     minzoom: 6,
 *     maxzoom: 14
 * });
 *
 * @example
 * map.getSource('some id').setUrl("mapbox://mapbox.mapbox-streets-v8");
 *
 * @example
 * map.getSource('some id').setTiles(['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt']);
 * @see [Example: Add a vector tile source](https://docs.mapbox.com/mapbox-gl-js/example/vector-source/)
 * @see [Example: Add a third party vector tile source](https://docs.mapbox.com/mapbox-gl-js/example/third-party/)
 */
class VectorTileSource extends Evented<SourceEvents> implements ISource<'vector'> {
    type: 'vector';
    id: string;
    scope: string;
    minzoom: number;
    maxzoom: number;
    url: string;
    scheme: string;
    tileSize: number;
    minTileCacheSize?: number;
    maxTileCacheSize?: number;
    roundZoom?: boolean;
    attribution?: string;
    // eslint-disable-next-line camelcase
    mapbox_logo?: boolean;
    promoteId?: PromoteIdSpecification | null;

    _options: VectorSourceSpecification;
    _collectResourceTiming: boolean;
    dispatcher: Dispatcher;
    map: Map;
    bounds?: [number, number, number, number] | null;
    tiles: Array<string>;
    tileBounds?: TileBounds;
    reparseOverscaled?: boolean;
    isTileClipped?: boolean;
    _tileJSONRequest?: Cancelable | null;
    _loaded: boolean;
    _tileWorkers: Record<string, Actor>;
    _deduped: DedupedRequest;
    vectorLayers?: Array<SourceVectorLayer>;
    vectorLayerIds?: Array<string>;
    rasterLayers?: never;
    rasterLayerIds?: never;
    hasWorldviews?: boolean;
    worldviewDefault?: string;
    localizableLayerIds?: Set<string>;

    prepare: undefined;
    _clear: undefined;

    constructor(id: string, options: VectorSourceSpecification & {collectResourceTiming: boolean}, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;

        this.type = 'vector';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.scheme = 'xyz';
        this.tileSize = 512;
        this.reparseOverscaled = true;
        this.isTileClipped = true;
        this._loaded = false;

        extend(this, pick(options, ['url', 'scheme', 'tileSize', 'promoteId']));
        this._options = extend({type: 'vector'}, options);

        this._collectResourceTiming = !!options.collectResourceTiming;

        if (this.tileSize !== 512) {
            throw new Error('vector tile sources must have a tileSize of 512');
        }

        this.setEventedParent(eventedParent);

        this._tileWorkers = {};
        this._deduped = new DedupedRequest();
    }

    load(callback?: Callback<undefined>) {
        this._loaded = false;
        this.fire(new Event('dataloading', {dataType: 'source'}));
        const language = Array.isArray(this.map._language) ? this.map._language.join() : this.map._language;
        const worldview = this.map.getWorldview();
        this._tileJSONRequest = loadTileJSON(this._options, this.map._requestManager, language, worldview, (err, tileJSON) => {
            this._tileJSONRequest = null;
            this._loaded = true;
            if (err) {
                if (language) console.warn(`Ensure that your requested language string is a valid BCP-47 code or list of codes. Found: ${language}`);
                if (worldview) console.warn(`Requested worldview strings must be a valid ISO alpha-2 code. Found: ${worldview}`);

                this.fire(new ErrorEvent(err));
            } else if (tileJSON) {
                extend(this, tileJSON);

                this.hasWorldviews = !!tileJSON.worldview_options;
                if (tileJSON.worldview_default) {
                    this.worldviewDefault = tileJSON.worldview_default;
                }

                if (tileJSON.vector_layers) {
                    this.vectorLayers = tileJSON.vector_layers;
                    this.vectorLayerIds = [];
                    this.localizableLayerIds = new Set();
                    for (const layer of tileJSON.vector_layers) {
                        this.vectorLayerIds.push(layer.id);
                        // Check if the layer source is localizable
                        if (tileJSON.worldview && tileJSON.worldview[layer.source]) {
                            this.localizableLayerIds.add(layer.id);
                        }
                    }
                }

                this.tileBounds = TileBounds.fromTileJSON(tileJSON);
                postTurnstileEvent(tileJSON.tiles, this.map._requestManager._customAccessToken);

                // `content` is included here to prevent a race condition where `Style#updateSources` is called
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

    hasTile(tileID: OverscaledTileID): boolean {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
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
     * @returns {VectorTileSource} Returns itself to allow for method chaining.
     * @example
     * map.addSource('source-id', {
     *     type: 'vector',
     *     tiles: ['https://some_end_point.net/{z}/{x}/{y}.mvt'],
     *     minzoom: 6,
     *     maxzoom: 14
     * });
     *
     * // Set the endpoint associated with a vector tile source.
     * map.getSource('source-id').setTiles(['https://another_end_point.net/{z}/{x}/{y}.mvt']);
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
     * @returns {VectorTileSource} Returns itself to allow for method chaining.
     * @example
     * map.addSource('source-id', {
     *     type: 'vector',
     *     url: 'mapbox://mapbox.mapbox-streets-v7'
     * });
     *
     * // Update vector tile source to a new URL endpoint
     * map.getSource('source-id').setUrl("mapbox://mapbox.mapbox-streets-v8");
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

    serialize(): VectorSourceSpecification {
        return extend({}, this._options);
    }

    loadTile(tile: Tile, callback: Callback<undefined>) {
        const tileUrl = tile.tileID.canonical.url(this.tiles, this.scheme);
        const url = this.map._requestManager.normalizeTileURL(tileUrl);
        const request = this.map._requestManager.transformRequest(url, ResourceType.Tile);
        const lutForScope = this.map.style ? this.map.style.getLut(this.scope) : null;
        const lut = lutForScope ? {image: lutForScope.image.clone()} : null;

        const params: WorkerSourceVectorTileRequest = {
            request,
            data: undefined,
            uid: tile.uid,
            tileID: tile.tileID,
            tileZoom: tile.tileZoom,
            zoom: tile.tileID.overscaledZ,
            maxZoom: this.maxzoom,
            lut,
            tileSize: this.tileSize * tile.tileID.overscaleFactor(),
            type: this.type,
            source: this.id,
            scope: this.scope,
            pixelRatio: browser.devicePixelRatio,
            showCollisionBoxes: this.map.showCollisionBoxes,
            promoteId: this.promoteId,
            isSymbolTile: tile.isSymbolTile,
            brightness: this.map.style ? (this.map.style.getBrightness() || 0.0) : 0.0,
            extraShadowCaster: tile.isExtraShadowCaster,
            tessellationStep: this.map._tessellationStep,
            scaleFactor: this.map.getScaleFactor(),
            worldview: this.map.getWorldview() || this.worldviewDefault
        };

        // If we request a Mapbox URL, use the `worldview` param in the WorkerTile
        // to filter out features in the localizable layers
        // that are not visible in the current worldview.
        if (this.hasWorldviews && isMapboxURL(tileUrl)) {
            params.localizableLayerIds = this.localizableLayerIds;
        }

        params.request.collectResourceTiming = this._collectResourceTiming;

        if (!tile.actor || tile.state === 'expired') {
            tile.actor = this._tileWorkers[url] = this._tileWorkers[url] || this.dispatcher.getActor();

            // if workers are not ready to receive messages yet, use the idle time to preemptively
            // load tiles on the main thread and pass the result instead of requesting a worker to do so
            if (!this.dispatcher.ready) {
                const cancel = loadVectorTile.call({deduped: this._deduped}, params, (err?: Error | null, data?: LoadVectorTileResult | null) => {
                    if (err || !data) {
                        done.call(this, err);
                    } else {
                        // the worker will skip the network request if the data is already there
                        params.data = {
                            cacheControl: data.cacheControl,
                            expires: data.expires,
                            rawData: data.rawData.slice(0)
                        };
                        if (tile.actor) tile.actor.send('loadTile', params, done.bind(this), undefined, true);
                    }
                }, true);
                tile.request = {cancel};

            } else {
                tile.request = tile.actor.send('loadTile', params, done.bind(this), undefined, true);
            }

        } else if (tile.state === 'loading') {
            // schedule tile reloading after it has been loaded
            tile.reloadCallback = callback;

        } else {
            tile.request = tile.actor.send('reloadTile', params, done.bind(this));
        }

        function done(err?: AJAXError | null, data?: WorkerSourceVectorTileResult | null) {
            delete tile.request;

            if (tile.aborted)
                return callback(null);

            if (err && err.status !== 404) {
                return callback(err);
            }

            if (data && data.resourceTiming)
                tile.resourceTiming = data.resourceTiming;

            if (this.map._refreshExpiredTiles && data) tile.setExpiryData(data);
            tile.loadVectorData(data, this.map.painter);

            cacheEntryPossiblyAdded(this.dispatcher);

            callback(null);

            if (tile.reloadCallback) {
                this.loadTile(tile, tile.reloadCallback);
                tile.reloadCallback = null;
            }
        }
    }

    abortTile(tile: Tile) {
        if (tile.request) {
            tile.request.cancel();
            delete tile.request;
        }
        if (tile.actor) {
            tile.actor.send('abortTile', {uid: tile.uid, type: this.type, source: this.id, scope: this.scope});
        }
    }

    unloadTile(tile: Tile, _?: Callback<undefined> | null) {
        if (tile.actor) {
            tile.actor.send('removeTile', {uid: tile.uid, type: this.type, source: this.id, scope: this.scope});
        }
        tile.destroy();
    }

    hasTransition(): boolean {
        return false;
    }

    afterUpdate() {
        this._tileWorkers = {};
    }

    cancelTileJSONRequest() {
        if (!this._tileJSONRequest) return;
        this._tileJSONRequest.cancel();
        this._tileJSONRequest = null;
    }
}

export default VectorTileSource;
