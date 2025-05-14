import browser from '../../src/util/browser';
import {Evented, ErrorEvent, Event} from '../../src/util/evented';
import {ResourceType} from '../../src/util/ajax';
import loadTileJSON from '../../src/source/load_tilejson';
import TileBounds from '../../src/source/tile_bounds';
import {extend} from '../../src/util/util';
import {postTurnstileEvent} from '../../src/util/mapbox';
import {makeFQID} from '../../src/util/fqid';

// Import Tiled3dModelBucket as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import '../data/bucket/tiled_3d_model_bucket';

import type Tile from '../../src/source/tile';
import type Dispatcher from '../../src/util/dispatcher';
import type Tiled3dModelBucket from '../data/bucket/tiled_3d_model_bucket';
import type {Map} from '../../src/ui/map';
import type {Callback} from '../../src/types/callback';
import type {Cancelable} from '../../src/types/cancelable';
import type {OverscaledTileID} from '../../src/source/tile_id';
import type {ISource, SourceEvents} from '../../src/source/source';
import type {ModelSourceSpecification, PromoteIdSpecification} from '../../src/style-spec/types';
import type {WorkerSourceTiled3dModelRequest, WorkerSourceVectorTileResult} from '../../src/source/worker_source';
import type {AJAXError} from '../../src/util/ajax';

class Tiled3DModelSource extends Evented<SourceEvents> implements ISource {
    type: 'batched-model';
    id: string;
    scope: string;
    minzoom: number;
    maxzoom: number;
    tileBounds: TileBounds;
    roundZoom: boolean | undefined;
    reparseOverscaled: boolean | undefined;
    usedInConflation: boolean;
    tileSize: number;
    minTileCacheSize?: number;
    maxTileCacheSize?: number;
    attribution: string | undefined;
    // eslint-disable-next-line camelcase
    mapbox_logo: boolean | undefined;
    promoteId?: PromoteIdSpecification | null;
    vectorLayers?: never;
    vectorLayerIds?: never;
    rasterLayers?: never;
    rasterLayerIds?: never;
    tiles: Array<string>;
    dispatcher: Dispatcher;
    scheme: string;
    _loaded: boolean;
    _options: ModelSourceSpecification;
    _tileJSONRequest: Cancelable | null | undefined;
    map: Map;

    onRemove: undefined;
    abortTile: undefined;
    unloadTile: undefined;
    prepare: undefined;
    afterUpdate: undefined;
    _clear: undefined;

    /**
     * @private
     */
    constructor(id: string, options: ModelSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.type = 'batched-model';
        this.id = id;
        this.tileSize = 512;

        this._options = options;
        this.tiles = this._options.tiles;
        this.maxzoom = options.maxzoom || 19;
        this.minzoom = options.minzoom || 0;
        this.roundZoom = true;
        this.usedInConflation = true;
        this.dispatcher = dispatcher;
        this.reparseOverscaled = false;
        this.scheme = 'xyz';
        this._loaded = false;
        this.setEventedParent(eventedParent);
    }
    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    reload() {
        this.cancelTileJSONRequest();
        const fqid = makeFQID(this.id, this.scope);
        this.load(() => this.map.style.clearSource(fqid));
    }

    cancelTileJSONRequest() {
        if (!this._tileJSONRequest) return;
        this._tileJSONRequest.cancel();
        this._tileJSONRequest = null;
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
                if (worldview && worldview.length !== 2) console.warn(`Requested worldview strings must be a valid ISO alpha-2 code. Found: ${worldview}`);

                this.fire(new ErrorEvent(err));
            } else if (tileJSON) {
                extend(this, tileJSON);
                if (tileJSON.bounds) this.tileBounds = new TileBounds(tileJSON.bounds, this.minzoom, this.maxzoom);
                postTurnstileEvent(tileJSON.tiles, this.map._requestManager._customAccessToken);

                // `content` is included here to prevent a race condition where `Style#_updateSources` is called
                // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
                // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }

            if (callback) callback(err);
        });
    }

    hasTransition(): boolean {
        return false;
    }

    hasTile(tileID: OverscaledTileID): boolean {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    loaded(): boolean {
        return this._loaded;
    }

    loadTile(tile: Tile, callback: Callback<undefined>) {
        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme));
        const request = this.map._requestManager.transformRequest(url, ResourceType.Tile);
        const params: WorkerSourceTiled3dModelRequest = {
            request,
            data: undefined,
            uid: tile.uid,
            tileID: tile.tileID,
            tileZoom: tile.tileZoom,
            zoom: tile.tileID.overscaledZ,
            tileSize: this.tileSize * tile.tileID.overscaleFactor(),
            type: this.type,
            source: this.id,
            scope: this.scope,
            showCollisionBoxes: this.map.showCollisionBoxes,
            isSymbolTile: tile.isSymbolTile,
            brightness: this.map.style ? (this.map.style.getBrightness() || 0.0) : 0.0,
            pixelRatio: browser.devicePixelRatio,
            promoteId: this.promoteId,
        };

        if (!tile.actor || tile.state === 'expired') {
            tile.actor = this.dispatcher.getActor();
            tile.request = tile.actor.send('loadTile', params, done.bind(this), undefined, true);
        } else if (tile.state === 'loading') {
            // schedule tile reloading after it has been loaded
            tile.reloadCallback = callback;
        } else {
            // If the tile has already been parsed we may just need to reevaluate
            if (tile.buckets) {
                const buckets = Object.values(tile.buckets) as Tiled3dModelBucket[];
                for (const bucket of buckets) {
                    bucket.dirty = true;
                }
                tile.state = 'loaded';
                return;
            }
            tile.request = tile.actor.send('reloadTile', params, done.bind(this));
        }

        function done(err?: AJAXError | null, data?: WorkerSourceVectorTileResult | null) {
            if (tile.aborted) return callback(null);

            if (err && err.status !== 404) {
                return callback(err);
            }

            if (this.map._refreshExpiredTiles && data) tile.setExpiryData(data);
            tile.loadModelData(data, this.map.painter);

            tile.state = 'loaded';
            callback(null);
        }
    }

    serialize(): ModelSourceSpecification {
        return extend({}, this._options);
    }
}

export default Tiled3DModelSource;
