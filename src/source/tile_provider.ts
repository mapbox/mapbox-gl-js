import config from '../util/config';

import type {TileJSON} from '../types/tilejson';
import type {RequestParameters} from '../util/ajax';
import type {SourceSpecification} from '../style-spec/types';

/**
 * Response returned by {@link TileProvider.loadTile}.
 *
 * @property {T} data - The raw tile payload.
 * @property {string} [expires] - Expires header value for tile caching.
 * @property {string} [cacheControl] - Cache-Control header value for tile caching.
 * @experimental This API is experimental and subject to change in future versions.
 * @private
 */
export type TileDataResponse<T> = {
    data: T;
    expires?: string;
    cacheControl?: string;
};

/**
 * Interface for a custom tile provider. Register a module URL with
 * {@link addTileProvider}, then reference it via `provider` in a source spec.
 * The module must default-export a class implementing this interface.
 *
 * The provider runs inside a Web Worker. Only
 * [worker-safe APIs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers) are available.
 * @experimental This API is experimental and subject to change in future versions.
 * @private
 *
 * @example
 * export default class MyTileProvider {
 *     constructor(options) {
 *         this.url = options.url;
 *     }
 *     async loadTile(tile, options) {
 *         const response = await fetch(options.request.url, {signal: options.signal});
 *         return {data: await response.arrayBuffer()};
 *     }
 *     async load(options) {
 *         const response = await fetch(this.url);
 *         return await response.json();
 *     }
 * }
 */
export interface TileProvider<T> {
    /**
     * Returns TileJSON metadata for the source. Called once during initialization
     * when the source has a `url` but no explicit `tiles`.
     *
     * @param options - Load options.
     * @param options.request - {@link RequestParameters} for the request.
     */
    load?: (options: {request: RequestParameters}) => Promise<TileJSON>;

    /**
     * Fetches raw tile data.
     *
     * @param {{ z: number, x: number, y: number }} tile Tile coordinates.
     * @param {Object} options Load options.
     * @param options.request - {@link RequestParameters} for the request.
     * @param options.signal - Abort signal for cancellation.
     * @returns {TileDataResponse | null | undefined} Tile data to render.
     * Return `{data: null}` for an intentionally empty tile.
     * Return nullish to overscale the parent tile.
     */
    loadTile: (tile: {z: number; x: number; y: number}, options: {request: RequestParameters; signal: AbortSignal}) => Promise<TileDataResponse<T | null> | null | undefined>;
}

export type TileProviderConstructor = new (options: SourceSpecification) => TileProvider<ArrayBuffer>;

/**
 * Registers a tile provider module URL by name. Call this **before** creating
 * the {@link Map} or adding sources that reference the provider. Re-registering
 * a name overwrites the previous URL but won't affect already-loaded workers.
 *
 * @param name - Provider name (e.g. `'pmtiles'`).
 * @param url - URL to an ES module that default-exports a {@link TileProvider} class.
 * @experimental This API is experimental and subject to change in future versions.
 * @private
 */
export function addTileProvider(name: string, url: string): void {
    if (!name || !url) {
        throw new Error('TileProvider name and URL are required');
    }

    config.TILE_PROVIDER_URLS[name] = url;
}
