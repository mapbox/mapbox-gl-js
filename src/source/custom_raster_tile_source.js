// @flow

import Tile from './tile.js';
import {extend, pick} from '../util/util.js';
import {OverscaledTileID} from './tile_id.js';
import {Event, ErrorEvent, Evented} from '../util/evented.js';
import {cacheEntryPossiblyAdded} from '../util/tile_request_cache.js';

import type Map from '../ui/map.js';
import type {CanonicalTileID} from './tile_id.js';
import type {Source} from './source.js';
import type Dispatcher from '../util/dispatcher.js';
import type {Callback} from '../types/callback.js';

export type CustomRasterTileSourceOptions = {
    id: string;

    /**
     * An integer representing the lowest zoom level whose tiles this layer appears in.
     */
    minzoom: number,

    /**
     * An integer representing the highest zoom level whose tiles this layer appears in.
     */
    maxzoom: number,

    /**
     * Either "xyz" or "tms". Influences the y direction of the tile coordinates.
     */
    scheme: string;

    /**
     * The tile size in pixels.
     */
    tileSize: number,

    /**
     * Contains an attribution to be displayed when the map is shown to a user.
     */
    attribution?: string,

    /**
     * The minimum number of tiles stored in the tile cache for a given source. Larger viewports use more tiles and need larger caches. Larger viewports are more likely to be found on devices with more memory and on pages where the map is more important. If omitted, the cache will be dynamically sized based on the current viewport.
     */
    minTileCacheSize?: number;

    /**
     * The maximum number of tiles stored in the tile cache for a given source. If omitted, the cache will be dynamically sized based on the current viewport.
     */
    maxTileCacheSize?: number;

    /**
     * Required method called when map is going to load tiles in the current viewport.
     */
    loadTile: (id: CanonicalTileID, callback: Callback<HTMLImageElement | ImageBitmap>) => void,

    /**
     * Optional method called during a render frame to allow a source to prepare and update tile texture.
     */
    renderTile?: (id: CanonicalTileID) => ?(HTMLImageElement | ImageBitmap),

    /**
     * Optional method called after the tile is unloaded from the map viewport.
     */
    unloadTile?: (id: CanonicalTileID, callback: Callback<void>) => void,

    /**
     * Optional method called if the map aborted request in loadTile phase.
     */
    abortTile?: (id: CanonicalTileID, callback: Callback<void>) => void,

    /**
     * Optional method called when the source has been added to the Map.
     */
    onAdd?: (map: Map, callback: Callback<void>) => void,

    /**
     * Optional method called when the source is removed from the map.
     * This gives the source a chance to clean up resources and event listeners.
     */
    onRemove?: () => void,
}

class CustomRasterTileSource extends Evented implements Source {
    type: string;
    id: string;
    minzoom: number;
    maxzoom: number;
    scheme: string;
    tileSize: number;
    minTileCacheSize: ?number;
    maxTileCacheSize: ?number;
    roundZoom: boolean;

    map: Map;
    dispatcher: Dispatcher;

    coveringTiles: () => CanonicalTileID[];

    _loaded: boolean;
    _options: CustomRasterTileSourceOptions

    constructor(id: string, options: CustomRasterTileSourceOptions, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'custom-raster';
        this.roundZoom = true;
        this.dispatcher = dispatcher;
        this.setEventedParent(eventedParent);

        if (!options.loadTile) {
            this.fire(new ErrorEvent(new Error(`Missing "loadTile" option on ${this.id}`)));
        }

        this.scheme = 'xyz';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;
        this._loaded = false;
        this.minTileCacheSize = 0;
        this.maxTileCacheSize = 0;

        this._options = extend({}, options);
        extend(this, pick(options, ['scheme', 'minzoom', 'maxzoom', 'tileSize', 'minTileCacheSize', 'maxTileCacheSize']));
    }

    serialize() {
        return extend({}, this._options);
    }

    onAdd(map: Map) {
        this.map = map;

        if (!this._options.onAdd) return this.load();
        this._options.onAdd(map, this.load);
    }

    onRemove() {
        if (this._options.onRemove) {
            this._options.onRemove();
        }
    }

    load() {
        this._loaded = true;
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
    }

    loaded(): boolean {
        return this._loaded;
    }

    renderTile(tileID: OverscaledTileID): ?Tile {
        if (!this._options.renderTile) return null;

        const data = this._options.renderTile(tileID.canonical);
        if (!data) return null;

        const painter = this.map ? this.map.painter : null;
        const tile = new Tile(tileID, this.tileSize * tileID.overscaleFactor(), this.map.transform.tileZoom, painter, true);

        tile.setTexture(data, this.map.painter);
        tile.state = 'loaded';

        return tile;
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        tile.request = this._options.loadTile(tile.tileID.canonical, tileLoaded.bind(this));

        function tileLoaded(error, data, cacheControl, expires) {
            delete tile.request;

            if (tile.aborted) return callback(null);
            if (error) return callback(error);
            if (!data) return callback(null);

            if (this.map._refreshExpiredTiles) tile.setExpiryData({cacheControl, expires});
            tile.setTexture(data, this.map.painter);
            tile.state = 'loaded';

            cacheEntryPossiblyAdded(this.dispatcher);

            callback(null);
        }
    }

    unloadTile(tile: Tile, callback: Callback<void>) {
        if (tile.texture) this.map.painter.saveTileTexture(tile.texture);

        if (!this._options.unloadTile) return callback();
        this._options.unloadTile(tile.tileID.canonical, callback);
    }

    abortTile(tile: Tile, callback: Callback<void>) {
        if (tile.request && tile.request.cancel) {
            tile.request.cancel();
            delete tile.request;
        }

        if (!this._options.abortTile) return callback();
        this._options.abortTile(tile.tileID.canonical, callback);
    }

    hasTransition() {
        return false;
    }

    /**
     * Returns an array of tiles that covers current map viewport.
     *
     * @returns {Array<Object>} The tiles that covers current map viewport.
     * @example
     * const source = map.getSource('id');
     * source.coveringTiles();
     */
    coveringTiles(): CanonicalTileID[] {
        const tileIDs = this.map.transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
        });

        return tileIDs.map(tileID => tileID.canonical);
    }

    /**
     * Reloads all source tiles in the current map viewport.
     *
     * @example
     * const source = map.getSource('id');
     * source.update();
     */
    update() {
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
    }
}

export default CustomRasterTileSource;
