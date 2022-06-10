// @flow

import {pick, extend} from '../util/util.js';

import {getJSON, ResourceType} from '../util/ajax.js';
import browser from '../util/browser.js';

import type {RequestManager} from '../util/mapbox.js';
import type {Callback} from '../types/callback.js';
import type {TileJSON} from '../types/tilejson.js';
import type {Cancelable} from '../types/cancelable.js';

export default function(options: any, requestManager: RequestManager, language: ?string, worldview: ?string, callback: Callback<TileJSON>): Cancelable {
    const loaded = function(err: ?Error, tileJSON: ?Object) {
        if (err) {
            return callback(err);
        } else if (tileJSON) {
            const result: any = pick(
                // explicit source options take precedence over TileJSON, except for language and worldview
                extend(tileJSON, extend({}, options, pick(tileJSON, ['language', 'worldview']))),
                ['tiles', 'minzoom', 'maxzoom', 'attribution', 'mapbox_logo', 'bounds', 'scheme', 'tileSize', 'encoding']
            );

            if (tileJSON.vector_layers) {
                result.vectorLayers = tileJSON.vector_layers;
                result.vectorLayerIds = result.vectorLayers.map((layer) => { return layer.id; });
            }

            if (tileJSON.language && tileJSON.id && tileJSON.language[tileJSON.id]) {
                result.language = tileJSON.language[tileJSON.id];
            }

            if (tileJSON.worldview && tileJSON.id && tileJSON.worldview[tileJSON.id]) {
                result.worldview = tileJSON.worldview[tileJSON.id];
            }

            result.tiles = requestManager.canonicalizeTileset(result, options.url);
            callback(null, result);
        }
    };

    if (options.url) {
        return getJSON(requestManager.transformRequest(requestManager.normalizeSourceURL(options.url, null, language, worldview), ResourceType.Source), loaded);
    } else {
        return browser.frame(() => loaded(null, options));
    }
}
