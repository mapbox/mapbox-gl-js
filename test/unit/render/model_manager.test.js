import {describe, test, expect, vi} from '../../util/vitest.js';

import ModelManager from '../../../3d-style/render/model_manager.js';
import {Evented} from '../../../src/util/evented.js';
import {RequestManager} from '../../../src/util/mapbox.js';

function createModelManager() {
    const eventedParent = new Evented();
    const modelManager = new ModelManager(new RequestManager());
    modelManager.setEventedParent(eventedParent);
    return {modelManager, eventedParent};
}

describe('ModelManager', () => {
    test('#addModel', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        expect(modelManager.isLoaded()).toEqual(true);
        expect(modelManager.listModels()).toEqual([]);

        vi.spyOn(modelManager, 'loadModel').mockImplementation(
            (id, url) => id === 'model' ? Promise.resolve({id, url}) : Promise.reject(new Error('Not found'))
        );

        eventedParent.on('data', () => {
            expect(modelManager.isLoaded()).toEqual(true);
            expect(modelManager.hasModel('model', 'basemap')).toEqual(true);
            expect(modelManager.listModels('basemap')).toEqual(['model']);
            expect(modelManager.getModel('model', 'basemap')).toEqual({id: 'model', url: 'uri'});
        });

        modelManager.addModel('model', 'uri', 'basemap');
    });

    test('#removeModel', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        expect(modelManager.isLoaded()).toEqual(true);
        expect(modelManager.listModels()).toEqual([]);

        const model = {
            id: 'model',
            url: 'uri',
            destroy: vi.fn()
        };

        vi.spyOn(modelManager, 'loadModel').mockImplementation(
            (id) => id === 'model' ? Promise.resolve(model) : Promise.reject(new Error('Not found'))
        );

        eventedParent.on('data', () => {
            expect(modelManager.isLoaded()).toEqual(true);
            expect(modelManager.hasModel('model', 'basemap')).toEqual(true);

            modelManager.removeModel('model', 'basemap');

            expect(model.destroy).toHaveBeenCalled();
            expect(modelManager.getModel('model', 'basemap')).toBeFalsy();
            expect(modelManager.hasModel('model', 'basemap')).toEqual(false);
        });

        modelManager.addModel('model', 'uri', 'basemap');
    });

    test('#addModels', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        expect(modelManager.isLoaded()).toEqual(true);
        expect(modelManager.listModels()).toEqual([]);

        vi.spyOn(modelManager, 'loadModel').mockImplementation(
            (id, url) => id.startsWith('model') ? Promise.resolve({id, url}) : Promise.reject(new Error('Not found'))
        );

        const models = {
            'model1': 'uri1',
            'model2': 'uri2',
            'model3': 'uri3'
        };

        eventedParent.on('data', () => {
            expect(modelManager.isLoaded()).toEqual(true);
            expect(modelManager.listModels('basemap')).toEqual(['model1', 'model2', 'model3']);
            expect(modelManager.getModel('model3', 'basemap')).toEqual({id: 'model3', url: 'uri3'});
        });

        modelManager.addModels(models, 'basemap');
    });

    test('#addModelsFromBucket', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        expect(modelManager.isLoaded()).toEqual(true);
        expect(modelManager.listModels()).toEqual([]);

        vi.spyOn(modelManager, 'loadModel').mockImplementation(
            (id, url) => url.startsWith('uri') ? Promise.resolve({id, url}) : Promise.reject(new Error('Not found'))
        );

        eventedParent.on('data', () => {
            expect(modelManager.isLoaded()).toEqual(true);
            expect(modelManager.listModels('basemap')).toEqual(['uri1', 'uri2', 'uri3']);
            expect(modelManager.getModel('uri3', 'basemap')).toEqual({id: 'uri3', url: 'uri3'});
        });

        modelManager.addModelsFromBucket(['uri1', 'uri2', 'uri3'], 'basemap');
    });
});
