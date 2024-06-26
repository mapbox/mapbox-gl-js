import {pick, extend} from '../util/util';

import {getJSON, ResourceType} from '../util/ajax';
import browser from '../util/browser';

import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';
import type {TileJSON} from '../types/tilejson';
import type {Cancelable} from '../types/cancelable';
import type {SourceSpecification} from '../style-spec/types';
import type {SourceVectorLayer, SourceRasterLayer} from './source';

type ExtendedTileJSON = TileJSON & {
    vectorLayers?: Array<SourceVectorLayer>;
    vectorLayerIds?: Array<string>;
    rasterLayers?: Array<SourceRasterLayer>;
    rasterLayerIds?: Array<string>;
};

type TileJSONLike = {url?: string, tiles?: Array<string>};
type Options = Extract<SourceSpecification, TileJSONLike> & TileJSONLike;

export default function(
    options: Options,
    requestManager: RequestManager,
    language: string | null | undefined,
    worldview: string | null | undefined,
    callback: Callback<ExtendedTileJSON>,
): Cancelable {
    const loaded = function(err?: Error | null, tileJSON?: Partial<TileJSON>) {
        if (err) {
            return callback(err);
        } else if (tileJSON) {
            // Prefer TileJSON tiles, if both URL and tiles options are set
            if (options.url && tileJSON.tiles && options.tiles) delete options.tiles;
            // check if we have variants and merge with the original TileJson
            if (tileJSON.variants) {
                if (!Array.isArray(tileJSON.variants)) {
                    return callback(new Error("variants must be an array"));
                }
                for (const variant of tileJSON.variants) {
                    if (variant == null || typeof variant !== 'object' || variant.constructor !== Object) {
                        return callback(new Error("variant must be an object"));
                    }
                    if (!Array.isArray(variant.capabilities)) {
                        return callback(new Error("capabilities must be an array"));
                    }
                    // in this version we only support meshopt, we check there is no more different capabilities
                    // so future tileJsons with more capabilities won't break existing sdk's
                    if (variant.capabilities.length === 1 && variant.capabilities[0] === "meshopt") {
                        tileJSON = extend(tileJSON, variant);
                        break;
                    }
                }
            }

            const result = pick(
                // explicit source options take precedence over TileJSON
                extend(tileJSON, options),
                ['tilejson', 'tiles', 'minzoom', 'maxzoom', 'attribution', 'mapbox_logo', 'bounds', 'scheme', 'tileSize', 'encoding']
            ) as ExtendedTileJSON;

            if (tileJSON.vector_layers) {
                result.vectorLayers = tileJSON.vector_layers;
                result.vectorLayerIds = result.vectorLayers.map((layer) => { return layer.id; });
            }

            if (tileJSON.raster_layers) {
                result.rasterLayers = tileJSON.raster_layers;
                result.rasterLayerIds = result.rasterLayers.map((layer) => { return layer.id; });
            }

            result.tiles = requestManager.canonicalizeTileset(result, options.url);
            callback(null, result);
        }
    };

    if (options.url) {
        // @ts-expect-error - TS2345 - Argument of type 'string' is not assignable to parameter of type '"Unknown" | "Style" | "Source" | "Tile" | "Glyphs" | "SpriteImage" | "SpriteJSON" | "Image" | "Model"'.
        return getJSON(requestManager.transformRequest(requestManager.normalizeSourceURL(options.url, null, language, worldview), ResourceType.Source), loaded);
    } else {
        return browser.frame(() => loaded(null, options));
    }
}
