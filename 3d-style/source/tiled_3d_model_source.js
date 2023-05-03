// @flow

import {Evented, Event} from '../../src/util/evented.js';
import type {Source} from '../../src/source/source.js';
import type Tile from '../../src/source/tile.js';
import type {Callback} from '../../src/types/callback.js';
import type Dispatcher from '../../src/util/dispatcher.js';
import {ResourceType} from '../../src/util/ajax.js';
import type {ModelSourceSpecification} from '../../src/style-spec/types.js';
import type Map from '../../src/ui/map.js';

class Tiled3DModelSource extends Evented implements Source {
    type: 'batched-model';
    id: string;
    minzoom: number;
    maxzoom: number;

    roundZoom: boolean | void;
    reparseOverscaled: boolean | void;
    tileSize: number;
    tiles: Array<string>;
    dispatcher: Dispatcher;
    scheme: string;
    _loaded: boolean;
    _options: ModelSourceSpecification;
    map: Map;
    /**
     * @private
     */
    // eslint-disable-next-line no-unused-vars
    constructor(id: string, options: ModelSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.type = 'batched-model';
        this.id = id;
        this.tileSize = 512;

        this._options = options;
        this.maxzoom = options.maxzoom || 19;
        this.minzoom = options.minzoom || 0;
        this.roundZoom = true;
        this.dispatcher = dispatcher;
        this.reparseOverscaled = true;
        this.scheme = 'xyz';
        this._loaded = false;
        this.setEventedParent(eventedParent);
    }
    // $FlowFixMe[method-unbinding]
    onAdd(map: Map) {
        this.map = map;
        this._loaded = true;
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
    }

    hasTransition(): boolean {
        return false;
    }

    loaded(): boolean {
        return this._loaded;
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url((this._options.tiles: any), this.scheme));
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
            showCollisionBoxes: this.map.showCollisionBoxes,
            isSymbolTile: tile.isSymbolTile
        };
        if (!tile.actor || tile.state === 'expired') {
            tile.actor = this.dispatcher.getActor();
        }
        tile.request = tile.actor.send('loadTile', params, done.bind(this), undefined, true);

        function done(err, data) {
            if (tile.aborted)
                return callback(null);

            if (err) {
                return callback(err);
            }
            if (data && data.resourceTiming)
                tile.resourceTiming = data.resourceTiming;
            if (this.map._refreshExpiredTiles && data) tile.setExpiryData(data);

            tile.buckets = {...tile.buckets, ...data.buckets};
            tile.state = 'loaded';
            callback(null);
        }
    }

    serialize(): Object {
        return {
            type: 'batched-model'
        };
    }
}

export default Tiled3DModelSource;
