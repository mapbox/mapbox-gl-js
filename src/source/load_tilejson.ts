import {pick, extend} from '../util/util';

import {getJSON, ResourceType} from '../util/ajax';
import browser from '../util/browser';

import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';
import type {TileJSON} from '../types/tilejson';
import type {Cancelable} from '../types/cancelable';
import type {SourceVectorLayer, SourceRasterLayer} from './source';

type ExtendedTileJSON = TileJSON & {
    vectorLayers?: Array<SourceVectorLayer>;
    vectorLayerIds?: Array<string>;
    rasterLayers?: Array<SourceRasterLayer>;
    rasterLayerIds?: Array<string>;
};

export default function(
    options: any,
    requestManager: RequestManager,
    language: string | null | undefined,
    worldview: string | null | undefined,
    callback: Callback<ExtendedTileJSON>,
): Cancelable {
    const loaded = function(err?: Error | null, tileJSON?: TileJSON | null) {
        if (err) {
            return callback(err);
        } else if (tileJSON) {
            // Prefer TileJSON tiles, if both URL and tiles options are set
            if (options.url && tileJSON.tiles && options.tiles) delete options.tiles;

            const result: ExtendedTileJSON = pick(
                // explicit source options take precedence over TileJSON
                extend(tileJSON, options),
                ['tiles', 'minzoom', 'maxzoom', 'attribution', 'mapbox_logo', 'bounds', 'scheme', 'tileSize', 'encoding']
            );

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
