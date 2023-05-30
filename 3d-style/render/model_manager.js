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

    constructor(_models: Object, requestManager: RequestManager) {
        super();
        this.models = {};
        this.loaded = false;
        const modelUris = {..._models};
        for (const modelId in modelUris) {
            modelUris[modelId] = requestManager.normalizeModelURL(modelUris[modelId]);
        }
        this.load(modelUris);
    }

    async load(modelUris: Object) {
        for (const modelId in modelUris) {
            const modelUri = modelUris[modelId];
            const gltf = await loadGLTF(modelUri);
            const nodes = convertModel(gltf);
            const model = new Model(modelId, modelUri, undefined, undefined, nodes);
            model.computeBoundsAndApplyParent();
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

    addModel(id: string, model: Model) {
        assert(!this.models[id]);
        this.models[id] = model;
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
