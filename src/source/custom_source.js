// @flow

import Tile from './tile.js';
import {Source} from './source.js';
import {extend, pick} from '../util/util.js';
import {OverscaledTileID} from './tile_id.js';
import {Event, ErrorEvent, Evented} from '../util/evented.js';
import {cacheEntryPossiblyAdded} from '../util/tile_request_cache.js';

import RasterTileSource from './raster_tile_source.js';

import type Map from '../ui/map.js';
import type {CanonicalTileID} from './tile_id.js';
import type Dispatcher from '../util/dispatcher.js';
import type {Callback} from '../types/callback.js';

type DataType = 'raster'; // vector | geojson

function isRaster(data: any): boolean {
    return data instanceof HTMLCanvasElement || data instanceof ImageBitmap;
}

export type CustomSourceInterface<T> = {
    id: string;
    type: 'custom',
    dataType: ?DataType,
    minzoom: number,
    maxzoom: number,
    scheme: string;
    tileSize: number,
    attribution: ?string,
    loadTile: (id: CanonicalTileID, options: { signal: AbortSignal }) => Promise<T>,
    prepareTile: ?(id: CanonicalTileID) => ?T,
    unloadTile: ?(id: CanonicalTileID, callback: Callback<void>) => void,
    abortTile: ?(id: CanonicalTileID, callback: Callback<void>) => void,
    onAdd: ?(map: Map, callback: Callback<void>) => void,
    onRemove: ?(map: Map) => void,
}

class CustomSource<T> extends Evented implements Source {

    id: string;
    type: 'custom';
    scheme: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    attribution: string;
    roundZoom: boolean;

    minTileCacheSize: ?number;
    maxTileCacheSize: ?number;

    dataType: ?DataType;
    implementation: CustomSourceInterface<T>;

    map: Map;
    dispatcher: Dispatcher;
    _loaded: boolean;

    constructor(id: string, implementation: CustomSourceInterface<T>, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'custom';
        this.dispatcher = dispatcher;
        this.setEventedParent(eventedParent);
        this.implementation = implementation;

        this.scheme = 'xyz';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;

        this._loaded = false;
        this.roundZoom = true;

        if (!implementation) {
            this.fire(new ErrorEvent(new Error(`Missing implementation for ${this.id} custom source`)));
        }

        // $FlowFixMe[prop-missing]
        implementation.update = this.update.bind(this);

        // $FlowFixMe[prop-missing]
        implementation.coveringTiles = this.coveringTiles.bind(this);

        extend(this, pick(implementation, ['dataType', 'scheme', 'minzoom', 'maxzoom', 'tileSize', 'attribution', 'minTileCacheSize', 'maxTileCacheSize']));
    }

    serialize(): Source {
        return pick(this, ['type', 'scheme', 'minzoom', 'maxzoom', 'tileSize', 'attribution']);
    }

    load() {
        this._loaded = true;
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
    }

    loaded(): boolean {
        return this._loaded;
    }

    onAdd(map: Map): void {
        this.map = map;
        if (this.implementation.onAdd) {
            this.implementation.onAdd(map, this.load);
        } else {
            this.load();
        }
    }

    onRemove(map: Map): void {
        if (this.implementation.onRemove) {
            this.implementation.onRemove(map);
        }
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const controller = new AbortController();
        const signal = controller.signal;

        // $FlowFixMe[prop-missing]
        tile.request = this.implementation.loadTile(tile.tileID.canonical, {signal})
            .then(tileLoaded.bind(this))
            .catch(error => {
                // silence AbortError and 404 errors
                if (error.code === 20 || error.code === 404) return;
                callback(error);
            });

        // $FlowFixMe[prop-missing]
        tile.request.cancel = () => controller.abort();

        function tileLoaded(data) {
            delete tile.request;

            if (tile.aborted) return callback(null);
            if (!data) return callback(null);

            if (!this.dataType) {
                if (!isRaster(data)) return callback(new Error(`Can't infer data type from ${this.id}, only raster data supported at the moment`));
                this.dataType = 'raster';
            }

            RasterTileSource.loadTileData(tile, (data: any), this.map.painter);
            tile.state = 'loaded';

            cacheEntryPossiblyAdded(this.dispatcher);
            callback(null);
        }
    }

    prepareTile(tileID: OverscaledTileID): ?Tile {
        if (!this.implementation.prepareTile) return null;

        const data = this.implementation.prepareTile(tileID.canonical);
        if (!data) return null;

        const painter = this.map ? this.map.painter : null;
        const tile = new Tile(tileID, this.tileSize * tileID.overscaleFactor(), this.map.transform.tileZoom, painter, true);

        RasterTileSource.loadTileData(tile, (data: any), this.map.painter);
        tile.state = 'loaded';

        return tile;
    }

    unloadTile(tile: Tile, callback: Callback<void>): void {
        RasterTileSource.unloadTileData(tile, this.map.painter);

        if (this.implementation.unloadTile) {
            this.implementation.unloadTile(tile.tileID.canonical, callback);
        } else {
            callback();
        }
    }

    abortTile(tile: Tile, callback: Callback<void>): void {
        if (tile.request && tile.request.cancel) {
            tile.request.cancel();
            delete tile.request;
        }

        if (this.implementation.abortTile) {
            this.implementation.abortTile(tile.tileID.canonical, callback);
        } else {
            callback();
        }
    }

    hasTransition(): boolean {
        return false;
    }

    coveringTiles(): CanonicalTileID[] {
        const tileIDs = this.map.transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
        });

        return tileIDs.map(tileID => tileID.canonical);
    }

    update() {
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
    }
}

export default CustomSource;
