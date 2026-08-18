import {pick} from '../util/util';
import {getJSON, ResourceType} from '../util/ajax';
import browser from '../util/browser';

import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';
import type {TileJSON} from '../types/tilejson';
import type {Cancelable} from '../types/cancelable';
import type {RequestParameters} from '../util/ajax';
import type {SourceSpecification} from '../style-spec/types';

export type TileJSONLike = {url?: string, tiles?: Array<string>};

export type Options = Extract<SourceSpecification, TileJSONLike> & TileJSONLike & {
    data?: TileJSON
};

/**
 * Computes the transformed request URL and provider options from source options.
 * @private
 */
export async function parseTileJSONRequest(source: TileJSONLike, requestManager: RequestManager, signal?: AbortSignal): Promise<{options: TileJSONLike; request?: RequestParameters}> {
    const request = (source.url && !source.tiles) ?
        await requestManager.transformRequest(source.url, ResourceType.Source, signal) :
        undefined;

    const options: TileJSONLike = request ?
        ({...source, url: request.url}) :
        source;

    return {request, options};
}

function getInlinedTileJSON(data?: TileJSON, language?: string, worldview?: string): TileJSON | undefined | null {
    if (!data) {
        return null;
    }

    if (!language && !worldview) {
        return data;
    }

    worldview = worldview || data.worldview_default;

    const tileJSONLanguages = Object.values(data.language || {});

    if (tileJSONLanguages.length === 0) {
        return null;
    }

    const tileJSONWorldviews = Object.values(data.worldview || {});

    if (tileJSONWorldviews.length === 0) {
        return null;
    }

    const isLanguageMatched = tileJSONLanguages.every(lang => lang === language);
    const isWorldviewMatched = tileJSONWorldviews.every(vw => vw === worldview);

    if (isLanguageMatched && isWorldviewMatched) {
        return data;
    }

    // If we don't support this language and worldview in TileJSON
    // or in the same time some of them is not defined
    // we can safely use inlined default
    if (!(language in (data.language_options || {})) && !(worldview in (data.worldview_options || {}))) {
        // There is exception for empty language or worldview options:
        // If we don't have any language or worldview options
        // we should always request TileJSON
        if (!data.language_options || !data.worldview_options) {
            return null;
        }

        return data;
    }

    return null;
}

/**
 * Merges matching variant properties into the TileJSON.
 * Supports "meshopt" and "meshopt-v2+lod" capabilities; prefers "meshopt-v2+lod" when both are present.
 * A variant is only selected when its capabilities array contains exactly one recognized value,
 * so future TileJSONs advertising unknown capabilities won't break existing SDKs.
 * Throws on malformed variant data.
 * @private
 */
export function mergeVariants(tileJSON: Partial<TileJSON>): Partial<TileJSON> {
    if (!tileJSON.variants) return tileJSON;
    if (!Array.isArray(tileJSON.variants)) {
        throw new Error("variants must be an array");
    }
    let meshoptVariant: (typeof tileJSON.variants)[0] | null = null;
    let meshoptLodVariant: (typeof tileJSON.variants)[0] | null = null;
    for (const variant of tileJSON.variants) {
        if (variant == null || typeof variant !== 'object' || variant.constructor !== Object) {
            throw new Error("variant must be an object");
        }
        if (!Array.isArray(variant.capabilities)) {
            throw new Error("capabilities must be an array");
        }
        if (variant.capabilities.length === 1) {
            if (variant.capabilities[0] === "meshopt-v2+lod") {
                meshoptLodVariant = variant;
            } else if (variant.capabilities[0] === "meshopt") {
                meshoptVariant = variant;
            }
        }
    }
    const selected = meshoptLodVariant !== null ? meshoptLodVariant : meshoptVariant;
    if (selected !== null) {
        return Object.assign(tileJSON, selected);
    }
    return tileJSON;
}

/**
 * Post-processes raw TileJSON: merges variants, picks relevant fields,
 * and canonicalizes tile URLs. Does not mutate `options`.
 * Returns an Error if variant data is malformed.
 * @private
 */
export function processTileJSON(options: Options, tileJSON: Partial<TileJSON>, requestManager: RequestManager): TileJSON | Error {
    try {
        tileJSON = mergeVariants(tileJSON);
    } catch (e) {
        return new Error('Failed to process TileJSON variants', {cause: e});
    }

    const result: TileJSON = pick(
        // explicit source options take precedence over TileJSON
        {...tileJSON as TileJSON, ...options},
        ['tilejson', 'tiles', 'minzoom', 'maxzoom', 'attribution', 'mapbox_logo', 'bounds', 'extra_bounds', 'scheme', 'tileSize', 'encoding', 'vector_layers', 'raster_layers', 'worldview_options', 'worldview_default', 'worldview']
    );

    // Prefer TileJSON tiles when both url and tiles are set.
    if (options.url && tileJSON.tiles && options.tiles) {
        result.tiles = tileJSON.tiles;
    }

    result.tiles = requestManager.canonicalizeTileset(result, options.url);
    return result;
}

/**
 * @private
 */
export default function loadTileJSON(
    options: Options,
    requestManager: RequestManager,
    language: string | null | undefined,
    worldview: string | null | undefined,
    callback: Callback<TileJSON>,
): Cancelable {
    const loaded = function (err?: Error | null, tileJSON?: Partial<TileJSON>) {
        if (err) {
            return callback(err);
        } else if (tileJSON) {
            // Prefer TileJSON tiles: delete from options so serialize() reflects the change.
            // processTileJSON also handles this for callers that don't mutate options.
            if (options.url && tileJSON.tiles && options.tiles) delete options.tiles;

            const result = processTileJSON(options, tileJSON, requestManager);
            if (result instanceof Error) {
                return callback(result);
            }
            callback(null, result);
        }
    };

    const inlinedTileJSON = getInlinedTileJSON(options.data, language, worldview);

    if (inlinedTileJSON) {
        return browser.frame(() => loaded(null, inlinedTileJSON));
    }

    if (options.url) {
        const controller = new AbortController();
        const load = async () => {
            const requestParameters = await requestManager.transformRequest(requestManager.normalizeSourceURL(options.url, null, language, worldview), ResourceType.Source, controller.signal);
            const {data} = await getJSON<Partial<TileJSON>>(requestParameters, controller.signal);
            loaded(null, data);
        };
        load().catch((err: Error) => { if (!controller.signal.aborted) loaded(err); });
        return {cancel: () => controller.abort()};
    } else {
        return browser.frame(() => {
            const {data, ...tileJSON} = options;
            loaded(null, tileJSON);
        });
    }
}
