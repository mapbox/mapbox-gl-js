// @flow

const util = require('../util/util');
const ajax = require('../util/ajax');
const Evented = require('../util/evented');
const loadTileJSON = require('./load_tilejson');
const normalizeURL = require('../util/mapbox').normalizeTileURL;
const TileBounds = require('./tile_bounds');
const Texture = require('../render/texture');

import type {Source} from './source';
import type {OverscaledTileID} from './tile_id';
import type Map from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';
import type {Callback} from '../types/callback';

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
    roundZoom: boolean;
    dispatcher: Dispatcher;
    map: Map;
    tiles: Array<string>;

    _loaded: boolean;
    _options: RasterSourceSpecification | RasterDEMSourceSpecification;

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

    hasTile(tileID: OverscaledTileID) {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const url = normalizeURL(tile.tileID.canonical.url(this.tiles, this.scheme), this.url, this.tileSize);
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

                const context = this.map.painter.context;
                const gl = context.gl;
                tile.texture = this.map.painter.getTileTexture(img.width);
                if (tile.texture) {
                    tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
                    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
                } else {
                    tile.texture = new Texture(context, img, gl.RGBA);
                    tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

                    if (context.extTextureFilterAnisotropic) {
                        gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, context.extTextureFilterAnisotropicMax);
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
