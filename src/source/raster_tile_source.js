// @flow

const util = require('../util/util');
const ajax = require('../util/ajax');
const Evented = require('../util/evented');
const loadTileJSON = require('./load_tilejson');
const normalizeURL = require('../util/mapbox').normalizeTileURL;
const TileBounds = require('./tile_bounds');
const Texture = require('../render/texture');

import type {Source} from './source';
import type TileCoord from './tile_coord';
import type Map from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';
import type {Callback} from '../types/callback';

class RasterTileSource extends Evented implements Source {
    type: 'raster';
    id: string;
    minzoom: number;
    maxzoom: number;
    url: string;
    scheme: string;
    tileSize: number;

    bounds: ?[number, number, number, number];
    tileBounds: TileBounds;
    roundZoom: boolean;
    dispatcher: Dispatcher;
    map: Map;
    tiles: Array<string>;

    _loaded: boolean;
    _options: RasterSourceSpecification;

    constructor(id: string, options: RasterSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
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

        this._options = util.extend({}, options);
        util.extend(this, util.pick(options, ['url', 'scheme', 'tileSize']));
    }

    load() {
        this.fire('dataloading', {dataType: 'source'});
        loadTileJSON(this._options, this.map._transformRequest, (err, tileJSON) => {
            if (err) {
                this.fire('error', err);
            } else if (tileJSON) {
                util.extend(this, tileJSON);
                if (tileJSON.bounds) this.tileBounds = new TileBounds(tileJSON.bounds, this.minzoom, this.maxzoom);

                // `content` is included here to prevent a race condition where `Style#_updateSources` is called
                // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
                // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
                this.fire('data', {dataType: 'source', sourceDataType: 'metadata'});
                this.fire('data', {dataType: 'source', sourceDataType: 'content'});
            }
        });
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    serialize() {
        return util.extend({}, this._options);
    }

    hasTile(coord: TileCoord) {
        return !this.tileBounds || this.tileBounds.contains(coord, this.maxzoom);
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const url = normalizeURL(tile.coord.url(this.tiles, null, this.scheme), this.url, this.tileSize);
        tile.request = ajax.getImage(this.map._transformRequest(url, ajax.ResourceType.Tile), (err, img) => {
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

                const gl = this.map.painter.gl;
                tile.texture = this.map.painter.getTileTexture(img.width);
                if (tile.texture) {
                    tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
                    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
                } else {
                    tile.texture = new Texture(gl, img, gl.RGBA);
                    tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

                    if (this.map.painter.extTextureFilterAnisotropic) {
                        gl.texParameterf(gl.TEXTURE_2D, this.map.painter.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, this.map.painter.extTextureFilterAnisotropicMax);
                    }
                }
                gl.generateMipmap(gl.TEXTURE_2D);

                tile.state = 'loaded';

                callback(null);
            }
        });
    }

    abortTile(tile: Tile, callback: Callback<void>) {
        if (tile.request) {
            tile.request.abort();
            delete tile.request;
        }
        callback();
    }

    unloadTile(tile: Tile, callback: Callback<void>) {
        if (tile.texture) this.map.painter.saveTileTexture(tile.texture);
        callback();
    }

    hasTransition() {
        return false;
    }
}

module.exports = RasterTileSource;
