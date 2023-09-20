// @flow

import {Event, ErrorEvent, Evented} from '../../src/util/evented.js';
import assert from 'assert';

import Model from '../data/model.js';
import convertModel from '../source/model_loader.js';

import {RequestManager} from '../../src/util/mapbox.js';
import {ResourceType} from '../../src/util/ajax.js';
import Painter from '../../src/render/painter.js';

import {loadGLTF} from '../util/loaders.js';

import type {ModelsSpecification} from '../../src/style-spec/types.js';

class ModelManager extends Evented {
    models: {[scope: string]: {[id: string]: Model}};
    numModelsLoading: {[scope: string]: number};
    requestManager: RequestManager;

    constructor(requestManager: RequestManager) {
        super();
        this.requestManager = requestManager;
        this.models = {'': {}};
        this.numModelsLoading = {};
    }

    async loadModel(id: string, url: string): Promise<?Model> {
        const gltf = await loadGLTF(this.requestManager.transformRequest(url, ResourceType.Model).url).catch((err) => {
            this.fire(new ErrorEvent(new Error(`Could not load model ${id} from ${url}: ${err.message}`)));
        });

        if (!gltf) return;

        const nodes = convertModel(gltf);
        const model = new Model(id, undefined, undefined, nodes);
        model.computeBoundsAndApplyParent();
        return model;
    }

    async load(modelUris: {[string]: string}, scope: string) {
        if (!this.models[scope]) this.models[scope] = {};
        if (this.numModelsLoading[scope] === undefined) this.numModelsLoading[scope] = 0;

        for (const modelId in modelUris) {
            const modelUri = modelUris[modelId];
            this.numModelsLoading[scope] += 1;
            const model = await this.loadModel(modelId, modelUri);
            this.numModelsLoading[scope] -= 1;
            if (model) this.models[scope][modelId] = model;
        }

        this.fire(new Event('data', {dataType: 'style'}));
    }

    isLoaded(): boolean {
        for (const scope in this.numModelsLoading) {
            if (this.numModelsLoading[scope] > 0) return false;
        }
        return true;
    }

    hasModel(id: string, scope: string): boolean {
        return !!this.getModel(id, scope);
    }

    getModel(id: string, scope: string): ?Model {
        if (!this.models[scope]) this.models[scope] = {};
        return this.models[scope][id];
    }

    async addModel(id: string, url: string, scope: string) {
        if (!this.models[scope]) this.models[scope] = {};
        // Destroy model if it exists
        if (this.hasModel(id, scope)) {
            this.removeModel(id, scope);
        }
        this.load({[id]: this.requestManager.normalizeModelURL(url)}, scope);
    }

    addModels(models: ModelsSpecification, scope: string) {
        const modelUris = {};
        for (const modelId in models) {
            modelUris[modelId] = this.requestManager.normalizeModelURL(models[modelId]);
        }

        this.load(modelUris, scope);
    }

    removeModel(id: string, scope: string) {
        if (!this.models[scope]) this.models[scope] = {};
        assert(this.models[scope][id]);

        const model = this.models[scope][id];
        delete this.models[scope][id];
        model.destroy();
    }

    listModels(scope: string): Array<string> {
        if (!this.models[scope]) this.models[scope] = {};
        return Object.keys(this.models[scope]);
    }

    upload(painter: Painter, scope: string) {
        if (!this.models[scope]) this.models[scope] = {};
        for (const modelId in this.models[scope]) {
            this.models[scope][modelId].upload(painter.context);
        }
    }
}

export default ModelManager;
