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
            type: 'raster-terrain',
            url: this.url,
            tileSize: this.tileSize,
            tiles: this.tiles,
            bounds: this.bounds,
        };
    }

    loadTile(tile: Tile, callback: Callback<TileJSON>) {
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
                tile.rawImageData = {data: browser.getImageData(img), width: img.width, height: img.height};

                const overscaling = tile.coord.z > this.maxzoom ? Math.pow(2, tile.coord.z - this.maxzoom) : 1;

                const params = {
                    uid: tile.uid,
                    coord: tile.coord,
                    zoom: tile.coord.z,
                    tileSize: this.tileSize * overscaling,
                    type: this.type,
                    source: this.id,
                    overscaling: overscaling,
                    rawImageData: tile.rawImageData
                };

                if (!tile.workerID || tile.state === 'expired') {
                    tile.workerID = this.dispatcher.send('loadTile', params, done.bind(this));
                } else if (tile.state === 'loading') {
                    // schedule tile reloading after it has been loaded
                    tile.reloadCallback = callback;
                } else {
                    this.dispatcher.send('reloadTile', params, done.bind(this), tile.workerID);
                }

                delete img.cacheControl;
                delete img.expires;
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

    _getNeighboringTiles(tileId) {
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

}

module.exports = RasterDEMTileSource;
