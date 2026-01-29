import {Evented, ErrorEvent, Event} from '../../src/util/evented';
import {ResourceType} from '../../src/util/ajax';
import Model, {type MaterialOverride, type NodeOverride} from '../data/model';
import convertModel from './model_loader';
import {loadGLTF, type GLTF} from '../util/loaders';
import Color from '../../src/style-spec/util/color';
import {makeFQID} from '../../src/util/fqid';
import LngLat from '../../src/geo/lng_lat';

import type Tile from '../../src/source/tile';
import type Dispatcher from '../../src/util/dispatcher';
import type {Map as MapboxMap} from '../../src/ui/map';
import type {Callback} from '../../src/types/callback';
import type {ISource, SourceEvents} from '../../src/source/source';
import type {ModelMaterialOverrideSpecification, ModelNodeOverrideSpecification, ModelSourceModelSpecification, ModelSourceModelsSpecification, ModelSourceSpecification} from '../../src/style-spec/types';

type ModelSourceModelInfo = {
    modelSpec: ModelSourceModelSpecification;
    model: Model | null;
};

/**
 * A source containing single models.
 * See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-model) for detailed documentation of options.
 *
 * @example
 * map.addSource('some id', {
 *   "type": "model",
 *   "models": {
 *     "ego-car" : {
 *          "uri": "car.glb",
 *          "position": [-74.0135, 40.7153],
 *          "orientation": [0, 0, 0],
 *          "materialOverrides": {
 *            "body": {
 *              "model-color": [0.00775, 0.03458, 0.43854],
 *              "model-color-mix-intensity": 1.0
 *            }
 *          },
 *          "nodeOverrides": {
 *            "doors_front-left": {
 *              "orientation": [0.0, -45.0, 0.0]
 *            }
 *          }
 *      }
 *   }
 * });
 *
 */
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
    map: MapboxMap;
    uri: string;
    models: Array<Model>;
    _options: ModelSourceSpecification;

    onRemove: undefined;
    abortTile: undefined;
    unloadTile: undefined;
    hasTile: undefined;
    prepare: undefined;
    afterUpdate: undefined;
    _clear: undefined;
    _modelsInfo: Map<string, ModelSourceModelInfo>;

    /**
     * @private
     */
    constructor(id: string, options: ModelSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'model';
        this.models = [];
        this._options = options;
        this._modelsInfo = new Map();
    }

    private loadGLTFFromURI(uri: string): Promise<void | GLTF> {
        return loadGLTF(this.map._requestManager.transformRequest(uri, ResourceType.Model).url);
    }

    load(): void {
        for (const modelId in this._options.models) {
            const modelSpec = this._options.models[modelId];

            const modelInfo = this._modelsInfo.get(modelId);
            if (modelInfo) {
                modelInfo.modelSpec = modelSpec;
                // Update model if loaded
                const model = modelInfo.model;
                if (model) {
                    model.position = modelSpec.position != null ? new LngLat(modelSpec.position[0], modelSpec.position[1]) : new LngLat(0, 0);
                    model.orientation = modelSpec.orientation != null ? modelSpec.orientation : [0, 0, 0];
                    ModelSource.applyModelSpecification(model, modelSpec);
                    model.computeBoundsAndApplyParent();
                    this.models.push(model);
                }
            } else {
                // Model neither currently loading nor already loaded
                this._modelsInfo.set(modelId, {modelSpec, model: null});
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.loadModel(modelId, modelSpec);
            }
        }
        // Fire data event if all models are already loaded (i.e model source is empty or there are no more requests pending)
        if (this.loaded()) {
            this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
        }
    }

    private async loadModel(modelId: string, modelSpec: ModelSourceModelSpecification): Promise<void> {
        try {
            const gltf = await this.loadGLTFFromURI(modelSpec.uri);
            if (!gltf) return;

            // Check if model is still active
            const modelInfo = this._modelsInfo.get(modelId);
            if (!modelInfo) return;

            const nodes = convertModel(gltf);
            const currentModelSpec = modelInfo.modelSpec;
            const model = new Model(modelId, currentModelSpec.uri, currentModelSpec.position, currentModelSpec.orientation, nodes);
            ModelSource.applyModelSpecification(model, currentModelSpec);
            model.computeBoundsAndApplyParent();

            this.models.push(model);
            modelInfo.model = model;

            // If all models are loaded, fire data event
            if (this.loaded()) {
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
            }
        } catch (err) {

            this.fire(new ErrorEvent(new Error(`Could not load model ${modelId} from ${modelSpec.uri}: ${(err as Error).message}`)));
        }
    }

    private static applyModelSpecification(model: Model, modelSpec: ModelSourceModelSpecification) {
        if (modelSpec.nodeOverrides) {
            ModelSource.convertNodeOverrides(model, modelSpec.nodeOverrides);
        }
        if (modelSpec.materialOverrides) {
            ModelSource.convertMaterialOverrides(model, modelSpec.materialOverrides);
        }
        if (modelSpec.nodeOverrideNames) {
            model.nodeOverrideNames = [...modelSpec.nodeOverrideNames];
        }
        if (modelSpec.materialOverrideNames) {
            model.materialOverrideNames = [...modelSpec.materialOverrideNames];
        }
        if (modelSpec.featureProperties) {
            model.featureProperties = modelSpec.featureProperties as Record<string, unknown>;
        }
    }

    private static convertNodeOverrides(model: Model, overrides: ModelNodeOverrideSpecification) {
        // Legacy support: Previously, 'nodeOverrides' allowed both direct property overrides and specifying
        // node names to be overridden via feature states. The latter is now handled explicitly with 'nodeOverrideNames'.
        // This block maintains compatibility with older styles.
        if (Array.isArray(overrides) && overrides.every(item => typeof item === 'string')) {
            model.nodeOverrideNames = [];
            for (const nodeName of overrides) {
                model.nodeOverrideNames.push(nodeName as string);
            }
            return;
        }
        Object.entries(overrides).forEach(([key, value]) => {

            const nodeOverride: NodeOverride = {
                orientation: [0, 0, 0]
            };

            if (value.hasOwnProperty('orientation')) {
                const orientation = value['orientation'] as Float32Array;
                if (orientation) {
                    nodeOverride.orientation = orientation;
                }
            }

            model.nodeOverrides.set(key, nodeOverride);
        });
    }

    private static convertMaterialOverrides(model: Model, overrides: ModelMaterialOverrideSpecification) {
        // Legacy support: Previously, 'materialOverrides' allowed both direct property overrides and specifying
        // material names to be overridden via feature states. The latter is now handled explicitly with 'materialOverrideNames'.
        // This block maintains compatibility with older styles.
        if (Array.isArray(overrides) && overrides.every(item => typeof item === 'string')) {
            model.materialOverrideNames = [];
            for (const materialName of overrides) {
                model.materialOverrideNames.push(materialName as string);
            }
            return;
        }
        Object.entries(overrides).forEach(([key, value]) => {

            const materialOverride: MaterialOverride = {
                color: new Color(1, 1, 1),
                colorMix: 0,
                emissionStrength: 0,
                opacity: 1.0
            };

            const modelColor = value['model-color'] as number[];
            if (modelColor !== undefined) {
                materialOverride.color.r = modelColor[0];
                materialOverride.color.g = modelColor[1];
                materialOverride.color.b = modelColor[2];
            }

            const modelColorMixIntensity = value['model-color-mix-intensity'] as number;
            if (modelColorMixIntensity !== undefined) {
                materialOverride.colorMix = modelColorMixIntensity;
            }

            const modelEmissiveStrength = value['model-emissive-strength'] as number;
            if (modelEmissiveStrength !== undefined) {
                materialOverride.emissionStrength = modelEmissiveStrength;
            }

            const modelOpacity = value['model-opacity'] as number;
            if (modelOpacity !== undefined) {
                materialOverride.opacity = modelOpacity;
            }

            model.materialOverrides.set(key, materialOverride);
        });
    }

    onAdd(map: MapboxMap) {
        this.map = map;
        this.load();
    }

    hasTransition(): boolean {
        return false;
    }

    loaded(): boolean {
        // Empty source is considered loaded
        if (this._modelsInfo.size === 0) return true;
        // If all info entries have a valid model, the source is considered fully loaded
        for (const info of this._modelsInfo.values()) {
            if (info.model === null || info.model === undefined) return false;
        }
        return true;
    }

    getModels(): Array<Model> {
        return this.models;
    }

    loadTile(tile: Tile, callback: Callback<undefined>) { }

    serialize(): ModelSourceSpecification {
        return this._options;
    }

    setProperty(property: string, value: unknown): boolean {
        return false;
    }

    reload() {
        const fqid = makeFQID(this.id, this.scope);
        this.map.style.clearSource(fqid);
        this.models = [];
        this._modelsInfo.clear();
        this.load();
    }

    /**
     * Sets the list of models along with their properties.
     *
     * Updates are efficient as long as the model URIs remain unchanged.
     * @param {ModelSourceModelsSpecification} modelSpecs Model specifications according to [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-model).
     * @example
     * map.getSource('some id').setModels({
     *     "model-1" : {
     *          "uri": "model_1.glb",
     *          "position": [-74.0135, 40.7153],
     *          "orientation": [0, 0, 0]
     *      }
     * });
     */
    setModels(modelSpecs: ModelSourceModelsSpecification) {
        // Mimic behavior of native `ModelSource::updateModelData` implementation
        this.models = [];

        // Only preserve model info entries for ids present in new model specification
        const updatedModelsInfo = new Map<string, ModelSourceModelInfo>();
        for (const modelId in modelSpecs) {
            const modelSpec = modelSpecs[modelId];
            if (this._modelsInfo.has(modelId)) {
                const entry = this._modelsInfo.get(modelId);
                // Only preserve if uri did not change
                if (entry && entry.modelSpec.uri === modelSpec.uri) {
                    updatedModelsInfo.set(modelId, entry);
                }
            }
        }
        this._modelsInfo = updatedModelsInfo;
        this._options.models = modelSpecs;
        this.load();
    }
}

export default ModelSource;
