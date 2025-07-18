import {Event, ErrorEvent, Evented} from '../../src/util/evented';
import Model from '../data/model';
import convertModel from '../source/model_loader';
import {ResourceType} from '../../src/util/ajax';
import {loadGLTF} from '../util/loaders';
import {isValidUrl} from '../../src/style-spec/validate/validate_model';

import type {RequestManager} from '../../src/util/mapbox';
import type Painter from '../../src/render/painter';
import type {ModelsSpecification} from '../../src/style-spec/types';
import type {StyleModelMap} from '../../src/style/style_mode';

// Keep the number of references to each model
// to avoid deleting models in use
type ReferencedModel = {
    model: Model;
    numReferences: number;
};

class ModelManager extends Evented {
    models: {
        [scope: string]: {
            [id: string]: ReferencedModel;
        };
    };
    modelUris: {
        [scope: string]: {
            [id: string]: string;
        }
    };
    numModelsLoading: {
        [scope: string]: number;
    };
    requestManager: RequestManager;
    modelByURL: Record<string, {modelId: string, scope: string}>;

    constructor(requestManager: RequestManager) {
        super();
        this.requestManager = requestManager;
        this.models = {'': {}};
        this.modelUris = {'': {}};
        this.modelByURL = {};
        this.numModelsLoading = {};
    }

    loadModel(id: string, url: string): Promise<Model | null | undefined> {
        return loadGLTF(this.requestManager.transformRequest(url, ResourceType.Model).url)
            .then(gltf => {
                if (!gltf) return;

                const nodes = convertModel(gltf);
                const model = new Model(id, undefined, undefined, nodes);
                model.computeBoundsAndApplyParent();
                return model;
            })
            .catch((err) => {
                if (err && err.status === 404) {
                    return null;
                }
                this.fire(new ErrorEvent(new Error(`Could not load model ${id} from ${url}: ${err.message}`)));
            });
    }

    load(modelUris: {
        [key: string]: string;
    }, scope: string,
    options: {forceReload: boolean} = {forceReload: false}) {
        if (!this.models[scope]) this.models[scope] = {};

        const modelIds = Object.keys(modelUris);

        const modelLoads: Promise<Model | null | undefined>[] = [];
        const idsToLoad = [];
        for (const modelId of modelIds) {
            const modelURI = modelUris[modelId];
            if (!this.hasURLBeenRequested(modelURI) || options.forceReload) {
                this.modelByURL[modelURI] = {modelId, scope};
                modelLoads.push(this.loadModel(modelId, modelURI));
                idsToLoad.push(modelId);
            }
            if (!this.models[scope][modelId]) {
                this.models[scope][modelId] = {model: null, numReferences: 1};
            }
        }

        this.numModelsLoading[scope] = (this.numModelsLoading[scope] || 0) + idsToLoad.length;

        Promise.allSettled(modelLoads)
            .then(results => {
                for (let i = 0; i < results.length; i++) {
                    const {status} = results[i];
                    if (status === 'rejected') continue;
                    const {value} = results[i] as PromiseFulfilledResult<Model>;
                    if (!this.models[scope][idsToLoad[i]]) {
                        // Before promises getting resolved, models could have been deleted
                        this.models[scope][idsToLoad[i]] = {model: null, numReferences: 1};
                    }
                    this.models[scope][idsToLoad[i]].model = value;
                }
                this.numModelsLoading[scope] -= idsToLoad.length;
                this.fire(new Event('data', {dataType: 'style'}));
            })
            .catch((err) => {
                this.fire(new ErrorEvent(new Error(`Could not load models: ${err.message}`)));
            });
    }

    isLoaded(): boolean {
        for (const scope in this.numModelsLoading) {
            if (this.numModelsLoading[scope] > 0) return false;
        }
        return true;
    }

    hasModel(id: string, scope: string, options: {exactIdMatch: boolean} = {exactIdMatch: false}): boolean {
        return !!(options.exactIdMatch ? this.getModel(id, scope) : this.getModelByURL(this.modelUris[scope][id]));
    }

    getModel(id: string, scope: string): Model | null | undefined {
        if (!this.models[scope]) this.models[scope] = {};
        return this.models[scope][id] ? this.models[scope][id].model : undefined;
    }

