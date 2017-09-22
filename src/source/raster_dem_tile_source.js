// @flow

const ajax = require('../util/ajax');
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
        this._options = Object.assign({}, options);
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
                this.state = 'unloaded';
                return callback(null);
            }

            if (err) {
                this.state = 'errored';
                return callback(err);
            }

            if (this.map._refreshExpiredTiles) tile.setExpiryData(img);

            if (img) {
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

                if (!tile.workerID || tile.state === 'expired' || tile.state === 'unloaded') {
                    tile.workerID = this.dispatcher.send('loadDEMTile', params, done.bind(this));
                }
            }
        }

        function done(err, data) {
            if (err) {
                this.state = 'errored';
                callback(err);
            }

            if (data) {
                tile.dem =  DEMData.deserialize(data);
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
        neighboringTiles[getTileId({ z: z, x: px, y: y, w: pxw })] = {backfilled: false};
        neighboringTiles[getTileId({ z: z, x: nx, y: y, w: nxw })] = {backfilled: false};

        // Add upper neighboringTiles
        if (y > 0) {
            neighboringTiles[getTileId({ z: z, x: px, y: y - 1, w: pxw  })] = {backfilled: false};
            neighboringTiles[getTileId({ z: z, x: x, y: y - 1, w: w  })] = {backfilled: false};
            neighboringTiles[getTileId({ z: z, x: nx, y: y - 1, w: nxw  })] = {backfilled: false};
        }
        // Add lower neighboringTiles
        if (y + 1 < dim) {
            neighboringTiles[getTileId({ z: z, x: px, y: y + 1, w: pxw  })] = {backfilled: false};
            neighboringTiles[getTileId({ z: z, x: x, y: y + 1, w: w  })] = {backfilled: false};
            neighboringTiles[getTileId({ z: z, x: nx, y: y + 1, w: nxw  })] = {backfilled: false};
        }

        return neighboringTiles;

        function getTileId(coord) {
            const tilecoord = new TileCoord(coord.z, coord.x, coord.y, coord.w);
            return tilecoord.id;
        }
    }


    unloadTile(tile: Tile) {
        tile.unloadDEMData();
        this.dispatcher.send('removeDEMTile', { uid: tile.uid, source: this.id }, undefined, tile.workerID);
    }

}

module.exports = RasterDEMTileSource;
