// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi} from '../../util/vitest';
import ModelManager from '../../../3d-style/render/model_manager';
import {Evented} from '../../../src/util/evented';
import {RequestManager} from '../../../src/util/mapbox';

function createModelManager() {
    const eventedParent = new Evented();
    const modelManager = new ModelManager(new RequestManager());
    modelManager.setEventedParent(eventedParent);
    return {modelManager, eventedParent};
}

describe('ModelManager', () => {
    // eslint-disable-next-line @typescript-eslint/require-await
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
            expect(modelManager.getModel('model', 'basemap')).toEqual({id: 'model', url: 'https://www.example.com/'});
        });

        modelManager.addModel('model', 'https://www.example.com/', 'basemap');
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test("#addModel with an already existing model id but different URL loads it", async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        modelManager.addModel('model', 'https://www.example.com/', 'basemap');
        modelManager.addModel('model', 'https://www.example2.com/', 'basemap');

        expect(modelManager.loadModel).toHaveBeenCalledTimes(2);
        expect(modelManager.models['basemap']['model'].numReferences).toBe(1);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test("#addModel with an already existing model id and same URL increases the reference number", async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        modelManager.addModel('model', 'https://www.example.com/', 'basemap');
        modelManager.addModel('model', 'https://www.example.com/', 'basemap');

        expect(modelManager.loadModel).toHaveBeenCalledTimes(1);
        expect(modelManager.models['basemap']['model'].numReferences).toBe(2);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test("#addModel with different ids but with same URL increases it's number of references but doesn't load it again", async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        modelManager.addModel('model', 'https://www.example.com/', 'basemap');
        modelManager.addModel('model2', 'https://www.example.com/', 'basemap');

        expect(modelManager.loadModel).toHaveBeenCalledOnce();
        expect(modelManager.models['basemap']['model'].numReferences).toBe(2);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test('#removeModel', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        expect(modelManager.isLoaded()).toEqual(true);
        expect(modelManager.listModels()).toEqual([]);

        const model = {
            id: 'model',
            url: 'https://www.example.com/',
            destroy: vi.fn()
        };

        vi.spyOn(modelManager, 'loadModel').mockImplementation(
            (id) => (id === 'model' ? Promise.resolve(model) : Promise.reject(new Error('Not found')))
        );

        eventedParent.on('data', () => {
            expect(modelManager.isLoaded()).toEqual(true);
            expect(modelManager.hasModel('model', 'basemap')).toEqual(true);

            modelManager.removeModel('model', 'basemap');

            expect(model.destroy).toHaveBeenCalled();
            expect(modelManager.getModel('model', 'basemap')).toBeFalsy();
            expect(modelManager.hasModel('model', 'basemap')).toEqual(false);
        });

        modelManager.addModel('model', 'https://www.example.com/', 'basemap');
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test('#addModelURLs', async () => {
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
            'model1': 'https://www.example.com/1',
            'model2': 'https://www.example.com/2',
            'model3': 'https://www.example.com/3'
        };

        eventedParent.on('data', () => {
            expect(modelManager.isLoaded()).toEqual(true);
            expect(modelManager.listModels('basemap')).toEqual(['model1', 'model2', 'model3']);
            expect(modelManager.getModel('model3', 'basemap')).toEqual({id: 'model3', url: 'https://www.example.com/3'});
        });

        modelManager.addModelURLs(models, 'basemap');
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test('#addModelsFromBucket', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        expect(modelManager.isLoaded()).toEqual(true);
        expect(modelManager.listModels()).toEqual([]);

        vi.spyOn(modelManager, 'loadModel').mockImplementation(
            (id, url) => url.startsWith('https://www.example.com/') ? Promise.resolve({id, url}) : Promise.reject(new Error('Not found'))
        );

        eventedParent.on('data', () => {
            expect(modelManager.isLoaded()).toEqual(true);
            expect(modelManager.listModels('basemap')).toEqual(['https://www.example.com/1', 'https://www.example.com/2', 'https://www.example.com/3']);
            expect(modelManager.getModel('https://www.example.com/3', 'basemap')).toEqual({id: 'https://www.example.com/3', url: 'https://www.example.com/3'});
        });

        modelManager.addModelsFromBucket(['https://www.example.com/1', 'https://www.example.com/2', 'https://www.example.com/3'], 'basemap');
    });

    test('#reloadModels', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        modelManager.addModel('model', 'https://www.example.com/', 'basemap');
        modelManager.addModel('model2', 'https://www.example2.com/', 'basemap');

        expect(modelManager.loadModel).toHaveBeenCalledTimes(2);
        expect(modelManager.models['basemap']['model'].numReferences).toBe(1);
        expect(modelManager.models['basemap']['model2'].numReferences).toBe(1);

        modelManager.reloadModels('basemap');

        expect(modelManager.loadModel).toHaveBeenCalledTimes(4);
        expect(modelManager.models['basemap']['model'].numReferences).toBe(1);
        expect(modelManager.models['basemap']['model2'].numReferences).toBe(1);
    });

    test('#destroy', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            expect.unreachable(error.message);
        });

        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        modelManager.addModel('model', 'https://www.example.com/', '');
        modelManager.addModel('model2', 'https://www.example2.com/', 'basemap');

        modelManager.destroy();

        expect(modelManager.listModels('')).toStrictEqual([]);
        expect(modelManager.listModels('basemap')).toStrictEqual([]);
    });
});
