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
import type {ColorSpecification, ModelMaterialOverrideSpecification, ModelNodeOverrideSpecification, ModelSourceModelSpecification, ModelSourceModelsSpecification, ModelSourceSpecification} from '../../src/style-spec/types';

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
    _abortController: AbortController | null;

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
        this._abortController = null;
    }

    private cancelModelRequests() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    private async loadGLTFFromURI(uri: string, signal?: AbortSignal): Promise<GLTF> {
        const request = await this.map._requestManager.transformRequest(uri, ResourceType.Model, signal);
        return loadGLTF(request.url, signal);
    }

    private async loadModel(modelId: string, modelSpec: ModelSourceModelSpecification, signal: AbortSignal): Promise<void> {
        try {
            const gltf = await this.loadGLTFFromURI(modelSpec.uri, signal);
            if (signal.aborted) return;

            const modelInfo = this._modelsInfo.get(modelId);
            if (!modelInfo) return; // source modified during async gap

            const nodes = convertModel(gltf);
            const currentSpec = modelInfo.modelSpec;
            const model = new Model(modelId, currentSpec.uri, currentSpec.position, currentSpec.orientation, nodes);
            ModelSource.applyModelSpecification(model, currentSpec);
            model.computeBoundsAndApplyParent();

            this.models.push(model);
            modelInfo.model = model;
        } catch (err: unknown) {
            if (signal.aborted) return;
            this.fire(new ErrorEvent(new Error(`Could not load model ${modelId} from ${modelSpec.uri}`, {cause: err})));
        }
    }

    async load(): Promise<void> {
        if (!this._abortController) {
            this._abortController = new AbortController();
        }
        const signal = this._abortController.signal;

        const loadPromises: Promise<void>[] = [];

        for (const modelId in this._options.models) {
            const modelSpec = this._options.models[modelId];

            const existingInfo = this._modelsInfo.get(modelId);
            if (existingInfo && existingInfo.model) {
                existingInfo.modelSpec = modelSpec;
                const model = existingInfo.model;
                model.position = modelSpec.position != null ? new LngLat(modelSpec.position[0], modelSpec.position[1]) : new LngLat(0, 0);
                model.orientation = modelSpec.orientation != null ? modelSpec.orientation : [0, 0, 0];
                ModelSource.applyModelSpecification(model, modelSpec);
                model.computeBoundsAndApplyParent();
                this.models.push(model);
            } else if (!existingInfo) {
                this._modelsInfo.set(modelId, {modelSpec, model: null});
                loadPromises.push(this.loadModel(modelId, modelSpec, signal));
            } else {
                existingInfo.modelSpec = modelSpec;
            }
        }

        if (loadPromises.length === 0) {
            if (this.loaded()) {
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
            }
            return;
        }

        await Promise.allSettled(loadPromises);

        if (signal.aborted) return; // new load will fire data event
        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
    }

    private static arrayFromColorSpecification(colorSpec: ColorSpecification | undefined) : [number, number, number] | undefined {
        const colorValue = colorSpec as number[] | string | undefined;
        if (colorValue === undefined) return undefined;
        if (Array.isArray(colorValue)) {
            return [colorValue[0], colorValue[1], colorValue[2]];
        }
        const convertedColor = Color.parse(colorValue);
        if (convertedColor) {
            return [convertedColor.r, convertedColor.g, convertedColor.b];
        }
        return undefined;
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
        if (modelSpec['lightOverrides']) {
            const lo = modelSpec['lightOverrides'] as Record<string, unknown>;
            const ambientColor = ModelSource.arrayFromColorSpecification(lo['light-ambient-color'] as ColorSpecification | undefined);
            const directionalColor = ModelSource.arrayFromColorSpecification(lo['light-directional-color'] as ColorSpecification | undefined);

            model.lightOverrides = {
                ambientIntensity: lo['light-ambient-intensity'] as number | undefined,
                ambientColor,
                directionalIntensity: lo['light-directional-intensity'] as number | undefined,
                directionalColor,
            };
        } else {
            model.lightOverrides = undefined;
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
                orientation: [0, 0, 0],
                minZoom: undefined,
                maxZoom: undefined
            };

            if (Object.hasOwn(value, 'orientation')) {
                const orientation = value['orientation'] as Float32Array;
                if (orientation) {
                    nodeOverride.orientation = orientation;
                }
            }
            if (Object.hasOwn(value, 'minzoom')) {
                nodeOverride.minZoom = value['minzoom'] as number;
            }
            if (Object.hasOwn(value, 'maxzoom')) {
                nodeOverride.maxZoom = value['maxzoom'] as number;
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

            const modelColor = value['model-color'] as number[];
            const materialOverride: MaterialOverride = {
                color: modelColor !== undefined ? new Color(modelColor[0], modelColor[1], modelColor[2]) : new Color(1, 1, 1),
                colorMix: 0,
                emissionStrength: 0,
                opacity: 1.0
            };

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
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
        this.cancelModelRequests();
        const fqid = makeFQID(this.id, this.scope);
        this.map.style.clearSource(fqid);
        this.models = [];
        this._modelsInfo.clear();
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.load();
    }

    onRemove(_map: MapboxMap) {
        this.cancelModelRequests();
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
        this.models = [];

        const updatedModelsInfo = new Map<string, ModelSourceModelInfo>();
        for (const modelId in modelSpecs) {
            const modelSpec = modelSpecs[modelId];
            const entry = this._modelsInfo.get(modelId);
            if (entry && entry.modelSpec.uri === modelSpec.uri) {
                updatedModelsInfo.set(modelId, entry);
            }
        }

        // Only cancel requests when models are actually removed or URIs change.
        // Property-only updates (position, orientation) are high-frequency (animation)
        // and should not restart in-flight model loads.
        const modelsChanged = this._modelsInfo.size !== updatedModelsInfo.size;
        if (modelsChanged) {
            this.cancelModelRequests();
            // Remove pending entries - their cancelled requests won't complete
            for (const [id, info] of updatedModelsInfo) {
                if (!info.model) updatedModelsInfo.delete(id);
            }
        }

        this._modelsInfo = updatedModelsInfo;
        this._options.models = modelSpecs;
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.load();
    }
}

export default ModelSource;
