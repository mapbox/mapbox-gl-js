// @flow

const ajax = require('../util/ajax');
const util = require('../util/util');
const Evented = require('../util/evented');
const normalizeURL = require('../util/mapbox').normalizeTileURL;
const browser = require('../util/browser');
const DEMData = require('../data/dem_data').DEMData;
const TileCoord = require('./tile_coord');
const RasterTileSource = require('./raster_tile_source');

import type {Source} from './source';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';

class RasterDEMTileSource extends RasterTileSource implements Source {
    _options: TileSourceSpecification;

    constructor(id: string, options: TileSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'raster-dem';
        this.maxzoom = 15;
        this._options = util.extend({}, options);
    }

    serialize() {
        return {
            type: 'raster-dem',
            url: this.url,
            tileSize: this.tileSize,
            tiles: this.tiles,
            bounds: this.bounds,
        };
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const url = normalizeURL(tile.coord.url(this.tiles, null, this.scheme), this.url, this.tileSize);
        tile.request = ajax.getImage(this.map._transformRequest(url, ajax.ResourceType.Tile), imageLoaded.bind(this));

        tile.neighboringTiles = this._getNeighboringTiles(tile.coord.id);
        function imageLoaded(err, img) {
            delete tile.request;
            if (tile.aborted) {
                tile.state = 'unloaded';
                callback(null);
            } else if (err) {
                tile.state = 'errored';
                callback(err);
            } else if (img) {
                if (this.map._refreshExpiredTiles) tile.setExpiryData(img);
                delete (img: any).cacheControl;
                delete (img: any).expires;

                const rawImageData = browser.getImageData(img);
                const params = {
                    uid: tile.uid,
                    coord: tile.coord,
                    source: this.id,
                    rawImageData: rawImageData
                };

                if (!tile.workerID || tile.state === 'expired') {
                    tile.workerID = this.dispatcher.send('loadDEMTile', params, done.bind(this));
                }
            }
        }

        function done(err, data) {
            if (err) {
                tile.state = 'errored';
                callback(err);
            }

            if (data) {
                tile.dem =  DEMData.deserialize(data);
                tile.needsHillshadePrepare = true;
                tile.state = 'loaded';
                callback(null);
            }
        }
    }

    _getNeighboringTiles(tileId: number) {
        const {z, x, y, w} = TileCoord.fromID(tileId);
        const dim = Math.pow(2, z);

        const px = (x - 1 + dim) % dim;
        const pxw = x === 0 ? w - 1 : w;
        const nx = (x + 1 + dim) % dim;
        const nxw = x + 1 === dim ? w + 1 : w;

        const neighboringTiles = {};
        neighboringTiles[TileCoord.idFromCoord(z, px, y, pxw)] = {backfilled: false};
        neighboringTiles[TileCoord.idFromCoord(z, nx, y, nxw)] = {backfilled: false};

        // Add upper neighboringTiles
        if (y > 0) {
            neighboringTiles[TileCoord.idFromCoord(z, px, y - 1, pxw)] = {backfilled: false};
            neighboringTiles[TileCoord.idFromCoord(z, x, y - 1, w)] = {backfilled: false};
            neighboringTiles[TileCoord.idFromCoord(z, nx, y - 1, nxw)] = {backfilled: false};
        }
        // Add lower neighboringTiles
        if (y + 1 < dim) {
            neighboringTiles[TileCoord.idFromCoord(z, px, y + 1, pxw)] = {backfilled: false};
            neighboringTiles[TileCoord.idFromCoord(z, x, y + 1, w)] = {backfilled: false};
            neighboringTiles[TileCoord.idFromCoord(z, nx, y + 1, nxw)] = {backfilled: false};
        }

        return neighboringTiles;
    }


    unloadTile(tile: Tile) {
        if (tile.demTexture) this.map.painter.saveTileTexture(tile.demTexture);
        if (tile.dem) delete tile.dem;
        delete tile.neighboringTiles;

        tile.state = 'unloaded';
        this.dispatcher.send('removeDEMTile', { uid: tile.uid, source: this.id }, undefined, tile.workerID);
    }

}

module.exports = RasterDEMTileSource;
