import config from '../util/config';
import browser from '../util/browser';
import {getURLExtension} from '../util/url';
import {processTileJSON as parseTileJson} from './load_tilejson';

import type {TileJSON} from '../types/tilejson';
import type {RequestManager} from '../util/mapbox';
import type {RequestParameters} from '../util/ajax';
import type {SourceSpecification} from '../style-spec/types';
import type {Options as TileJsonParserOptions} from './load_tilejson';

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
 * Provider runs on the main thread for raster sources, in a Web Worker for
 * vector and raster-dem. Restrict to APIs available in both contexts (see
 * [worker-safe APIs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers))
 * for portability across source types.
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
    load?: (options: {request: RequestParameters}) => Promise<Partial<TileJSON>>;

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

export type TileProviderConstructor = new (options: Partial<SourceSpecification>) => TileProvider<ArrayBuffer>;

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

    config.TILE_PROVIDER_URLS[name] = browser.resolveURL(url);
}

const pendingLoads: Map<string, Promise<TileProviderConstructor>> = new Map();
const tileProviders: Map<string, TileProviderConstructor> = new Map();

/**
 * Dynamically imports a provider module and caches its class.
 * Deduplicates concurrent imports for the same provider.
 * On failure the pending entry is cleared so the next call retries —
 * a transient network error should not permanently poison the cache.
 * @private
 */
export async function loadTileProvider(name: string, url: string): Promise<TileProviderConstructor> {
    const cached = tileProviders.get(name);
    if (cached) return cached;

    const pending = pendingLoads.get(name);
    if (pending !== undefined) return pending;

    const load = import(/* @vite-ignore */ url)
        .catch((err) => {
            throw new Error(`TileProvider "${name}" failed to load: ${err instanceof Error ? err.message : String(err)}`);
        })
        .then((mod: {default?: TileProviderConstructor}) => {
            const TileProviderClass = mod.default;
            if (typeof TileProviderClass !== 'function') {
                throw new Error(`TileProvider "${name}" module must default-export a class`);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (typeof TileProviderClass.prototype.loadTile !== 'function') {
                throw new Error(`TileProvider "${name}" class must have a loadTile method`);
            }
            tileProviders.set(name, TileProviderClass);
            return TileProviderClass;
        })
        .finally(() => {
            pendingLoads.delete(name);
        });

    pendingLoads.set(name, load);
    return load;
}

/**
 * Resolves a tile provider by explicit name or by auto-detecting from a source URL extension.
 * Returns the provider name and resolved module URL, null if no provider applies, or an Error
 * when a provider was matched but its URL is invalid.
 *
 * @private
 */
export function resolveTileProvider(options: SourceSpecification & {provider?: string | false}): {name: string; url: string} | Error | null {
    if ('provider' in options && !options.provider) return null;

    let name = options.provider;
    if (!name && 'url' in options && options.url) {
        name = getURLExtension(options.url);
    }

    if (!name) return null;

    const rawUrl = config.TILE_PROVIDER_URLS[name];
    if (!rawUrl) return null;

    let url: string;
    try {
        url = new URL(rawUrl, config.API_URL).href;
    } catch (e) {
        return new Error(`TileProvider "${name}" has an invalid URL: "${rawUrl}"`);
    }

    return {name, url};
}

/**
 * Builds a TileJSON result from provider-returned metadata or falls back to
 * `options.tiles`. Returns an Error when neither source is available.
 * @private
 */
export function processTileJSON(options: TileJsonParserOptions, tileJSON: Partial<TileJSON> | null | undefined, requestManager: RequestManager): TileJSON | Error {
    if (tileJSON) {
        return parseTileJson(options, tileJSON, requestManager);
    }

    if (options.tiles && options.tiles.length > 0) {
        return {tiles: options.tiles} as TileJSON;
    }

    return new Error(`TileJSON is missing required "tiles" property`);
}
