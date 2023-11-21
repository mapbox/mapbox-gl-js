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

    loadModel(id: string, url: string): Promise<?Model> {
        return loadGLTF(this.requestManager.transformRequest(url, ResourceType.Model).url)
            .then(gltf => {
                if (!gltf) return;

                const nodes = convertModel(gltf);
                const model = new Model(id, undefined, undefined, nodes);
                model.computeBoundsAndApplyParent();
                return model;
            })
            .catch((err) => {
                this.fire(new ErrorEvent(new Error(`Could not load model ${id} from ${url}: ${err.message}`)));
            });
    }

    load(modelUris: {[string]: string}, scope: string) {
        if (!this.models[scope]) this.models[scope] = {};

        const modelIds = Object.keys(modelUris);
        this.numModelsLoading[scope] = (this.numModelsLoading[scope] || 0) + modelIds.length;

        const modelLoads = [];
        for (const modelId of modelIds) {
            modelLoads.push(this.loadModel(modelId, modelUris[modelId]));
        }

        Promise.allSettled(modelLoads)
            .then(results => {
                for (let i = 0; i < results.length; i++) {
                    const {status, value} = results[i];
                    if (status === 'fulfilled' && value) this.models[scope][modelIds[i]] = value;
                }
                this.numModelsLoading[scope] -= modelIds.length;
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

    hasModel(id: string, scope: string): boolean {
        return !!this.getModel(id, scope);
    }

    getModel(id: string, scope: string): ?Model {
        if (!this.models[scope]) this.models[scope] = {};
        return this.models[scope][id];
    }

    addModel(id: string, url: string, scope: string) {
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
