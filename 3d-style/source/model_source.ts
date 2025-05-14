import {Evented, ErrorEvent, Event} from '../../src/util/evented';
import {ResourceType} from '../../src/util/ajax';
import Model from '../data/model';
import convertModel from './model_loader';
import {loadGLTF} from '../util/loaders';

import type Tile from '../../src/source/tile';
import type Dispatcher from '../../src/util/dispatcher';
import type {Map} from '../../src/ui/map';
import type {Callback} from '../../src/types/callback';
import type {ISource, SourceEvents} from '../../src/source/source';
import type {ModelSourceSpecification} from '../../src/style-spec/types';

/**
 * A source containing single models.
 */
// Important Note: ModelSource is legacy and should not be offered in the API, as the only valid official sources to add models
// are batched-models and via GeoJson/vector sources. We keep this one (for now) just for ease development and get the render-tests
// passing.
class ModelSource extends Evented<SourceEvents> implements ISource {
    type: 'model';
    id: string;
    scope: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    minTileCacheSize?: number;
    maxTileCacheSize?: number;
    roundZoom: boolean | undefined;
    reparseOverscaled: boolean | undefined;
    attribution: string | undefined;
    // eslint-disable-next-line camelcase
    mapbox_logo: boolean | undefined;
    vectorLayers?: never;
    vectorLayerIds?: never;
    rasterLayers?: never;
    rasterLayerIds?: never;
    map: Map;
    uri: string;
    models: Array<Model>;
    _options: ModelSourceSpecification;
    _loaded: boolean;

    onRemove: undefined;
    reload: undefined;
    abortTile: undefined;
    unloadTile: undefined;
    hasTile: undefined;
    prepare: undefined;
    afterUpdate: undefined;
    _clear: undefined;

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

    load(): void {
        const modelPromises = [];

        // @ts-expect-error - TS2339 - Property 'models' does not exist on type 'ModelSourceSpecification'.
        for (const modelId in this._options.models) {
            // @ts-expect-error - TS2339 - Property 'models' does not exist on type 'ModelSourceSpecification'.
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

        Promise.allSettled(modelPromises).then(() => {
            this._loaded = true;
            this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
        }).catch((err) => {
            this._loaded = true;
            this.fire(new ErrorEvent(new Error(`Could not load models: ${err.message}`)));
        });
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

    getModels(): Array<Model> {
        return this.models;
    }

    loadTile(tile: Tile, callback: Callback<undefined>) {}

    serialize(): ModelSourceSpecification {
        return this._options;
    }
}

export default ModelSource;
