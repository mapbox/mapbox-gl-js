// @flow

import {Evented, ErrorEvent, Event} from '../../src/util/evented.js';
import {ResourceType} from '../../src/util/ajax.js';

import Model from '../data/model.js';
import convertModel from './model_loader.js';
import {loadGLTF} from '../util/loaders.js';

import type {Source} from '../../src/source/source.js';
import type Tile from '../../src/source/tile.js';
import type {Callback} from '../../src/types/callback.js';
import type Dispatcher from '../../src/util/dispatcher.js';
import type {Map} from '../../src/ui/map.js';
import type {ModelSourceSpecification} from '../../src/style-spec/types.js';

/**
 * A source containing single models.
 */
// Important Note: ModelSource is legacy and should not be offered in the API, as the only valid official sources to add models
// are batched-models and via GeoJson/vector sources. We keep this one (for now) just for ease development and get the render-tests
// passing.
class ModelSource extends Evented implements Source {
    type: 'model';
    id: string;
    scope: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    map: Map;
    uri: string;
    models: Array<Model>;
    _options: ModelSourceSpecification;
    _loaded: boolean;
    /**
     * @private
     */
    // eslint-disable-next-line no-unused-vars
    constructor(id: string, options: ModelSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'model';
        this.models = [];
        this._loaded = false;
        this._options = options;
    }

    load(): Promise<void> {
        const modelPromises = [];

        /* $FlowIgnore[prop-missing] we don't need the full spec of model_source as it's only used for testing */
        for (const modelId in this._options.models) {
            const modelSpec = this._options.models[modelId];

            const modelPromise = loadGLTF(this.map._requestManager.transformRequest(modelSpec.uri, ResourceType.Model).url).then(gltf => {
                if (!gltf) return;
                const nodes = convertModel(gltf);
                const model = new Model(modelId, modelSpec.position, modelSpec.orientation, nodes);
                model.computeBoundsAndApplyParent();
                this.models.push(model);
            }).catch((err) => {
                this.fire(new ErrorEvent(new Error(`Could not load model ${modelId} from ${modelSpec.uri}: ${err.message}`)));
            });

            modelPromises.push(modelPromise);
        }

        return Promise.allSettled(modelPromises).then(() => {
            this._loaded = true;
            this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
        }).catch((err) => {
            this.fire(new ErrorEvent(new Error(`Could not load models: ${err.message}`)));
        });
    }

    // $FlowFixMe[method-unbinding]
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

    getModels(): Array<Model> {
        return this.models;
    }
    // eslint-disable-next-line no-unused-vars
    loadTile(tile: Tile, callback: Callback<void>) {}

    serialize(): Object {
        return {
            type: 'model'
        };
    }
}

export default ModelSource;