    getModelByURL(modelURL: string): Model | null | undefined {
        if (!modelURL) return null;

        const referencedModel = this.modelByURL[modelURL];
        if (!referencedModel) return null;

        return this.models[referencedModel.scope][referencedModel.modelId].model;
    }

    hasModelBeenAdded(id: string, scope: string): boolean {
        return (this.models[scope] && this.models[scope][id] !== undefined);
    }

    getModelURIs(scope: string): StyleModelMap {
        return this.modelUris[scope] || {};
    }

    addModel(id: string, url: string, scope: string) {
        if (!this.models[scope]) this.models[scope] = {};
        if (!this.modelUris[scope]) this.modelUris[scope] = {};

        const normalizedModelURL = this.requestManager.normalizeModelURL(url);

        if ((this.hasModel(id, scope, {exactIdMatch: true}) || this.hasModelBeenAdded(id, scope)) && (this.modelUris[scope][id] === normalizedModelURL)) {
            this.models[scope][id].numReferences++;
        } else if (this.hasURLBeenRequested(normalizedModelURL)) {
            const {scope, modelId} = this.modelByURL[normalizedModelURL];
            this.models[scope][modelId].numReferences++;
        } else {
            // If it's the first time we see this URL, we load it
            this.modelUris[scope][id] = normalizedModelURL;
            this.load({[id]: this.modelUris[scope][id]}, scope);
        }
    }

    addModelURLs(modelsToAdd: ModelsSpecification, scope: string) {
        if (!this.models[scope]) this.models[scope] = {};
        if (!this.modelUris[scope]) this.modelUris[scope] = {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modelUris: Record<string, any> = this.modelUris[scope];
        for (const modelId in modelsToAdd) {
            const modelUri = modelsToAdd[modelId];
            modelUris[modelId] = this.requestManager.normalizeModelURL(modelUri);
        }
    }

    reloadModels(scope: string) {
        this.load(this.modelUris[scope], scope, {forceReload: true});
    }

    addModelsFromBucket(modelIds: Array<string>, scope: string) {
        if (!this.models[scope]) this.models[scope] = {};
        if (!this.modelUris[scope]) this.modelUris[scope] = {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modelsRequests: Record<string, any> = {};
        for (const modelId of modelIds) {
            if (this.hasModel(modelId, scope, {exactIdMatch: true}) || this.hasURLBeenRequested(modelId)) {
                this.models[scope][modelId].numReferences++;
            } else if (this.modelUris[scope][modelId] && !this.hasURLBeenRequested(modelId)) {
                modelsRequests[modelId] = this.modelUris[scope][modelId];
            } else if (!this.hasURLBeenRequested(modelId) && isValidUrl(modelId, false)) {
                // A non-style model that has not yet been requested
                this.modelUris[scope][modelId] = this.requestManager.normalizeModelURL(modelId);
                modelsRequests[modelId] = this.modelUris[scope][modelId];
            }
        }
        this.load(modelsRequests, scope);
    }

    hasURLBeenRequested(url: string) {
        return this.modelByURL[url] !== undefined;
    }

    removeModel(id: string, scope: string, keepModelURI = false, forceRemoval = false) {
        if (!this.models[scope] || !this.models[scope][id]) return;
        this.models[scope][id].numReferences--;
        if (this.models[scope][id].numReferences === 0 || forceRemoval) {
            const modelURI = this.modelUris[scope][id];
            if (!keepModelURI) delete this.modelUris[scope][id];
            delete this.modelByURL[modelURI];
            const model = this.models[scope][id].model;
            if (!model) return;
            delete this.models[scope][id];
            model.destroy();
        }
    }

    destroy() {
        for (const scope of Object.keys(this.models)) {
            for (const modelId of Object.keys(this.models[scope])) {
                const model = this.models[scope][modelId].model;
                delete this.models[scope][modelId];
                if (model) model.destroy();
            }
        }

        this.models = {'': {}};
        this.modelUris = {'': {}};
        this.modelByURL = {};
        this.numModelsLoading = {};
    }

    listModels(scope: string): Array<string> {
        if (!this.models[scope]) this.models[scope] = {};
        return Object.keys(this.models[scope]);
    }

    upload(painter: Painter, scope: string) {
        if (!this.models[scope]) this.models[scope] = {};
        for (const modelId in this.models[scope]) {
            if (this.models[scope][modelId].model) {
                this.models[scope][modelId].model.upload(painter.context);
            }
        }
    }
}

export default ModelManager;
