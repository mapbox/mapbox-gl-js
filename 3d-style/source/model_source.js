// @flow

import {Evented} from '../../src/util/evented.js';
import type {Source} from '../../src/source/source.js';
import type Tile from '../../src/source/tile.js';
import type {Callback} from '../../src/types/callback.js';
import type Dispatcher from '../../src/util/dispatcher.js';
import type Map from '../../src/ui/map.js';
import type {ModelSourceSpecification} from '../../src/style-spec/types.js';
import MercatorCoordinate from '../../src/geo/mercator_coordinate.js';

import {load} from '@loaders.gl/core';
import {GLTFLoader} from '@loaders.gl/gltf';


class Model {
    uri: string;
    position: MercatorCoordinate;
    orientation: [number, number, number];


    constructor (uri: string, position: MercatorCoordinate, orientation: [number, number, number]) {
        this.uri = uri;
        this.position = position;
        this.orientation = orientation;
    }
}

/**
 * A source containing single models.
 */
// Important Note: ModelSource is legacy and should not be offered in the API, as the only valid official sources to add models
// are batched-models and via GeoJson/vector sources. We keep this one (for now) just for ease development and get the render-tests
// passing.
class ModelSource extends Evented implements Source {
    type: 'model';
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    map: Map;
    uri: string;
    models: Array<Model>;
    _options : ModelSourceSpecification;
    _loaded: boolean;
    /**
     * @private
     */
    constructor(id: string, options: ModelSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'model';
        this.models = [];
        this._loaded = false;
        this._options = options;
    }

    async load() {
        /* $FlowIgnore[prop-missing] we don't need the full spec of model_source as it's only used for testing*/
         for (const modelId in this._options.models) {
            const model = this._options.models[modelId];
            const gltf = await load(model.uri, GLTFLoader);
            console.log(gltf);
        }
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    hasTransition(): boolean {
        return false;
    }
    loaded(): boolean {
        return this._loaded;
    }

    loadTile(tile: Tile, callback: Callback<void>) {}

    serialize(): Object {
        return {
            type: 'model'
        };
    }
}

export default ModelSource;
