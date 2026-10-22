// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi, waitFor} from '../../util/vitest';
import ModelManager from '../../../3d-style/render/model_manager';
import {Evented} from '../../../src/util/evented';
import {RequestManager} from '../../../src/util/mapbox';
import {mockFetch, getPNGResponse} from '../../util/network';

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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            expect.unreachable(error.message);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            expect.unreachable(error.message);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        modelManager.addModel('model', 'https://www.example.com/', 'basemap');
        modelManager.addModel('model', 'https://www.example.com/', 'basemap');

        expect(modelManager.loadModel).toHaveBeenCalledTimes(1);
        expect(modelManager.models['basemap']['model'].numReferences).toBe(2);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test("#addModel with different ids but with same URL and scope increases it's number of references but doesn't load it again", async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            expect.unreachable(error.message);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        modelManager.addModel('model', 'https://www.example.com/', 'basemap');
        modelManager.addModel('model2', 'https://www.example.com/', 'basemap');

        expect(modelManager.loadModel).toHaveBeenCalledOnce();
        expect(modelManager.models['basemap']['model'].numReferences).toBe(2);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test("#addModel with different ids and scope but with same URL increases it's number of references but doesn't load it again", async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            expect.unreachable(error.message);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        modelManager.addModel('model', 'https://www.example.com/', 'basemap');
        modelManager.addModel('model2', 'https://www.example.com/', '');

        expect(modelManager.loadModel).toHaveBeenCalledOnce();
        expect(modelManager.models['basemap']['model'].numReferences).toBe(2);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    test('#removeModel', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
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

    // eslint-disable-next-line @typescript-eslint/require-await
    test('#addModelsFromBucket doesn\t reload existing models', async () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            expect.unreachable(error.message);
        });

        vi.spyOn(modelManager, 'loadModel').mockImplementation(
            (id, url) => url.startsWith('https://www.example.com/') ? Promise.resolve({id, url}) : Promise.reject(new Error('Not found'))
        );

        eventedParent.once('data', () => {
            modelManager.addModelsFromBucket(['https://www.example.com/1'], 'basemap');
            expect(modelManager.models['basemap']['https://www.example.com/1'].numReferences).toBe(2);
        });

        modelManager.addModelsFromBucket(['https://www.example.com/1', 'https://www.example.com/2', 'https://www.example.com/3'], 'basemap');

    });

    test('#addModelsFromBucket doesn\'t fire data when all models were already requested', async () => {
        const {modelManager, eventedParent} = createModelManager();
        vi.spyOn(modelManager, 'loadModel').mockImplementation((id, url) => Promise.resolve({id, url}));

        modelManager.addModelsFromBucket(['https://www.example.com/1'], 'basemap');
        await waitFor(eventedParent, 'data');

        let dataEvents = 0;
        eventedParent.on('data', () => dataEvents++);
        modelManager.addModelsFromBucket(['https://www.example.com/1'], 'basemap');
        await new Promise(resolve => { setTimeout(resolve, 0); });

        expect(dataEvents).toEqual(0);
    });

    test('#reloadModels', () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            expect.unreachable(error.message);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    test("does not pollute Object.prototype when scope or id is '__proto__'", () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            expect.unreachable(error.message);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        // A malicious style with imports[].id === "__proto__" makes scope === "__proto__".
        // Attacker also controls the model id and URL, so writes of the form
        // `this.modelUris[scope][id] = url` must not reach Object.prototype.
        modelManager.addModel('polluted', 'https://attacker.example/payload', '__proto__');
        modelManager.addModelURLs({'pollutedFromURLs': 'https://attacker.example/payload'}, '__proto__');
        modelManager.addModelsFromBucket(['https://attacker.example/from-bucket'], '__proto__');

        try {
            // No global prototype pollution: bare objects must not see attacker keys.
            expect(({} as Record<string, unknown>).polluted).toBeUndefined();
            expect(({} as Record<string, unknown>).pollutedFromURLs).toBeUndefined();
            expect(({} as Record<string, unknown>)['https://attacker.example/from-bucket']).toBeUndefined();

            // The maps themselves must not have inherited Object.prototype either.
            expect(Object.getPrototypeOf(modelManager.modelUris)).toBeNull();
            expect(Object.getPrototypeOf(modelManager.models)).toBeNull();
            expect(Object.getPrototypeOf(modelManager.modelByURL)).toBeNull();
            expect(Object.getPrototypeOf(modelManager.numModelsLoading)).toBeNull();
            // eslint-disable-next-line no-proto
            expect(Object.getPrototypeOf(modelManager.modelUris['__proto__'])).toBeNull();
            // eslint-disable-next-line no-proto
            expect(Object.getPrototypeOf(modelManager.models['__proto__'])).toBeNull();
        } finally {
            // Defensive cleanup so a regression cannot leak into sibling tests.
            delete (Object.prototype as Record<string, unknown>).polluted;
            delete (Object.prototype as Record<string, unknown>).pollutedFromURLs;
            delete (Object.prototype as Record<string, unknown>)['https://attacker.example/from-bucket'];
        }
    });

    test('#loadModel sends the headers added by transformRequest with the model request', async () => {
        const url = 'https://www.example.com/model.glb';
        const modelManager = new ModelManager(new RequestManager(
            (requestUrl) => ({url: requestUrl, headers: {authorization: 'Bearer token'}})
        ));
        modelManager.setEventedParent(new Evented());

        let sentAuthorization: string | null = null;
        mockFetch({
            'model\\.glb': (request: Request) => {
                sentAuthorization = request.headers.get('authorization');
                return Promise.resolve(new Response(new ArrayBuffer(0)));
            }
        });

        modelManager.addModel('model', url, 'basemap');
        await modelManager.loadModel('model', url);

        expect(sentAuthorization).toEqual('Bearer token');
    });

    test('#loadModel drops a model removed while transformRequest is pending', async () => {
        let releaseTransform: () => void;
        const transformReleased = new Promise<void>((resolve) => { releaseTransform = resolve; });
        const modelManager = new ModelManager(new RequestManager(async (url) => {
            await transformReleased;
            return {url};
        }));
        modelManager.setEventedParent(new Evented());
        mockFetch({
            'model\\.gltf': () => Promise.resolve(new Response(JSON.stringify({asset: {version: '2.0'}, scene: 0, scenes: [{nodes: []}]})))
        });

        const loaded = new Promise((resolve) => { modelManager.once('data', resolve); });
        modelManager.addModel('model', 'https://www.example.com/model.gltf', 'basemap');
        modelManager.removeModel('model', 'basemap');
        releaseTransform();
        await loaded;

        expect(modelManager.getModel('model', 'basemap')).toBeNull();
    });

    describe('#loadModel with files referenced by the glTF', () => {
        const dataUri = 'data:application/octet-stream;base64,AAAAAA==';
        const blobUri = 'blob:https://www.example.com/0b4e2a5c-1d1f-4f4e-9d36-7f5e1f2c9a10';

        async function loadGLTFFiles(transformRequest: (url: string) => {url: string; headers?: Record<string, string>}, {bufferUri = 'buffer.bin', gltfStatus = 200, bufferStatus = 200} = {}) {
            const eventedParent = new Evented();
            const errors: string[] = [];
            eventedParent.on('error', ({error}) => errors.push((error as Error).message));
            const modelManager = new ModelManager(new RequestManager(transformRequest));
            modelManager.setEventedParent(eventedParent);

            const png = await getPNGResponse();
            const requests: Record<string, Request> = {};
            const respond = (body: BodyInit, status = 200) => (request: Request) => {
                requests[decodeURIComponent(request.url).split('/').pop().split('?')[0]] = request;
                return Promise.resolve(new Response(status === 200 ? body : null, {status}));
            };
            mockFetch({
                'model\\.gltf': respond(JSON.stringify({
                    asset: {version: '2.0'},
                    scene: 0,
                    scenes: [{nodes: []}],
                    buffers: [{uri: bufferUri, byteLength: 4}],
                    images: [{uri: 'image.png'}]
                }), gltfStatus),
                'buffer\\.bin': respond(new ArrayBuffer(4), bufferStatus),
                'image\\.png': respond(png),
                '^(data|blob):': (request: Request) => ([dataUri, blobUri].includes(request.url) ? Promise.resolve(new Response(new ArrayBuffer(4))) : Promise.reject(new TypeError('Failed to fetch')))
            });

            const loaded = new Promise((resolve) => { modelManager.once('data', resolve); });
            modelManager.addModel('model', 'https://www.example.com/model.gltf', 'basemap');
            await loaded;

            return {requests, errors};
        }

        test('sends the headers added by transformRequest with the buffer request', async () => {
            const {requests} = await loadGLTFFiles((url) => ({url, headers: {authorization: 'Bearer token'}}));
            expect(requests['buffer.bin']?.headers.get('authorization')).toEqual('Bearer token');
        });

        test('sends the headers added by transformRequest with the image request', async () => {
            const {requests} = await loadGLTFFiles((url) => ({url, headers: {authorization: 'Bearer token'}}));
            expect(requests['image.png']?.headers.get('authorization')).toEqual('Bearer token');
        });

        test('applies a URL rewrite of transformRequest to the buffer once', async () => {
            const {requests} = await loadGLTFFiles((url) => ({url: url.replace('example.com', 'cdn.example.com')}));
            expect(requests['buffer.bin']?.url).toEqual('https://www.cdn.example.com/buffer.bin');
        });

        test('resolves the buffer against the glTF URL returned by transformRequest', async () => {
            const {requests} = await loadGLTFFiles((url) => ({url: url.endsWith('.gltf') ? url.replace('www.example.com', 'cdn.example') : url}));
            expect(requests['buffer.bin']?.url).toEqual('https://cdn.example/buffer.bin');
        });

        test('requests all images at once, not limited by the raster image request queue', async () => {
            const imageCount = 24;
            const modelManager = new ModelManager(new RequestManager());
            modelManager.setEventedParent(new Evented());

            const png = await getPNGResponse();
            let inFlight = 0;
            let peakInFlight = 0;
            mockFetch({
                'model\\.gltf': () => Promise.resolve(new Response(JSON.stringify({
                    asset: {version: '2.0'},
                    scene: 0,
                    scenes: [{nodes: []}],
                    images: Array.from({length: imageCount}, (_, i) => ({uri: `image${i}.png`}))
                }))),
                'image\\d+\\.png': async () => {
                    peakInFlight = Math.max(peakInFlight, ++inFlight);
                    await new Promise((resolve) => { setTimeout(resolve, 20); });
                    inFlight--;
                    return new Response(png);
                }
            });

            const loaded = new Promise((resolve) => { modelManager.once('data', resolve); });
            modelManager.addModel('model', 'https://www.example.com/model.gltf', 'basemap');
            await loaded;

            expect(peakInFlight).toEqual(imageCount);
        });

        test.each([dataUri, blobUri])('loads a buffer from %s when transformRequest appends a query', async (bufferUri) => {
            const {errors} = await loadGLTFFiles((url) => ({url: `${url}?sig=abc`}), {bufferUri});
            expect(errors).toEqual([]);
        });

        test('fires an error when a referenced file is missing', async () => {
            const {errors} = await loadGLTFFiles((url) => ({url}), {bufferStatus: 404});
            expect(errors).toEqual(['Could not load model model from https://www.example.com/model.gltf']);
        });

        test('fires no error when the glTF is missing', async () => {
            const {errors} = await loadGLTFFiles((url) => ({url}), {gltfStatus: 404});
            expect(errors).toEqual([]);
        });
    });

    test('#destroy', () => {
        const {modelManager, eventedParent} = createModelManager();

        eventedParent.on('error', ({error}) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            expect.unreachable(error.message);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        modelManager.loadModel = vi.fn((id, url) => Promise.resolve({id, url}));

        modelManager.addModel('model', 'https://www.example.com/', '');
        modelManager.addModel('model2', 'https://www.example2.com/', 'basemap');

        modelManager.destroy();

        expect(modelManager.listModels('')).toStrictEqual([]);
        expect(modelManager.listModels('basemap')).toStrictEqual([]);
    });
});
