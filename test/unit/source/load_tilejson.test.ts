// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {vi, describe, test, expect, doneAsync, assert} from '../../util/vitest';
import {mockFetch} from '../../util/network';
import {Evented} from '../../../src/util/evented';
import loadTileJSON from '../../../src/source/load_tilejson';
import {RequestManager} from '../../../src/util/mapbox';

class StubMap extends Evented {
    constructor() {
        super();
        this._requestManager = new RequestManager();
    }
}

describe('Inlined TileJSON', () => {
    const map = new StubMap();
    const baseTileJSON = {
        attribution: '<a href="https://www.mapbox.com/about/maps/" target="_blank"></a>',
        bounds: [-180, -85, 180, 85],
        center: [0, 0, 0],
        format: 'pbf',
        maxzoom: 16,
        minzoom: 0,
        tilejson: '2.2.0',
        tiles: ['http://example.com/{z}/{x}/{y}.png'],
        'worldview_default': 'US',
        'worldview_options': {
            AR: 'Argentina',
            CN: 'China',
            IN: 'India',
            JP: 'Japan',
            MA: 'Morocco',
            RS: 'Serbia',
            RU: 'Russia',
            TR: 'Turkey',
            US: 'United States'
        }
    };
    test('should place inline data without request', async () => {
        const {withAsync, wait} = doneAsync();
        const transformSpy = vi.spyOn(map._requestManager, 'transformRequest');

        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON
            }
        }, map._requestManager, null, null, withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(result.tiles).toEqual(["http://example.com/{z}/{x}/{y}.png"]);
            expect(transformSpy).not.toHaveBeenCalled();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should request tileJSON because of another language', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();

        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });
        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON,
                'language_options': {
                    'fi': 'Finland'
                },
                language: {
                    'mapbox.mapbox-streets-v8': 'fr'
                }
            },
            url: '/source.json'
        }, map._requestManager, 'fi', null, withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).toHaveBeenCalledOnce();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should request tileJSON because of another worldview', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();
        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });

        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON,
                'language_options': {
                    'fi': 'Finland',
                    'us': 'USA'
                },
                language: {
                    'mapbox.mapbox-streets-v8': 'us'
                },
                worldview: {
                    'mapbox.mapbox-streets-v8': 'us'
                }
            },
            url: '/source.json'
        }, map._requestManager, 'us', 'IN', withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).toHaveBeenCalledOnce();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should request tileJSON because of only unsupported language', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();
        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });
        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON,
                'language_options': {
                    'fi': 'Finland',
                    'us': 'USA'
                },
                language: {
                    'mapbox.mapbox-streets-v8': 'us'
                },
                worldview: {
                    'mapbox.mapbox-streets-v8': 'US'
                }
            },
            url: '/source.json'
        }, map._requestManager, 'et', 'IN', withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).toHaveBeenCalledOnce();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should request tileJSON because of only unsupported worldview', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();
        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });
        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON,
                // eslint-disable-next-line camelcase
                language_options: {
                    'fi': 'Finland',
                    'us': 'USA'
                },
                language: {
                    'mapbox.mapbox-streets-v8': 'us'
                },
                // eslint-disable-next-line camelcase
                worldview_options: {
                    'IN': 'India'
                },
                worldview: {
                    'mapbox.mapbox-streets-v8': 'us'
                }
            },
            url: '/source.json'
        }, map._requestManager, 'fi', 'JP', withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).toHaveBeenCalledOnce();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should not request tileJSON because of unsupported language/worldview', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();
        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });
        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON,
                'language_options': {
                    'fi': 'Finland',
                    'us': 'USA'
                },
                language: {
                    'mapbox.mapbox-streets-v8': 'us'
                },
                worldview: {
                    'mapbox.mapbox-streets-v8': 'US'
                }
            },
            url: '/source.json'
        }, map._requestManager, 'et', 'ET', withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).not.toHaveBeenCalled();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should request tileJSON if we don\'t have inlined data', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();
        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });
        loadTileJSON({
            type: 'vector',
            url: '/source.json'
        }, map._requestManager, null, null, withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).toHaveBeenCalledOnce();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should request tileJSON if some source of different language', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();
        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });
        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON,
                // eslint-disable-next-line camelcase
                language_options: {
                    'fi': 'Finland',
                    'us': 'USA'
                },
                language: {
                    'mapbox.mapbox-streets-v8': 'us',
                    'mapbox.mapbox-other-v1': 'fi'
                },
                worldview: {
                    'mapbox.mapbox-streets-v8': 'US'
                }
            },
            url: '/source.json'
        }, map._requestManager, 'fi', null, withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).toHaveBeenCalledOnce();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should request tileJSON if some source of different worldview', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();
        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });
        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON,
                // eslint-disable-next-line camelcase
                language_options: {
                    'fi': 'Finland',
                    'us': 'USA'
                },
                language: {
                    'mapbox.mapbox-streets-v8': 'us',
                    'mapbox.mapbox-other-v1': 'us'
                },
                worldview: {
                    'mapbox.mapbox-streets-v8': 'JP',
                    'mapbox.mapbox-other-v1': 'US'
                }
            },
            url: '/source.json'
        }, map._requestManager, 'us', 'JP', withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).toHaveBeenCalledOnce();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should request tileJSON if we don\'t have language options', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();
        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });
        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON,
                // eslint-disable-next-line camelcase
                language_options: undefined,
                language: {
                    'mapbox.mapbox-streets-v8': 'us',
                    'mapbox.mapbox-other-v1': 'jp'
                },
                worldview: {
                    'mapbox.mapbox-streets-v8': 'JP',
                    'mapbox.mapbox-other-v1': 'JP'
                }
            },
            url: '/source.json'
        }, map._requestManager, 'us', 'JP', withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).toHaveBeenCalledOnce();
            doneRef.resolve();
        }));

        await wait;
    });

    test('should request tileJSON if we don\'t have worldview options', async () => {
        const {withAsync, wait} = doneAsync();
        const requestFn = vi.fn();
        mockFetch({
            'source.json': () => {
                requestFn();
                return new Response(JSON.stringify({}));
            }
        });
        loadTileJSON({
            type: 'vector',
            data: {
                ...baseTileJSON,
                // eslint-disable-next-line camelcase
                worldview_options: undefined,
                language: {
                    'mapbox.mapbox-streets-v8': 'us',
                    'mapbox.mapbox-other-v1': 'us'
                },
                worldview: {
                    'mapbox.mapbox-streets-v8': 'JP',
                    'mapbox.mapbox-other-v1': 'US'
                }
            },
            url: '/source.json'
        }, map._requestManager, 'us', 'JP', withAsync((err, result, doneRef) => {
            assert.ifError(err);
            expect(requestFn).toHaveBeenCalledOnce();
            doneRef.resolve();
        }));

        await wait;
    });
});

