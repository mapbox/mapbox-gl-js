// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import ModelSource from '../../../3d-style/source/model_source';
import {Evented} from '../../../src/util/evented';
import {RequestManager} from '../../../src/util/mapbox';
import {vi, describe, test, expect, doneAsync} from '../../util/vitest';

const wrapDispatcher = (dispatcher) => {
    return {
        getActor() {
            return dispatcher;
        }
    };
};

class StubMap extends Evented {
    constructor() {
        super();
        this._requestManager = new RequestManager();
    }
}

describe('ModelSource', () => {

    function createSource(opts: ModelSourceSpecification, eventedParent: Event) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const modelSource = new ModelSource('id', opts, wrapDispatcher({
            send(type, data, callback) {
                if (callback) {
                    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-argument
                    return setTimeout(callback, 0);
                }
            }
        }), eventedParent);

        // Mock loadGLTFFromURI to return a dummy GLTF model after 1 second delay
        const loadGLTFFromURISpy = vi.spyOn(modelSource as any, 'loadGLTFFromURI');
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        loadGLTFFromURISpy.mockImplementation((uri: string, signal?: AbortSignal) => {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    if (uri && uri.includes('error')) {
                        reject(new Error(`Failed to load model from URI: ${uri}`));
                    } else if (uri) {
                        resolve({
                            json: {
                                accessors: [],
                                bufferViews: [],
                                materials: [],
                                nodes: [],
                                meshes: [],
                                scene: 0
                            },
                            images: [],
                            buffers: []
                        });
                    }
                }, 1000);

                if (signal) {
                    signal.addEventListener('abort', () => {
                        clearTimeout(timeout);
                        const error = new Error('Aborted');
                        error.name = 'AbortError';
                        reject(error);
                    });
                }
            });
        });

        return {modelSource, loadGLTFFromURISpy};
    }

    test('empty source', async () => {
        // Test firing of data event and signaling of 'loaded()' state for empty model source
        const map = new StubMap();

        const {withAsync, wait} = doneAsync();

        const sourceSpec = {};
        const sourceMock = createSource(sourceSpec, map);

        let numErrors = 0;
        let numDataEvents = 0;

        sourceMock.modelSource.on("data", withAsync((event, doneRef) => {
            ++numDataEvents;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            doneRef.resolve();
        }));

        sourceMock.modelSource.on("error", withAsync((event, doneRef) => {
            ++numErrors;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            doneRef.resolve();
        }));
        sourceMock.modelSource.load();
        await wait;
        expect(sourceMock.loadGLTFFromURISpy).toHaveBeenCalledTimes(0);
        expect(sourceMock.modelSource.loaded()).toBeTruthy();
        expect(sourceMock.modelSource._modelsInfo.size).toBe(0);
        expect(numErrors).toBe(0);
        expect(numDataEvents).toBe(1);
    });

    test('update while loading with one failing model', async () => {
        const map = new StubMap();

        const {withAsync, wait} = doneAsync();

        const sourceSpec = {};
        const sourceMock = createSource(sourceSpec, map);

        let numErrors = 0;

        sourceMock.modelSource.on("error", withAsync((event, doneRef) => {
            ++numErrors;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            doneRef.resolve();
        }));
        sourceMock.modelSource.load();
        for (let i = 0; i < 10; ++i) {
            sourceMock.modelSource.setModels({
                "modelA": {
                    "uri": "https://example.com/model.glb",
                    "orientation": [0, i, 0]
                },
                "modelB": {
                    "uri": "https://example.com/error.glb",
                    "orientation": [0, i, 0]
                }
            });
        }

        await wait;
        // With abort support, each setModels() initiates new loads (previous ones are cancelled)
        // Only the final iteration's loads complete - one succeeds, one fails
        expect(sourceMock.modelSource.loaded()).toBeFalsy(); // One model failed
        expect(sourceMock.modelSource._modelsInfo.size).toBe(2);
        expect(numErrors).toBe(1);
    });

    test('update while loading', async () => {
        const map = new StubMap();

        const {withAsync, wait} = doneAsync();

        const sourceSpec = {};
        const sourceMock = createSource(sourceSpec, map);

        sourceMock.modelSource.on("data", withAsync((event, doneRef) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            doneRef.resolve();
        }));
        for (let i = 0; i < 10; ++i) {
            sourceMock.modelSource.setModels({
                "modelA": {
                    "uri": "https://example.com/model.glb",
                    "orientation": [0, i, 0]
                }
            });
        }

        await wait;
        // With abort support, each setModels() initiates a new load (previous ones are cancelled)
        // Only the final iteration's load completes
        expect(sourceMock.modelSource.loaded()).toBeTruthy();
        expect(sourceMock.modelSource._modelsInfo.size).toBe(1);
    });

    test('update with different URIs', async () => {
        const map = new StubMap();

        const sourceSpec = {};
        const sourceMock = createSource(sourceSpec, map);

        const testConfigs = [
            {
                "models": {
                    "modelA": {
                        "uri": "https://example.com/modelA.glb",
                        "orientation": [0, 1, 0]
                    }
                }
            },
            {
                "models": {
                    "modelA": {
                        "uri": "https://example.com/modelA-1.glb",
                        "orientation": [0, 100, 0]
                    },
                    "modelB": {
                        "uri": "https://example.com/modelB.glb",
                        "orientation": [0, 100, 0]
                    }
                }
            },
            {
                "models": {
                    "modelB": {
                        "uri": "https://example.com/modelB.glb",
                        "orientation": [0, 300, 0]
                    }
                }
            }
        ];

        sourceMock.modelSource.load();
        for (const cfg of testConfigs) {
            sourceMock.modelSource.setModels(cfg.models);
            sourceMock.modelSource.load();
            expect(sourceMock.modelSource._modelsInfo.size).toBe(Object.keys(cfg.models).length);
        }
        const {withAsync, wait} = doneAsync();
        sourceMock.modelSource.on("data", withAsync((event, doneRef) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            doneRef.resolve();
        }));
        await wait;
        // With abort support, loads are cancelled and restarted on each config change
        // Final config has 1 model (modelB), which loads successfully
        expect(sourceMock.modelSource.loaded()).toBeTruthy();
        expect(sourceMock.modelSource._modelsInfo.size).toBe(1);
    });
});
