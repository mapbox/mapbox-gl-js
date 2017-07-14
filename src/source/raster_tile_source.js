// @flow

const util = require('../util/util');
const ajax = require('../util/ajax');
const Evented = require('../util/evented');
const loadTileJSON = require('./load_tilejson');
const normalizeURL = require('../util/mapbox').normalizeTileURL;
const TileBounds = require('./tile_bounds');

import type {Source} from './source';
import type TileCoord from './tile_coord';
import type Map from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';

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
    state: 'unloaded' | 'loaded' | 'errored';
    roundZoom: boolean;
    dispatcher: Dispatcher;
    map: Map;
    tiles: Array<string>;

    _loaded: boolean;
    _options: TileSourceSpecification;

    constructor(id: string, options: TileSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
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
        loadTileJSON(this._options, (err, tileJSON) => {
            if (err) {
                this.fire('error', err);
            } else if (tileJSON) {
                util.extend(this, tileJSON);
                this.setBounds(tileJSON.bounds);

                // `content` is included here to prevent a race condition where `Style#_updateSources` is called
                // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
                // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
                this.fire('data', {dataType: 'source', sourceDataType: 'metadata'});
                this.fire('data', {dataType: 'source', sourceDataType: 'content'});
            }
        });
    }

    onAdd(map: Map) {
        this.load();
        this.map = map;
    }

    setBounds(bounds?: [number, number, number, number]) {
        this.bounds = bounds;
        if (bounds) {
            this.tileBounds = new TileBounds(bounds, this.minzoom, this.maxzoom);
        }
    }

    serialize() {
        return util.extend({}, this._options);
    }

    hasTile(coord: TileCoord) {
        return !this.tileBounds || this.tileBounds.contains(coord, this.maxzoom);
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const url = normalizeURL(tile.coord.url(this.tiles, null, this.scheme), this.url, this.tileSize);

        tile.request = ajax.getImage(url, (err, img) => {
            delete tile.request;

            if (tile.aborted) {
                this.state = 'unloaded';
                callback(null);
            } else if (err) {
                this.state = 'errored';
                callback(err);
            } else if (img) {
                if (this.map._refreshExpiredTiles) tile.setExpiryData(img);
                delete (img : any).cacheControl;
                delete (img : any).expires;

                const gl = this.map.painter.gl;
                tile.texture = this.map.painter.getTileTexture(img.width);
                if (tile.texture) {
                    gl.bindTexture(gl.TEXTURE_2D, tile.texture);
                    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
                } else {
                    tile.texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, tile.texture);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
                    if (this.map.painter.extTextureFilterAnisotropic) {
                        gl.texParameterf(gl.TEXTURE_2D, this.map.painter.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, this.map.painter.extTextureFilterAnisotropicMax);
                    }

                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                    tile.texture.size = img.width;
                }
                gl.generateMipmap(gl.TEXTURE_2D);

                tile.state = 'loaded';

                callback(null);
            }
        });
    }

    abortTile(tile: Tile) {
        if (tile.request) {
            tile.request.abort();
            delete tile.request;
        }
    }

    unloadTile(tile: Tile) {
        if (tile.texture) this.map.painter.saveTileTexture(tile.texture);
    }
}

module.exports = RasterTileSource;
