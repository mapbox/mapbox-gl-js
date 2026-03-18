import {pick} from '../util/util';
import {getJSON, ResourceType} from '../util/ajax';
import browser from '../util/browser';

import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';
import type {TileJSON} from '../types/tilejson';
import type {Cancelable} from '../types/cancelable';
import type {SourceSpecification} from '../style-spec/types';

type TileJSONLike = {url?: string, tiles?: Array<string>};
type Options = Extract<SourceSpecification, TileJSONLike> & TileJSONLike & {
    data?: TileJSON
};

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
 * Currently only supports the "meshopt" capability.
 * Throws on malformed variant data.
 * @private
 */
export function mergeVariants(tileJSON: Partial<TileJSON>): Partial<TileJSON> {
    if (!tileJSON.variants) return tileJSON;
    if (!Array.isArray(tileJSON.variants)) {
        throw new Error("variants must be an array");
    }
    for (const variant of tileJSON.variants) {
        if (variant == null || typeof variant !== 'object' || variant.constructor !== Object) {
            throw new Error("variant must be an object");
        }
        if (!Array.isArray(variant.capabilities)) {
            throw new Error("capabilities must be an array");
        }
        // In this version we only support meshopt; check there are no other capabilities
        // so future TileJSONs with more capabilities won't break existing SDKs
        if (variant.capabilities.length === 1 && variant.capabilities[0] === "meshopt") {
            return Object.assign(tileJSON, variant);
        }
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
        Object.assign({}, tileJSON as TileJSON, options),
        ['tilejson', 'tiles', 'minzoom', 'maxzoom', 'attribution', 'mapbox_logo', 'bounds', 'extra_bounds', 'scheme', 'tileSize', 'encoding', 'vector_layers', 'raster_layers', 'worldview_options', 'worldview_default', 'worldview']
    );

    // Prefer TileJSON tiles when both url and tiles are set.
    // In loadTileJSON, options.tiles is already deleted before this runs.
    // This handles callers (like _loadWithProvider) that don't mutate options.
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
        return getJSON(requestManager.transformRequest(requestManager.normalizeSourceURL(options.url, null, language, worldview), ResourceType.Source), loaded);
    } else {
        return browser.frame(() => {
            const {data, ...tileJSON} = options;
            loaded(null, tileJSON);
        });
    }
}
