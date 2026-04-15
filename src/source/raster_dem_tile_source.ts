import {ResourceType} from '../util/ajax';
import {OverscaledTileID} from './tile_id';
import {parseTileJSONRequest} from './load_tilejson';
import {processTileJSON} from './tile_provider';
import RasterTileSource from './raster_tile_source';
// Import DEMData as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import '../data/dem_data';

import type {Evented} from '../util/evented';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';
import type {RasterDEMSourceSpecification} from '../style-spec/types';
import type {TileJSON} from '../types/tilejson';
import type {WorkerSourceDEMTileRequest, WorkerSourceDEMTileResult} from './worker_source';

class RasterDEMTileSource extends RasterTileSource<'raster-dem'> {
    encoding: 'mapbox' | 'terrarium';

    constructor(id: string, options: RasterDEMSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'raster-dem';
        this.maxzoom = 22;
        this._options = Object.assign({type: 'raster-dem'}, options);
        this.encoding = options.encoding || "mapbox";
    }

    override loadTileJSONWithProvider(tileProvider: {name: string; url: string}, callback: Callback<TileJSON>): Cancelable {
        this.provider = tileProvider.name;
        const {request, options} = parseTileJSONRequest(this._options, this.map._requestManager);

        const controller = new AbortController();
        this.dispatcher.broadcast('loadTileProvider', {
            name: tileProvider.name,
            url: tileProvider.url,
            source: this.id,
            scope: this.scope,
            type: this.type,
            options,
            request,
        }, (err, results) => {
            if (controller.signal.aborted) return;

            if (err) {
                callback(err);
                return;
            }

            const tileJSON = results ? results.find((r: Partial<TileJSON> | null) => r != null) : null;
            const result = processTileJSON(this._options, tileJSON, this.map._requestManager);
            if (result instanceof Error) {
                callback(result);
            } else {
                callback(null, result);
            }
        });

        return {cancel: () => controller.abort()};
    }

    override loadTile(tile: Tile, callback: Callback<undefined>) {
        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme), false, this.tileSize);
        const request = this.map._requestManager.transformRequest(url, ResourceType.Tile);

        const params: WorkerSourceDEMTileRequest = {
            uid: tile.uid,
            tileID: tile.tileID,
            source: this.id,
            type: this.type,
            scope: this.scope,
            request,
            encoding: this.encoding,
        };

        if (!tile.actor || tile.state === 'expired') {
            tile.actor = this.dispatcher.getActor();
            tile.request = tile.actor.send('loadTile', params, done.bind(this), undefined, true);
        }

        function done(this: RasterDEMTileSource, err?: Error | null, result?: WorkerSourceDEMTileResult | null) {
            delete tile.request;

            if (tile.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }

            if (err) {
                tile.state = 'errored';
                return callback(err);
            }

            if (result) {
                if (this.map._refreshExpiredTiles) tile.setExpiryData(result);

                if (!result.borderReady && !tile.neighboringTiles) {
                    tile.neighboringTiles = this._getNeighboringTiles(tile.tileID);
                }

                tile.dem = result.dem;
                tile.dem.onDeserialize();
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
            }

            tile.state = 'loaded';
            callback(null);
        }
    }

    override abortTile(tile: Tile, callback?: Callback<undefined>) {
        if (tile.request) {
            tile.request.cancel();
            delete tile.request;
        }
        if (tile.actor) {
            tile.actor.send('abortTile', {uid: tile.uid, type: this.type, source: this.id, scope: this.scope});
        }
        if (callback) callback();
    }

    _getNeighboringTiles(tileID: OverscaledTileID): {[key: number]: {backfilled: boolean}} {
        const canonical = tileID.canonical;
        const dim = Math.pow(2, canonical.z);

        const px = (canonical.x - 1 + dim) % dim;
        const pxw = canonical.x === 0 ? tileID.wrap - 1 : tileID.wrap;
        const nx = (canonical.x + 1 + dim) % dim;
        const nxw = canonical.x + 1 === dim ? tileID.wrap + 1 : tileID.wrap;

        const neighboringTiles: Record<string, {backfilled: boolean}> = {};
        // add adjacent tiles
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y).key] = {backfilled: false};
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y).key] = {backfilled: false};

        // Add upper neighboringTiles
        if (canonical.y > 0) {
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y - 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y - 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y - 1).key] = {backfilled: false};
        }
        // Add lower neighboringTiles
        if (canonical.y + 1 < dim) {
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y + 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y + 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y + 1).key] = {backfilled: false};
        }

        return neighboringTiles;
    }
}

export default RasterDEMTileSource;
