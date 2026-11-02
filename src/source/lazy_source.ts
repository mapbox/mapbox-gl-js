import {Evented} from '../util/evented';

import type Tile from './tile';
import type Dispatcher from '../util/dispatcher';
import type {Map as MapboxMap} from '../ui/map';
import type {Callback} from '../types/callback';
import type Model from '../../3d-style/data/model';
import type {ISource, SourceEvents} from './source';
import type {ModelSourceModelsSpecification, SourceSpecification} from '../style-spec/types';

/**
 * A stand-in {@link ISource} used while the real source class is still loading from a
 * lazily-loaded module (see `Style#addSource` and `source.ensureSourceType`).
 *
 * It satisfies the synchronous `addSource` contract — a `SourceCache` can be created and
 * registered this tick — while requesting no tiles of its own. Once the module resolves,
 * `SourceCache#setSource` swaps in the genuine source instance and this placeholder is
 * discarded.
 *
 * The module load itself is deferred until `startLoad()`, so a style that declares a lazy-typed
 * source nothing references never pays for its chunk (see `Style#update`).
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
    // Loads the module and swaps in the real source. Assigned by `Style#addSource`, which owns
    // the upgrade, and cleared once started.
    _loader: (() => void) | undefined;

    constructor(id: string, options: SourceSpecification, _dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = options.type;
        this._options = {...options};
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;
        this.setEventedParent(eventedParent);
    }

    hasTransition(): boolean {
        return false;
    }

    // Starts the deferred module load. Idempotent, so it's safe to call on every frame.
    startLoad() {
        const loader = this._loader;
        this._loader = undefined;
        if (loader) loader();
    }

    // Loaded while the module load is still deferred — nothing is pending, so the style can
    // settle. Once the load starts, not-loaded again until the real source is swapped in.
    loaded(): boolean {
        return this._loader !== undefined;
    }

    onAdd(_map: MapboxMap) {}

    onRemove(_map: MapboxMap) {}

    loadTile(_tile: Tile, _callback: Callback<undefined>) {}

    serialize(): SourceSpecification {
        return this._options;
    }

    /** @private */
    _setOption(name: 'tiles' | 'url' | 'minzoom' | 'maxzoom' | 'models', value: unknown): this {
        (this._options as Record<string, unknown>)[name] = value;
        return this;
    }
}

// Each placeholder has the same setters as its real source class, so a setter call gives the same
// result before and after a layer uses the source. `Style#addSource` creates the real source from
// `_options`, so the real source starts with these changes.
export class LazyRasterArraySource extends LazySource {
    setTiles(tiles: Array<string>): this {
        return this._setOption('tiles', tiles);
    }

    setUrl(url: string): this {
        return this._setOption('url', url);
    }

    setMinzoom(minzoom: number): this {
        return this._setOption('minzoom', minzoom);
    }

    setMaxzoom(maxzoom: number): this {
        return this._setOption('maxzoom', maxzoom);
    }
}

export class LazyModelSource extends LazySource {
    // No models load before the real source, so the placeholder casts no shadows.
    getModels(): Array<Model> {
        return [];
    }

    setModels(models: ModelSourceModelsSpecification): this {
        return this._setOption('models', models);
    }
}

/**
 * Creates the placeholder for a lazily-loaded source type. `batched-model` has no setters.
 *
 * @private
 */
export function createLazySource(id: string, options: SourceSpecification, dispatcher: Dispatcher, eventedParent: Evented): LazySource {
    switch (options.type) {
    case 'raster-array': return new LazyRasterArraySource(id, options, dispatcher, eventedParent);
    case 'model': return new LazyModelSource(id, options, dispatcher, eventedParent);
    default: return new LazySource(id, options, dispatcher, eventedParent);
    }
}

export default LazySource;
