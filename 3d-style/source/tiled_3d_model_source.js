// @flow

import {Evented, ErrorEvent, Event} from '../../src/util/evented.js';
import {ResourceType} from '../../src/util/ajax.js';
import loadTileJSON from '../../src/source/load_tilejson.js';
import TileBounds from '../../src/source/tile_bounds.js';
import {extend} from '../../src/util/util.js';
import {postTurnstileEvent} from '../../src/util/mapbox.js';

// Import Tiled3dModelBucket as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import '../data/bucket/tiled_3d_model_bucket.js';

import type Tiled3dModelBucket from '../data/bucket/tiled_3d_model_bucket.js';
import type {Source} from '../../src/source/source.js';
import type Tile from '../../src/source/tile.js';
import type {Callback} from '../../src/types/callback.js';
import type {Cancelable} from '../../src/types/cancelable.js';
import type Dispatcher from '../../src/util/dispatcher.js';
import type {ModelSourceSpecification} from '../../src/style-spec/types.js';
import type {Map} from '../../src/ui/map.js';
import type {OverscaledTileID} from '../../src/source/tile_id.js';

class Tiled3DModelSource extends Evented implements Source {
    type: 'batched-model';
    id: string;
    scope: string;
    minzoom: number;
    maxzoom: number;
    tileBounds: TileBounds;
    roundZoom: boolean | void;
    reparseOverscaled: boolean | void;
    usedInConflation: boolean;
    tileSize: number;
    tiles: Array<string>;
    dispatcher: Dispatcher;
    scheme: string;
    _loaded: boolean;
    _options: ModelSourceSpecification;
    _tileJSONRequest: ?Cancelable;
    map: Map;

    /**
     * @private
     */
    constructor(id: string, options: ModelSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.type = 'batched-model';
        this.id = id;
        this.tileSize = 512;

        this._options = options;
        this.tiles = (this._options.tiles: any);
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
    // $FlowFixMe[method-unbinding]
    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    load(callback?: Callback<void>) {
        this._loaded = false;
        this.fire(new Event('dataloading', {dataType: 'source'}));
        const language = Array.isArray(this.map._language) ? this.map._language.join() : this.map._language;
        const worldview = this.map._worldview;
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

    // $FlowFixMe[method-unbinding]
    hasTile(tileID: OverscaledTileID): boolean {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    loaded(): boolean {
        return this._loaded;
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url((this.tiles: any), this.scheme));
        const request = this.map._requestManager.transformRequest(url, ResourceType.Tile);
        const params = {
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
            brightness: this.map.style ? (this.map.style.getBrightness() || 0.0) : 0.0
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
                const buckets: Tiled3dModelBucket[] = (Object.values(tile.buckets): any[]);
                for (const bucket of buckets) {
                    bucket.dirty = true;
                }
                tile.state = 'loaded';
                return;
            }
            tile.request = tile.actor.send('reloadTile', params, done.bind(this));
        }

        // $FlowFixMe[missing-this-annot]
        function done(err: ?Error, data: any) {
            if (tile.aborted) return callback(null);

            // $FlowFixMe[prop-missing] - generic Error type doesn't have status
            if (err && err.status !== 404) {
                return callback(err);
            }

            if (data) {
                if (data.resourceTiming) tile.resourceTiming = data.resourceTiming;
                if (this.map._refreshExpiredTiles) tile.setExpiryData(data);
                tile.buckets = {...tile.buckets, ...data.buckets};
                if (data.featureIndex) {
                    tile.latestFeatureIndex = data.featureIndex;
                }
            }

            tile.state = 'loaded';
            callback(null);
        }
    }

    serialize(): ModelSourceSpecification {
        return extend({}, this._options);
    }
}

export default Tiled3DModelSource;
