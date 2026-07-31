import {Evented} from '../util/evented';

import type Tile from './tile';
import type Dispatcher from '../util/dispatcher';
import type {Map as MapboxMap} from '../ui/map';
import type {Callback} from '../types/callback';
import type {ISource, SourceEvents} from './source';
import type {SourceSpecification} from '../style-spec/types';

/**
 * A stand-in {@link ISource} used while the real source class is still loading from a
 * lazily-loaded module (see `Style#addSource` and `source.ensureSourceType`).
 *
 * It satisfies the synchronous `addSource` contract — a `SourceCache` can be created and
 * registered this tick — while reporting itself as not-loaded so no tiles are requested.
 * Once the module resolves, `SourceCache#setSource` swaps in the genuine source instance
 * and this placeholder is discarded.
 *
 * @private
 */
class LazySource extends Evented<SourceEvents> implements ISource {
    type: Exclude<ISource['type'], undefined>;
    id: string;
    scope!: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    roundZoom: boolean | undefined;
    reparseOverscaled: boolean | undefined;
    attribution: string | undefined;

    _options: SourceSpecification;

    constructor(id: string, options: SourceSpecification, _dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = options.type;
        this._options = options;
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;
        this.setEventedParent(eventedParent);
    }

    hasTransition(): boolean {
        return false;
    }

    // Never loaded — keeps the owning SourceCache from requesting tiles before the real
    // source is installed.
    loaded(): boolean {
        return false;
    }

    onAdd(_map: MapboxMap) {}

    onRemove(_map: MapboxMap) {}

    loadTile(_tile: Tile, _callback: Callback<undefined>) {}

    serialize(): SourceSpecification {
        return this._options;
    }
}

export default LazySource;
