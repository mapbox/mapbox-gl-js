import {describe, test, expect, waitFor, createMap} from '../../../util/vitest.js';
import {createStyleSource} from './util.js';

describe('Map#featureState', () => {
    describe('#setFeatureState', () => {
        test('sets state', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            const fState = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState.hover).toEqual(true);
        });
        test('works with string ids', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true});
            const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
            expect(fState.hover).toEqual(true);
        });
        test('parses feature id as an int', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: '12345'}, {'hover': true});
            const fState = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState.hover).toEqual(true);
        });
        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            expect(() => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            }).toThrowError(Error);
        });
        test('fires an error if source not found', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/source/);
                    resolve();
                });

                map.setFeatureState({source: 'vector', id: 12345}, {'hover': true});
            });
        });
        test('fires an error if sourceLayer not provided for a vector source', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/sourceLayer/);
                    resolve();
                });

                map.setFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
            });
        });
        test('fires an error if id not provided', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/id/);
                    resolve();
                });

                map.setFeatureState({source: 'vector', sourceLayer: "1"}, {'hover': true});
            });
        });
    });

    describe('#removeFeatureState', () => {
        test('accepts "0" id', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'click': true});
            map.removeFeatureState({source: 'geojson', id: 0}, 'hover');
            const fState = map.getFeatureState({source: 'geojson', id: 0});
            expect(fState.hover).toEqual(undefined);
            expect(fState.click).toEqual(true);
        });
        test('accepts string id', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true, 'click': true});
            map.removeFeatureState({source: 'geojson', id: 'foo'}, 'hover');
            const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
            expect(fState.hover).toEqual(undefined);
            expect(fState.click).toEqual(true);
        });
        test('remove specific state property', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            map.removeFeatureState({source: 'geojson', id: 12345}, 'hover');
            const fState = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState.hover).toEqual(undefined);
        });
        test('remove all state properties of one feature', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson', id: 1});

            const fState = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState.hover).toEqual(undefined);
            expect(fState.foo).toEqual(undefined);
        });
        test('remove properties for zero-based feature IDs.', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson', id: 0});

            const fState = map.getFeatureState({source: 'geojson', id: 0});
            expect(fState.hover).toEqual(undefined);
            expect(fState.foo).toEqual(undefined);
        });
        test('other properties persist when removing specific property', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson', id: 1}, 'hover');

            const fState = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState.foo).toEqual(true);
        });
        test('remove all state properties of all features in source', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

            map.removeFeatureState({source: 'geojson'});

            const fState1 = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState1.hover).toEqual(undefined);
            expect(fState1.foo).toEqual(undefined);

            const fState2 = map.getFeatureState({source: 'geojson', id: 2});
            expect(fState2.hover).toEqual(undefined);
            expect(fState2.foo).toEqual(undefined);
        });
        test('specific state deletion should not interfere with broader state deletion', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

            map.removeFeatureState({source: 'geojson', id: 1});
            map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

            const fState1 = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState1.hover).toEqual(undefined);

            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson'});
            map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

            const fState2 = map.getFeatureState({source: 'geojson', id: 2});
            expect(fState2.hover).toEqual(undefined);

            map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson'});
            map.removeFeatureState({source: 'geojson', id: 2}, 'foo');

            const fState3 = map.getFeatureState({source: 'geojson', id: 2});
            expect(fState3.hover).toEqual(undefined);
        });
        test('add/remove and remove/add state', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

            map.removeFeatureState({source: 'geojson', id: 12345});
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

            const fState1 = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState1.hover).toEqual(true);

            map.removeFeatureState({source: 'geojson', id: 12345});

            const fState2 = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState2.hover).toEqual(undefined);
        });
        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            expect(() => {
                map.removeFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            }).toThrowError(Error);
        });
        test('fires an error if source not found', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/source/);
                    resolve();
                });

                map.removeFeatureState({source: 'vector', id: 12345}, {'hover': true});
            });
        });
        test('fires an error if sourceLayer not provided for a vector source', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/sourceLayer/);
                    resolve();
                });

                map.removeFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
            });
        });
        test('fires an error if state property is provided without a feature id', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/id/);
                    resolve();
                });

                map.removeFeatureState({source: 'vector', sourceLayer: "1"}, {'hover': true});
            });
        });
    });
});
