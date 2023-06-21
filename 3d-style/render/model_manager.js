// @flow

import {Event, Evented} from '../../src/util/evented.js';
import assert from 'assert';

import Model from '../data/model.js';
import convertModel from '../source/model_loader.js';

import {RequestManager} from '../../src/util/mapbox.js';
import Painter from '../../src/render/painter.js';

import {loadGLTF} from '../util/loaders.js';

class ModelManager extends Evented {
    models: {[_: string]: Model};
    loaded: boolean;
    requestManager: RequestManager;

    constructor(requestManager: RequestManager) {
        super();
        this.requestManager = requestManager;
        this.models = {};
        this.loaded = false;
    }

    async loadModel(id: string, url: string): Promise<Model> {
        const gltf = await loadGLTF(url);
        const nodes = convertModel(gltf);
        const model = new Model(id, url, undefined, undefined, nodes);
        model.computeBoundsAndApplyParent();
        return model;
    }

    async load(modelUris: Object) {
        for (const modelId in modelUris) {
            const modelUri = modelUris[modelId];
            const model = await this.loadModel(modelId, modelUri);
            this.models[modelId] = model;
        }
        this.loaded = true;
        this.fire(new Event('data', {dataType: 'style'}));
    }

    isLoaded(): boolean {
        return this.loaded;
    }

    hasModel(id: string): boolean {
        return !!this.getModel(id);
    }

    getModel(id: string): ?Model {
        return this.models[id];
    }

    async addModel(id: string, url: string) {
        // Destroy model if it exists
        if (this.models[id]) {
            this.removeModel(id);
        }
        const model = await this.loadModel(id, this.requestManager.normalizeModelURL(url));
        this.models[id] = model;
    }

    addStyleModels(_models: Object) {
        const modelUris = {..._models};
        for (const modelId in modelUris) {
            modelUris[modelId] = this.requestManager.normalizeModelURL(modelUris[modelId]);
        }
        this.load(modelUris);
    }

    removeModel(id: string) {
        assert(this.models[id]);
        const model = this.models[id];
        delete this.models[id];
        model.destroy();
    }

    listModels(): Array<string> {
        return Object.keys(this.models);
    }

    upload(painter: Painter) {
        for (const modelId in this.models) {
            this.models[modelId].upload(painter.context);
        }
    }
}

export default ModelManager;