describe('LoadTileJson#variants', () => {
    const map = new StubMap();

    test('should returns error if variants is not an array', async () => {
        const {withAsync, wait} = doneAsync();
        const tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": "variants should not be a string"
        };
        loadTileJSON(tileJSON, map._requestManager, null, null, withAsync((err, doneRef) => {
            expect(err.message).toEqual("variants must be an array");
            doneRef.resolve();
        }));

        await wait;
    });

    test('should returns error if variant is not an object', async () => {
        const {withAsync, wait} = doneAsync();
        const tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": ["variants elements should be objects"]
        };
        loadTileJSON(tileJSON, map._requestManager, null, null, withAsync((err, doneRef) => {
            expect(err.message).toEqual("variant must be an object");
            doneRef.resolve();
        }));

        await wait;
    });

    test('should returns error if capabilities is not an array', async () => {
        const {withAsync, wait} = doneAsync();
        const tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": [
                {
                    "capabilities": "capabilities should be an array"
                }
            ]
        };
        loadTileJSON(tileJSON, map._requestManager, null, null, withAsync((err, doneRef) => {
            expect(err.message).toEqual("capabilities must be an array");
            doneRef.resolve();
        }));

        await wait;
    });

    test('tiles should be replaced if capabilities.length == 1 and capabilities[0] == "meshopt" ', async () => {
        const {withAsync, wait} = doneAsync();
        const options = {
            url: "/source.json"
        };

        const tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": [
                {
                    "capabilities": ["meshopt"],
                    "tiles": ["http://dataset2"]
                }
            ]
        };

        mockFetch({
            '/source.json': () => {
                return new Response(JSON.stringify(tileJSON));
            }
        });
        loadTileJSON(options, map._requestManager, null, null, withAsync((err, result, doneRef) => {
            expect(err).toEqual(null);
            expect(result.tiles).toEqual(["http://dataset2"]);
            doneRef.resolve();
        }));

        await wait;
    });

    test('tiles should be replaced even when the above condition is met, and it happens in a different variant', async () => {
        const {withAsync, wait} = doneAsync();
        const options = {
            url: "/source.json"
        };

        const tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": [
                {
                    "capabilities": ["customcapability"],
                    "tiles": ["http://dataset2"]
                },
                {
                    "capabilities": ["meshopt"],
                    "tiles": ["http://dataset3"]
                }
            ]
        };

        mockFetch({
            '/source.json': () => {
                return new Response(JSON.stringify(tileJSON));
            }
        });
        loadTileJSON(options, map._requestManager, null, null, withAsync((err, result, doneRef) => {
            expect(err).toEqual(null);
            expect(result.tiles).toEqual(["http://dataset3"]);
            doneRef.resolve();
        }));

        await wait;
    });

    test('meshopt variants should replace other fields as well', async () => {
        const {withAsync, wait} = doneAsync();
        const options = {
            url: "/source.json"
        };
        const tileJSON = {
            "tiles": ["http://dataset1"],
            "minzoom": 1,
            "variants": [
                {
                    "capabilities": ["customcapability"],
                    "tiles": ["http://dataset2"]
                },
                {
                    "minzoom": 14,
                    "capabilities": ["meshopt"],
                    "tiles": ["http://dataset3"]
                }
            ]
        };
        mockFetch({
            '/source.json': () => {
                return new Response(JSON.stringify(tileJSON));
            }
        });
        loadTileJSON(options, map._requestManager, null, null, withAsync((err, result, doneRef) => {
            expect(err).toEqual(null);
            expect(result.minzoom).toEqual(14);
            doneRef.resolve();
        }));

        await wait;
    });
});
