import {describe, test, beforeAll, afterEach, afterAll, expect, waitFor, vi} from "../../util/vitest.js";
import {getNetworkWorker, http, HttpResponse} from '../../util/network.js';
import Tile from '../../../src/source/tile.js';
import Style from '../../../src/style/style.js';
import Transform from '../../../src/geo/transform.js';
import StyleLayer from '../../../src/style/style_layer.js';
import VectorTileSource from '../../../src/source/vector_tile_source.js';
import GlyphManager from '../../../src/render/glyph_manager.js';
import {Event, Evented} from '../../../src/util/evented.js';
import {RequestManager} from '../../../src/util/mapbox.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';

import {extend} from '../../../src/util/util.js';
import {makeFQID} from '../../../src/util/fqid.js';

function createStyleJSON(properties) {
    return extend({
        version: 8,
        sources: {},
        layers: []
    }, properties);
}

class StubMap extends Evented {
    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = new RequestManager();
        this._markers = [];
        this._triggerCameraUpdate = () => {};
        this._prioritizeAndUpdateProjection = () => {};
    }

    setCamera() {}

    _getMapId() {
        return 1;
    }
}

let networkWorker;

beforeAll(async () => {
    networkWorker = await getNetworkWorker(window);
});

afterEach(() => {
    networkWorker.resetHandlers();
});

afterAll(() => {
    networkWorker.stop();
});

describe('Style#loadURL', () => {
    test('imports style from URL', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        const fragment = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        const spy = vi.fn();

        networkWorker.use(
            http.get('/style.json', ({request}) => {
                spy(request);
                return HttpResponse.json(initialStyle);
            }),
            http.get('/styles/streets-v12.json', ({request}) => {
                spy(request);
                return HttpResponse.json(fragment);
            }),
        );

        await new Promise(resolve => {
            style.once("style.load", () => {
                expect(spy).toHaveBeenCalledTimes(2);
                const fragmentStyle = style.getFragmentStyle('streets');
                expect(fragmentStyle.stylesheet.layers).toEqual(fragment.layers);
                expect(fragmentStyle.stylesheet.sources).toEqual(fragment.sources);
                resolve();
            });
            style.loadURL('/style.json');
        });
    });

    test('non existing imports don\'t block root style', async () => {
        networkWorker.use(
            http.get('/styles/not-found.json', () => {
                return new HttpResponse(null, {status: 404});
            }),
            http.get('/style.json', () => {
                return HttpResponse.json(initialStyle);
            }),
        );

        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'foo', url: '/styles/not-found.json'}],
        });

        vi.spyOn(console, 'error').mockImplementation(() => {});

        style.loadURL('/style.json');
        await waitFor(style, "style.load");
    });

    test('imports style from JSON', async () => {
        const style = new Style(new StubMap());

        const fragment = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}],
        });

        const spy = vi.fn();

        networkWorker.use(
            http.get('/style.json', ({request}) => {
                spy(request);
                return HttpResponse.json(initialStyle);
            }),
        );

        style.loadURL('/style.json');
        await waitFor(style, "style.load");

        expect(spy).toHaveBeenCalledTimes(1);

        const fragmentStyle = style.getFragmentStyle('streets');
        expect(fragmentStyle.stylesheet.layers).toEqual(fragment.layers);
        expect(fragmentStyle.stylesheet.sources).toEqual(fragment.sources);

    });

    test('imports nested styles with circular dependencies', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'parent', url: '/styles/parent.json'}]
        });

        // Parent fragment imports 2 children
        const parentFragment = createStyleJSON({
            imports: [
                {id: 'child1', url: '/styles/child1.json'},
                {id: 'child2', url: '/styles/child2.json'}
            ]
        });

        // Child imports parent fragment
        const childFragment1 = createStyleJSON({
            sources: {childSource1: {type: 'vector', tiles: []}},
            imports: [{id: 'parent', url: '/styles/parent.json'}]
        });

        // Child imports neighbour child fragment
        const childFragment2 = createStyleJSON({
            sources: {childSource2: {type: 'vector', tiles: []}},
            imports: [{id: 'child1', url: '/styles/child1.json'}]
        });

        // Resulting stylesheet import
        const expectedImport = {
            id: 'parent',
            url: '/styles/parent.json',
            data: {
                version: 8,
                sources: {},
                layers: [],
                imports: [
                    {
                        id: 'child1',
                        url: '/styles/child1.json',
                        data: {
                            version: 8,
                            imports: [{id: 'parent', url: '/styles/parent.json'}],
                            sources: {childSource1: {type: 'vector', tiles: []}},
                            layers: []
                        }
                    },
                    {
                        id: 'child2',
                        url: '/styles/child2.json',
                        data: {
                            version: 8,
                            imports: [{id: 'child1', url: '/styles/child1.json'}],
                            sources: {childSource2: {type: 'vector', tiles: []}},
                            layers: []
                        }
                    }
                ]
            }
        };

        const spy = vi.fn();

        networkWorker.use(
            http.get('/style.json', ({request}) => {
                spy(request);
                return HttpResponse.json(initialStyle);
            }),
            http.get('/styles/parent.json', ({request}) => {
                spy(request);
                return HttpResponse.json(parentFragment);
            }),
            http.get('/styles/child1.json', ({request}) => {
                spy(request);
                return HttpResponse.json(childFragment1);
            }),
            http.get('/styles/child2.json', ({request}) => {
                spy(request);
                return HttpResponse.json(childFragment2);
            }),
        );

        style.loadURL('/style.json');
        await waitFor(style, "style.load");
        expect(spy).toHaveBeenCalledTimes(4);

        const {id: parentStyleId, style: parentStyle} = style.fragments[0];
        expect(parentStyleId).toEqual(expectedImport.id);
        expect(parentStyle.stylesheet.layers).toEqual(expectedImport.data.layers);
        expect(parentStyle.stylesheet.sources).toEqual(expectedImport.data.sources);

        for (let i = 0; i < parentStyle.fragments.length; i++) {
            const {id: childStyleId, style: childStyle} = parentStyle.fragments[i];
            expect(childStyleId).toEqual(expectedImport.data.imports[i].id);
            expect(childStyle.stylesheet.layers).toEqual(expectedImport.data.imports[i].data.layers);
            expect(childStyle.stylesheet.sources).toEqual(expectedImport.data.imports[i].data.sources);
        }
    });

    test('fires "style.import.load"', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        networkWorker.use(
            http.get('/style.json', () => {
                return HttpResponse.json(initialStyle);
            }),
            http.get('/styles/streets-v12.json', () => {
                return HttpResponse.json(createStyleJSON());
            })
        );

        const spy = vi.fn();
        map.on('style.import.load', spy);

        style.loadURL('/style.json');

        await waitFor(style, "style.load");
        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy.mock.calls[0][0].target).toEqual(map);
        expect(spy.mock.calls[0][0].style.scope).toEqual('streets');

    });

    test('fires "dataloading"', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        networkWorker.use(
            http.get('/style.json', () => {
                return HttpResponse.json(initialStyle);
            }),
            http.get('/styles/streets-v12.json', () => {
                return HttpResponse.json(createStyleJSON());
            })
        );

        const spy = vi.fn();
        map.on('dataloading', spy);

        style.loadURL('/style.json');

        await waitFor(style, "style.load");
        expect(spy).toHaveBeenCalledTimes(2);

        expect(spy.mock.calls[0][0].target).toEqual(map);
        expect(spy.mock.calls[0][0].dataType).toEqual('style');
        expect(spy.mock.calls[0][0].style.scope).toEqual('');

        expect(spy.mock.calls[1][0].target).toEqual(map);
        expect(spy.mock.calls[1][0].dataType).toEqual('style');
        expect(spy.mock.calls[1][0].style.scope).toEqual('streets');

    });

    test('fires "data"', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        networkWorker.use(
            http.get('/style.json', () => {
                return HttpResponse.json(initialStyle);
            }),
            http.get('/styles/streets-v12.json', () => {
                return HttpResponse.json(createStyleJSON());
            })
        );

        const spy = vi.fn();
        map.on('data', spy);

        style.loadURL('/style.json');

        await waitFor(style, "style.load");
        expect(spy).toHaveBeenCalledTimes(2);

        // initial root style 'data' event
        expect(spy.mock.calls[0][0].target).toEqual(map);
        expect(spy.mock.calls[0][0].dataType).toEqual('style');
        expect(spy.mock.calls[0][0].style.scope).toEqual('');

        // child style 'data' event
        expect(spy.mock.calls[1][0].target).toEqual(map);
        expect(spy.mock.calls[1][0].dataType).toEqual('style');
        expect(spy.mock.calls[1][0].style.scope).toEqual('streets');

    });

    test('validates the style', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        networkWorker.use(
            http.get('/style.json', () => {
                return HttpResponse.json(initialStyle);
            }),
            http.get('/styles/streets-v12.json', () => {
                return HttpResponse.json(createStyleJSON({version: 'invalid'}));
            })
        );

        style.loadURL('/style.json');
        const {error} = await waitFor(map, "error");
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/version/);

    });
});

describe('Style#loadJSON', () => {
    test('imports style from URL', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}]
        });

        const fragment = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        const spy = vi.fn();

        networkWorker.use(
            http.get('/styles/streets-v12.json', ({request}) => {
                spy(request);
                return HttpResponse.json(fragment);
            })
        );

        style.loadJSON(initialStyle);
        await waitFor(style, "style.load");
        expect(spy).toHaveBeenCalledTimes(1);

        const fragmentStyle = style.getFragmentStyle('streets');
        expect(fragmentStyle.stylesheet.layers).toEqual(fragment.layers);
        expect(fragmentStyle.stylesheet.sources).toEqual(fragment.sources);
    });

    test('imports style from JSON', async () => {
        const style = new Style(new StubMap());
        const spy = vi.spyOn(window, 'fetch');

        const fragment = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        expect(spy).not.toHaveBeenCalled();

        const fragmentStyle = style.getFragmentStyle('streets');
        expect(fragmentStyle.stylesheet.layers).toEqual(fragment.layers);
        expect(fragmentStyle.stylesheet.sources).toEqual(fragment.sources);
    });

    test('limits nesting', async () => {
        const style = new Style(new StubMap());
        const stub = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const MAX_IMPORT_DEPTH = 5;
        function createNestedStyle(style = createStyleJSON(), depth = MAX_IMPORT_DEPTH + 1) {
            if (depth === 0) return style;
            const nextStyle = createStyleJSON({imports: [{id: `streets-${depth}`, url: '/style.json', data: style}]});
            return createNestedStyle(nextStyle, depth - 1);
        }

        const initialStyle = createNestedStyle();

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        let nestedStyle = style;
        for (let i = 1; i < MAX_IMPORT_DEPTH; i++) {
            nestedStyle = nestedStyle.getFragmentStyle(`streets-${i}`);
            expect(nestedStyle).toBeTruthy();
        }

        expect(stub).toHaveBeenCalledTimes(1);
        expect(nestedStyle.fragments.length).toEqual(0);

    });

    test('fires "style.import.load"', async () => {
        const map = new StubMap();

        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: createStyleJSON()}],
        });

        const spy = vi.fn();
        map.on('style.import.load', spy);

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy.mock.calls[0][0].target).toEqual(map);
        expect(spy.mock.calls[0][0].style.scope).toEqual('streets');

    });

    test('fires "dataloading"', async () => {
        const map = new StubMap();

        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: createStyleJSON()}],
        });

        const spy = vi.fn();
        map.on('dataloading', spy);

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        expect(spy).toHaveBeenCalledTimes(2);

        expect(spy.mock.calls[0][0].target).toEqual(map);
        expect(spy.mock.calls[0][0].dataType).toEqual('style');
        expect(spy.mock.calls[0][0].style.scope).toEqual('');

        expect(spy.mock.calls[1][0].target).toEqual(map);
        expect(spy.mock.calls[1][0].dataType).toEqual('style');
        expect(spy.mock.calls[1][0].style.scope).toEqual('streets');
    });

    test('fires "data"', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: createStyleJSON()}],
        });

        const spy = vi.fn();
        map.on('data', spy);

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        expect(spy).toHaveBeenCalledTimes(2);

        // initial root style 'data' event
        expect(spy.mock.calls[0][0].target).toEqual(map);
        expect(spy.mock.calls[0][0].dataType).toEqual('style');
        expect(spy.mock.calls[0][0].style.scope).toEqual('');

        // child style 'data' event
        expect(spy.mock.calls[1][0].target).toEqual(map);
        expect(spy.mock.calls[1][0].dataType).toEqual('style');
        expect(spy.mock.calls[1][0].style.scope).toEqual('streets');

    });

    test('validates the style', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: createStyleJSON({version: 'invalid'})}],
        });

        style.loadJSON(initialStyle);

        const {error} = await waitFor(map, "error");
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/version/);

    });

    test('creates sources', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'basemap', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        expect(style.getSource(makeFQID('mapbox', 'basemap')) instanceof VectorTileSource).toBeTruthy();

    });

    test('creates layers', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}},
                layers: [{
                    id: 'fill',
                    type: 'fill',
                    source: 'mapbox',
                    'source-layer': 'source-layer'
                }]
            })}],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        expect(style.getLayer(makeFQID('fill', 'streets')) instanceof StyleLayer).toBeTruthy();

    });

    test('own entities', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}},
                layers: [{id: 'background', type: 'background'}]
            })}],
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'background', type: 'background'}]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        expect(style.getLayer('background') instanceof StyleLayer).toBeTruthy();
        expect(style.getSource('mapbox') instanceof VectorTileSource).toBeTruthy();
        expect(style.getOwnLayer(makeFQID('background', 'streets')) instanceof StyleLayer).toBeFalsy();
        expect(
            style.getOwnSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource
        ).toBeFalsy();
        expect(style.getLayer(makeFQID('background', 'streets')) instanceof StyleLayer).toBeTruthy();
        expect(style.getSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource).toBeTruthy();

    });
});

describe('Style#addImport', () => {
    test('to the end', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");

        style.addImport({
            id: 'land', url: '/land.json', data: createStyleJSON({
                sources: {land: {type: 'vector', tiles: []}}
            })
        });

        expect(style.stylesheet.imports.map(({id}) => id)).toStrictEqual([
            'streets',
            'land'
        ]);
    });

    test('before another import', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [
                {id: 'streets', url: '/style.json', data: createStyleJSON({
                    sources: {mapbox: {type: 'vector', tiles: []}}
                })},
                {id: 'streets-v2', url: '/style.json', data: createStyleJSON({
                    sources: {mapbox: {type: 'vector', tiles: []}}
                })}
            ],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");

        style.addImport({
            id: 'land', url: '/land.json', data: createStyleJSON({
                sources: {land: {type: 'vector', tiles: []}}
            })
        }, 'streets-v2');

        style.addImport({
            id: 'land-v2', url: '/land.json', data: createStyleJSON({
                sources: {land: {type: 'vector', tiles: []}}
            })
        }, 'land');

        expect(style.stylesheet.imports.map(({id}) => id)).toStrictEqual([
            'streets',
            'land-v2',
            'land',
            'streets-v2'
        ]);
    });
});

describe('Style#updateImport', () => {
    test('updates import with provided json', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}},
                schema: {
                    lightPreset: {
                        type: 'string',
                        default: 'day'
                    }
                }
            })}],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");

        style.updateImport('streets', {
            id: 'streets',
            data: createStyleJSON({
                sources: {'mapbox-v12': {type: 'vector', tiles: []}}
            }),
            config: {
                lightPreset: 'night'
            }
        });

        expect(style.stylesheet.imports[style.getImportIndex('streets')].config).toStrictEqual({
            lightPreset: 'night'
        });
        expect(style.fragments[0].style.stylesheet).toStrictEqual(createStyleJSON({
            sources: {'mapbox-v12': {type: 'vector', tiles: []}}
        }));
    });

    test('fetch style with URL after clean of data', async () => {
        const spy = vi.fn();
        const map = new StubMap();
        const style = new Style(map);

        networkWorker.use(
            http.get('/style.json', ({request}) => {
                spy(request);
                return HttpResponse.json(initialStyle);
            }),
        );

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}},
                schema: {
                    lightPreset: {
                        type: 'string',
                        default: 'day'
                    }
                }
            })}],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");

        expect(spy).not.toHaveBeenCalled();

        await new Promise(resolve => {
            map.on('style.import.load', () => {
                expect(spy).toHaveBeenCalledTimes(1);
                resolve();
            });
            style.updateImport('streets', {
                id: 'streets',
                url: '/style.json'
            });
        });
    });

    test('update URL and fetch style from new one', async () => {
        const spy = vi.fn();
        const map = new StubMap();
        const style = new Style(map);

        networkWorker.use(
            http.get('/style.json', () => {
                return HttpResponse.json(initialStyle);
            }),
            http.get('/style2.json', ({request}) => {
                spy(request);
                return HttpResponse.json(initialStyle);
            }),
        );

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json'}],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");

        expect(spy).not.toHaveBeenCalled();

        await new Promise(resolve => {
            map.on('style.import.load', () => {
                expect(spy).toHaveBeenCalledTimes(1);
                resolve();
            });
            style.updateImport('streets', {
                id: 'streets',
                url: '/style2.json'
            });
        });
    });
});

describe('Style#getImportGlobalIds', () => {
    test('should return all imports', async () => {
        const style = new Style(new StubMap());

        networkWorker.use(
            http.get('/standard.json', () => {
                return HttpResponse.json(createStyleJSON());
            }),
            http.get('/standard-2.json', () => {
                return HttpResponse.json(createStyleJSON());
            }),
            http.get('/supplement.json', () => {
                return HttpResponse.json(createStyleJSON());
            }),
            http.get('/roads.json', () => {
                return HttpResponse.json(createStyleJSON());
            }),
        );

        style.loadJSON({
            version: 8,
            imports: [
                {
                    id: 'supplement',
                    url: '/supplement.json',
                    data: {
                        version: 8,
                        layers: [],
                        sources: {},
                        imports: [
                            {
                                id: 'inner',
                                url: '/inner.json',
                                data: {
                                    version: 8,
                                    layers: [],
                                    sources: {},
                                    imports: [
                                        {
                                            id: 'basemap-2',
                                            url: '/standard-2.json'
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                },
                {
                    id: 'roads',
                    url: '/roads.json'
                },
                {
                    id: 'wrapper',
                    url: '/non-standard.json',
                    data: {
                        version: 8,
                        layers: [],
                        sources: {},
                        imports: [
                            {
                                id: 'basemap',
                                url: '/standard.json'
                            }
                        ]
                    }
                }
            ],
            layers: [],
            sources: {}
        });

        await waitFor(style, "style.load");

        expect(style.getImportGlobalIds()).toEqual([
            "json://2572277275",
            "json://978922503",
            new URL("/standard-2.json", location.href).toString(),
            new URL("/roads.json", location.href).toString(),
            "json://3288768429",
            new URL("/standard.json", location.href).toString(),
        ]);
    });
});

describe('Style#addSource', () => {
    test('same id in different scopes', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.addSource('mapbox', {type: 'vector', tiles: []});

        expect(style.getSource('mapbox') instanceof VectorTileSource).toBeTruthy();
        expect(style.getSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource).toBeTruthy();
    });

    test('sets up source event forwarding', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        const spy = vi.fn();

        await new Promise((resolve) => {

            map.on('error', () => { spy(); });

            map.on('data', (e) => {
                if (e.dataType === 'style') return;

                if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                    spy();
                } else if (e.sourceDataType === 'content' && e.dataType === 'source') {
                    spy();
                    expect(spy).toHaveBeenCalledTimes(4);
                    resolve();
                } else {
                    spy();
                }
            });

            style.on('style.load', () => {
                const source = style.getSource(makeFQID('mapbox', 'streets'));
                source.fire(new Event('error'));
                source.fire(new Event('data'));
            });

            style.loadJSON(initialStyle);
        });
    });
});

describe('Style#removeSource', () => {
    test('same id in different scope is intact', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.removeSource('mapbox');
        expect(style.getSource('mapbox')).toBeFalsy();
        expect(style.getSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource).toBeTruthy();

    });
});

describe('Style#addLayer', () => {
    test('sets up layer event forwarding', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                layers: [{
                    id: 'background',
                    type: 'background'
                }]
            })}],
        });

        await new Promise(resolve => {

            map.on('error', (e) => {
                expect(e.layer).toStrictEqual({id: 'background'});
                expect(e.mapbox).toBeTruthy();
                resolve();
            });

            style.on('style.load', () => {
                const layer = style.getLayer(makeFQID('background', 'streets'));
                layer.fire(new Event('error', {mapbox: true}));
            });

            style.loadJSON(initialStyle);
        });
    });

    test('adds before the given layer', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'a', type: 'background'},
                        {id: 'b', type: 'background'},
                    ]
                })
            }],
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
            ]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.addLayer({id: 'c', type: 'background'}, 'a');

        expect(style.order).toEqual([
            makeFQID('a', 'streets'),
            makeFQID('b', 'streets'),
            'c',
            'a',
            'b'
        ]);

    });

    test('Checks scope exist after adding layer', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON());

        await waitFor(style, "style.load");
        style.addLayer({type: 'custom', id: 'custom', render: () => {}});
        expect(style.getLayer('custom').scope).toEqual(style.scope);
    });

    test('fire error on referencing before from different scope', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({layers: [{id: 'a', type: 'background'}]})
            }],
            layers: [{id: 'a', type: 'background'}]
        });

        await new Promise(resolve => {
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/does not exist on this map/);
                resolve();
            });

            style.on('style.load', () => {
                style.addLayer({id: 'c', type: 'background'}, makeFQID('a', 'streets'));
            });

            style.loadJSON(initialStyle);
        });
    });
});
describe('Style#removeLayer', () => {
    test('same id in different scope is intact', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            layers: [{id: 'background', type: 'background'}],
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                layers: [{id: 'background', type: 'background'}]
            })}],
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.removeLayer('background');
        expect(style.getLayer('background')).toBeFalsy();
        expect(style.getLayer(makeFQID('background', 'streets'))).toBeTruthy();

    });

    test('fire error on removing layer from different scope', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({layers: [{id: 'a', type: 'background'}]})
            }]
        });

        await new Promise(resolve => {
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/does not exist in the map\'s style/);
                resolve();
            });

            style.on('style.load', () => {
                style.removeLayer(makeFQID('a', 'streets'));
            });

            style.loadJSON(initialStyle);
        });
    });
});
describe('Style#moveLayer', () => {
    test('reorders layers', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'a', type: 'background'},
                        {id: 'b', type: 'background'},
                        {id: 'c', type: 'background'},
                    ]
                })
            }],
            layers: [
                {id: 'd', type: 'background'},
                {id: 'e', type: 'background'},
                {id: 'f', type: 'background'}
            ]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.moveLayer('d', 'f');

        expect(style.order).toEqual([
            makeFQID('a', 'streets'),
            makeFQID('b', 'streets'),
            makeFQID('c', 'streets'),
            makeFQID('e'),
            makeFQID('d'),
            makeFQID('f'),
        ]);
    });

    test('fires an error on moving layer from different scope', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({layers: [{id: 'background', type: 'background'}]})
            }]
        });

        await new Promise(resolve => {
            style.on('style.load', () => {
                style.on('error', ({error}) => {
                    expect(error.message).toMatch(/does not exist in the map\'s style/);
                    resolve();
                });

                style.moveLayer(makeFQID('background', 'streets'));
            });

            style.loadJSON(initialStyle);
        });
    });
});
describe('Style#_mergeLayers', () => {
    test('supports slots', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-water', type: 'slot'},
                        {id: 'water', type: 'background'},
                        {id: 'below-pois', type: 'slot'},
                        {id: 'pois', type: 'background'}
                    ]
                })
            }],
            layers: [
                {id: 'roads', type: 'background', slot: 'below-pois'},
                {id: 'national-park', type: 'background', slot: 'below-water'}
            ]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.addLayer({id: 'custom', type: 'custom', slot: 'below-water', render: () => {}});

        expect(style.order).toEqual([
            makeFQID('land', 'streets'),
            makeFQID('national-park'),
            makeFQID('custom'),
            makeFQID('water', 'streets'),
            makeFQID('roads'),
            makeFQID('pois', 'streets'),
        ]);

    });

    test('supports nested slots', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-road', type: 'slot'},
                        {id: 'road', type: 'background'}
                    ]
                })
            }],
            layers: [
                {id: 'park', type: 'background', slot: 'below-road'},
                {id: 'below-water', type: 'slot', slot: 'below-road'},
                {id: 'water', type: 'background', slot: 'below-road'}
            ]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.addLayer({id: 'waterway', type: 'background', slot: 'below-water'});

        expect(style.order).toEqual([
            makeFQID('land', 'streets'),
            makeFQID('park'),
            makeFQID('waterway'),
            makeFQID('water'),
            makeFQID('road', 'streets'),
        ]);
    });

    test('supports dynamic adding slots', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            layers: [
                {id: 'park', type: 'background'},
                {id: 'water', type: 'background'}
            ]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.addLayer({id: 'below-water', type: 'slot'}, 'water');
        style.addLayer({id: 'waterway', type: 'background', slot: 'below-water'});

        expect(style.order).toEqual([
            makeFQID('park'),
            makeFQID('waterway'),
            makeFQID('water'),
        ]);
    });

    test('supports adding layer into a slot with before', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-water', type: 'slot'},
                        {id: 'water', type: 'background'}
                    ]
                })
            }],
            layers: [{id: 'national-park', type: 'background', slot: 'below-water'}]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.addLayer({id: 'before-national-park', type: 'background', slot: 'below-water'}, 'national-park');

        expect(style.order).toEqual([
            makeFQID('land', 'streets'),
            makeFQID('before-national-park'),
            makeFQID('national-park'),
            makeFQID('water', 'streets'),
        ]);
    });

    test('supports adding layers into multiple slots with before', async () => {
        const style = new Style(new StubMap());
        const stub = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-road', type: 'slot'},
                        {id: 'road', type: 'background'},
                        {id: 'below-pois', type: 'slot'},
                        {id: 'pois', type: 'background'},
                    ]
                })
            }]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.addLayer({id: 'park', type: 'background', slot: 'below-road'});
        style.addLayer({id: 'landuse', type: 'background', slot: 'below-pois'}, 'park');
        style.addLayer({id: 'waterway', type: 'background', slot: 'below-road'}, 'landuse');
        style.addLayer({id: 'water', type: 'background', slot: 'below-road'}, 'waterway');
        style.addLayer({id: 'bridge', type: 'background', slot: 'below-pois'}, 'park');
        style.addLayer({id: 'tunnel', type: 'background', slot: 'below-pois'}, 'bridge');

        expect(style.order).toEqual([
            makeFQID('land', 'streets'),
            makeFQID('park'),
            makeFQID('water'),
            makeFQID('waterway'),
            makeFQID('road', 'streets'),
            makeFQID('landuse'),
            makeFQID('tunnel'),
            makeFQID('bridge'),
            makeFQID('pois', 'streets'),
        ]);

        expect(stub).toHaveBeenCalledTimes(2);
    });

    test('supports moving layer inside a slot', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-road', type: 'slot'},
                        {id: 'road', type: 'background'}
                    ]
                })
            }],
            layers: [
                {id: 'park', type: 'background', slot: 'below-road'},
                {id: 'waterway', type: 'background', slot: 'below-road'},
                {id: 'water', type: 'background', slot: 'below-road'}
            ]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        style.moveLayer('water', 'waterway');

        expect(style.order).toEqual([
            makeFQID('land', 'streets'),
            makeFQID('park'),
            makeFQID('water'),
            makeFQID('waterway'),
            makeFQID('road', 'streets'),
        ]);
    });

    test('supports moving layers inside multiple slots', async () => {
        const style = new Style(new StubMap());
        const stub = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-road', type: 'slot'},
                        {id: 'road', type: 'background'},
                        {id: 'below-pois', type: 'slot'},
                        {id: 'pois', type: 'background'},
                    ]
                })
            }],
            layers: [
                {id: 'park', type: 'background', slot: 'below-road'},
                {id: 'waterway', type: 'background', slot: 'below-road'},
                {id: 'water', type: 'background', slot: 'below-road'},
                {id: 'landuse', type: 'background', slot: 'below-pois'},
                {id: 'tunnel', type: 'background', slot: 'below-pois'},
                {id: 'bridge', type: 'background', slot: 'below-pois'}
            ]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        // Moving a layer before the layer in the same slot
        style.moveLayer('water', 'waterway');

        // Moving a layer before the layer in a different slot
        style.moveLayer('bridge', 'water');

        expect(style.order).toEqual([
            makeFQID('land', 'streets'),
            makeFQID('park'),
            makeFQID('water'),
            makeFQID('waterway'),
            makeFQID('road', 'streets'),
            makeFQID('landuse'),
            makeFQID('tunnel'),
            makeFQID('bridge'),
            makeFQID('pois', 'streets'),
        ]);

        expect(stub).toHaveBeenCalledTimes(1);
    });

    test('supports nested slots', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [
                {
                    id: 'streets',
                    url: 'mapbox://styles/mapbox/streets',
                    data: {
                        version: 8,
                        sources: {},
                        layers: [
                            {id: 'background', type: 'background'},
                            {id: 'below-fills', type: 'slot'},
                            {id: 'fill', type: 'background'},
                            {id: 'below-roads', type: 'slot'},
                            {id: 'roads', type: 'background'}
                        ]
                    }
                },
                {
                    id: 'overlay',
                    url: 'mapbox://styles/custom/overlay',
                    data: {
                        version: 8,
                        sources: {},
                        layers: [
                            {id: 'a', type: 'background', slot: 'below-fills'},
                            {id: 'c', type: 'background', slot: 'below-fills'},
                            {id: 'custom-points', type: 'slot', slot: 'below-fills'},
                            {id: 'b', type: 'background', slot: 'below-roads'},
                            {id: 'e', type: 'background', slot: 'below-roads'},
                            {id: 'd', type: 'background', slot: 'missing'}
                        ]
                    }
                }
            ],
            layers: [
                {id: 'a', type: 'background', slot: 'below-fills'},
                {id: 'b', type: 'background', slot: 'below-roads'},
                {id: 'c', type: 'background', slot: 'below-fills'},
                {id: 'd', type: 'background', slot: 'missing'},
                {id: 'e', type: 'background', slot: 'below-roads'},
                {id: 'f', type: 'background', slot: 'custom-points'}
            ]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        expect(style.order).toEqual([
            makeFQID('background', 'streets'),
            makeFQID('a', 'overlay'),
            makeFQID('c', 'overlay'),
            makeFQID('f'),
            makeFQID('a'),
            makeFQID('c'),
            makeFQID('fill', 'streets'),
            makeFQID('b', 'overlay'),
            makeFQID('e', 'overlay'),
            makeFQID('b'),
            makeFQID('e'),
            makeFQID('roads', 'streets'),
            makeFQID('d', 'overlay'),
            makeFQID('d'),
        ]);
    });
});
describe('Style#getLights', () => {
    test('root style resolves lights from import', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({lights: [
                    {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                    {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
                ]})
            }],
        }));

        await waitFor(style, "style.load");
        expect(style.getLights()).toEqual([
            {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
            {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
        ]);
    });

    test('root style overrides lights in imports', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
            ],
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({lights: [
                    {id: 'sun', type: 'directional', properties: {intensity: 0.6}},
                    {id: 'environment', type: 'ambient', properties: {intensity: 0.6}}
                ]})
            }],
        }));

        await waitFor(style, "style.load");
        expect(style.getLights()).toEqual([
            {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
            {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
        ]);
    });

    test(
        'empty lights in import does not override lights in root style',
        async () => {
            const style = new Style(new StubMap());

            style.loadJSON(createStyleJSON({
                lights: [
                    {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                    {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
                ],
                imports: [{
                    id: 'streets',
                    url: '/styles/streets-v12.json',
                    data: createStyleJSON()
                }],
            }));

            await waitFor(style, "style.load");
            expect(style.getLights()).toEqual([
                {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
            ]);
        }
    );
});

describe('Terrain', () => {
    test('root style resolves terrain from import', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({
                    terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                    sources: {
                        'mapbox-dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            maxzoom: 14
                        }
                    },
                })
            }],
        }));

        await waitFor(style, "style.load");
        expect(style.getTerrain()).toEqual({source: 'mapbox-dem', exaggeration: 1.5});
    });

    test('root style overrides terrain in imports', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'first',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({
                    terrain: {source: 'dem', exaggeration: 1},
                    sources: {
                        'dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            maxzoom: 14
                        }
                    },
                    imports: [{
                        id: 'second',
                        url: '/styles/streets-v12.json',
                        data: createStyleJSON({
                            terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                            sources: {
                                'mapbox-dem': {
                                    type: 'raster-dem',
                                    tiles: ['http://example.com/{z}/{x}/{y}.png'],
                                    tileSize: 256,
                                    maxzoom: 14
                                }
                            },
                        })
                    }]
                })
            }],
        }));

        await waitFor(style, "style.load");
        expect(style.getTerrain()).toEqual({source: 'dem', exaggeration: 1});
    });

    test('root style disables terrain in imports', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            terrain: null,
            imports: [{
                id: 'basemap',
                url: '',
                data: createStyleJSON({
                    projection: {name: 'globe'},
                    terrain: {source: 'dem', exaggeration: 1},
                    sources: {dem: {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']}}
                })
            }]
        }));

        await waitFor(style, "style.load");
        expect(style.getTerrain()).toEqual(null);
    });

    test('empty root style terrain overrides terrain in imports', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            terrain: {source: 'mapbox-dem', exaggeration: 2},
            sources: {
                'mapbox-dem': {
                    type: 'raster-dem',
                    tiles: ['http://example.com/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    maxzoom: 14
                }
            },
            imports: [{
                id: 'basemap',
                url: '/standard.json',
                data: createStyleJSON({
                    terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                    sources: {
                        'mapbox-dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            maxzoom: 14
                        }
                    },
                })
            }],
        }));

        await waitFor(style, "style.load");
        style.setTerrain(null);
        expect(style.getTerrain()).toEqual(null);
    });

    test('setState correctly overrides terrain in the root style', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const importWithTerrain = {
            id: 'basemap',
            url: '/standard.json',
            data: createStyleJSON({
                terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                sources: {
                    'mapbox-dem': {
                        type: 'raster-dem',
                        tiles: ['http://example.com/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        maxzoom: 14
                    }
                },
            })
        };

        const rootWithTerrain = createStyleJSON({
            terrain: {source: 'mapbox-dem', exaggeration: 2},
            sources: {
                'mapbox-dem': {
                    type: 'raster-dem',
                    tiles: ['http://example.com/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    maxzoom: 14
                }
            },
            imports: [importWithTerrain],
        });

        const rootWithoutTerrain = createStyleJSON({
            imports: [importWithTerrain],
        });

        // Using terrain from the root style
        style.loadJSON(rootWithTerrain);
        await new Promise((resolve) => map.on('style.load', resolve));
        expect(style.terrain.scope).toEqual(style.scope);
        expect(style.getTerrain()).toEqual({source: 'mapbox-dem', exaggeration: 2});

        // Using terrain from the imported style
        style.setState(rootWithoutTerrain);
        expect(style.terrain.scope).toEqual(style.getFragmentStyle('basemap').scope);
        expect(style.getTerrain()).toEqual({source: 'mapbox-dem', exaggeration: 1.5});

        // Using terrain from the root style again
        style.setState(rootWithTerrain);
        expect(style.terrain.scope).toEqual(style.scope);
        expect(style.getTerrain()).toEqual({source: 'mapbox-dem', exaggeration: 2});
    });

    test(
        'empty terrain in import does not override terrain in root style',
        async () => {
            const style = new Style(new StubMap());

            style.loadJSON(createStyleJSON({
                terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                sources: {
                    'mapbox-dem': {
                        type: 'raster-dem',
                        tiles: ['http://example.com/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        maxzoom: 14
                    }
                },
                imports: [{
                    id: 'streets',
                    url: '/styles/streets-v12.json',
                    data: createStyleJSON({terrain: undefined})
                }],
            }));

            await waitFor(style, "style.load");
            expect(style.getTerrain()).toEqual({source: 'mapbox-dem', exaggeration: 1.5});
        }
    );

    test(
        'multiple imports should not reset the style changed state when terrain and 3d layers are present',
        async () => {
            const map = new StubMap();
            const style = new Style(map);

            const initialStyle = createStyleJSON({
                imports: [
                    {id: 'basemap', url: '/standard.json'},
                    {id: 'navigation', url: '/navigation.json'}
                ],
            });

            const standardFragment = createStyleJSON({
                terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                sources: {
                    composite: {type: 'vector', tiles: []},
                    'mapbox-dem': {
                        type: 'raster-dem',
                        tiles: ['http://example.com/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        maxzoom: 14
                    }
                },
                layers: [
                    {id: 'land', type: 'background'},
                    {id: '3d-building', type: 'fill-extrusion', source: 'composite', 'source-layer': 'building'}
                ]
            });

            const navigationFragment = createStyleJSON({
                sources: {composite: {type: 'vector', tiles: []}},
                layers: [{id: 'traffic', type: 'line', source: 'composite', 'source-layer': 'traffic'}]
            });

            const spy = vi.fn();

            networkWorker.use(
                http.get('/style.json', ({request}) => {
                    spy(request);
                    return HttpResponse.json(initialStyle);
                }),
                http.get('/standard.json', ({request}) => {
                    spy(request);
                    return HttpResponse.json(standardFragment);
                }),
                http.get('/navigation.json', ({request}) => {
                    spy(request);
                    return HttpResponse.json(navigationFragment);
                })
            );

            style.loadURL('/style.json');

            await waitFor(map, "style.import.load");
            expect(style._changes.isDirty()).toEqual(true);
            await waitFor(style, "style.load");
            expect(spy).toHaveBeenCalledTimes(3);
            expect(style._changes.isDirty()).toEqual(true);

        }
    );

    test('supports config', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'standard',
                url: '/standard.json',
                config: {showTerrain: true},
                data: createStyleJSON({
                    schema: {
                        showTerrain: {
                            default: true
                        }
                    },
                    terrain: {source: 'mapbox-dem', exaggeration: ['case', ['config', 'showTerrain'], 2, 0]},
                    sources: {
                        'mapbox-dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png']
                        }
                    },
                })
            }]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        expect(style.terrain.getExaggeration(0)).toEqual(2);

        style.setConfigProperty('standard', 'showTerrain', false);
        style.update({});

        expect(style.terrain.getExaggeration(0)).toEqual(0);
    });

    test('setTerrain updates imported terrain properties', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [
                {
                    id: "basemap",
                    url: "",
                    data: createStyleJSON({
                        sources: {
                            "mapbox-dem": {
                                "type": "raster-dem",
                                "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                                "tileSize": 256,
                                "maxzoom": 14
                            }
                        },
                        terrain: {
                            source: "mapbox-dem",
                            exaggeration: 1
                        }
                    })
                }
            ]
        }));

        await waitFor(style, "style.load");

        style.setTerrain({
            exaggeration: 2
        });

        expect(style.getTerrain().exaggeration).toEqual(2);
    });
});
describe('Style#getFog', () => {
    test('resolves fog from import', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({fog: {range: [1, 2], color: 'white', 'horizon-blend': 0}})
            }],
        }));

        await waitFor(style, "style.load");
        const fog = style.getFog();
        expect(fog).toBeTruthy();
        expect(fog.color).toEqual('white');
        expect(fog.range).toEqual([1, 2]);
        expect(fog['horizon-blend']).toEqual(0);
    });

    test('root style overrides fog in imports', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'first',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({
                    fog: {range: [1, 2], color: 'white', 'horizon-blend': 0},
                    imports: [{
                        id: 'second',
                        url: '/styles/streets-v12.json',
                        data: createStyleJSON({fog: {range: [0, 1], color: 'blue', 'horizon-blend': 0.5}})
                    }]
                })
            }],
        }));

        await waitFor(style, "style.load");
        const fog = style.getFog();
        expect(fog).toBeTruthy();
        expect(fog.color).toEqual('white');
        expect(fog.range).toEqual([1, 2]);
        expect(fog['horizon-blend']).toEqual(0);
    });

    test('empty fog in import does not override fog in root style', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            fog: {range: [1, 2], color: 'white', 'horizon-blend': 0},
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({fog: undefined})
            }],
        }));

        await waitFor(style, "style.load");
        const fog = style.getFog();
        expect(fog).toBeTruthy();
        expect(fog.color).toEqual('white');
        expect(fog.range).toEqual([1, 2]);
        expect(fog['horizon-blend']).toEqual(0);
    });
});
describe('Camera', () => {
    test('resolves camera from import', async () => {
        const map = new StubMap();
        const style = new Style(map);

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({camera: {'camera-projection': 'orthographic'}})
            }],
        }));

        await waitFor(style, "style.load");
        expect(style.camera).toEqual({'camera-projection': 'orthographic'});
    });

    test(
        'sequential imports dont override orthographic camera with perspective',
        async () => {
            const map = new StubMap();
            const style = new Style(map);

            style.loadJSON(createStyleJSON({
                imports: [
                    {
                        id: 'basemap',
                        url: '/standard.json',
                        data: createStyleJSON({camera: {'camera-projection': 'orthographic'}})
                    },
                    {
                        id: 'navigation',
                        url: '/navigation.json',
                        data: createStyleJSON()
                    }
                ],
            }));

            const spy = vi.spyOn(map, '_triggerCameraUpdate');

            await waitFor(style, "style.load");
            expect(style.camera).toEqual({'camera-projection': 'orthographic'});
            expect(spy.mock.calls[spy.mock.calls.length - 1][0]).toEqual({'camera-projection': 'orthographic'});
        }
    );

    test('root style overrides camera in imports', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'first',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({
                    camera: {'camera-projection': 'perspective'},
                    imports: [{
                        id: 'second',
                        url: '/styles/streets-v12.json',
                        data: createStyleJSON({camera: {'camera-projection': 'orthographic'}})
                    }]
                })
            }],
        }));

        await waitFor(style, "style.load");
        expect(style.camera).toEqual({'camera-projection': 'perspective'});
    });

    test('camera set by user overrides camera in imports', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            camera: {'camera-projection': 'perspective'},
            imports: [{
                id: 'first',
                url: '/styles/streets-v12.json',
                data: createStyleJSON()
            }],
        }));

        await waitFor(style, "style.load");
        style.setCamera({'camera-projection': 'orthographic'});
        expect(style.camera).toEqual({'camera-projection': 'orthographic'});
    });

    test(
        'empty camera in import does not override camera in root style',
        async () => {
            const style = new Style(new StubMap());

            style.loadJSON(createStyleJSON({
                camera: {'camera-projection': 'orthographic'},
                imports: [{
                    id: 'streets',
                    url: '/styles/streets-v12.json',
                    data: createStyleJSON()
                }],
            }));

            await waitFor(style, "style.load");
            expect(style.camera).toEqual({'camera-projection': 'orthographic'});
        }
    );
});
describe('Projection', () => {
    test('resolves projection from import', async () => {
        const map = new StubMap();
        const style = new Style(map);

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({projection: {name: 'globe'}})
            }],
        }));

        const spy = vi.spyOn(map, '_prioritizeAndUpdateProjection');

        await waitFor(style, "style.load");
        expect(style.projection).toEqual({name: 'globe'});
        expect(spy.mock.calls[spy.mock.calls.length - 1][1]).toEqual({name: 'globe'});
    });

    test('root style overrides projection in imports', async () => {
        const map = new StubMap();
        const style = new Style(map);

        style.loadJSON(createStyleJSON({
            projection: {name: 'globe'},
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({projection: {name: 'albers'}})
            }],
        }));

        const spy = vi.spyOn(map, '_prioritizeAndUpdateProjection');

        await waitFor(style, "style.load");
        expect(style.projection).toEqual({name: 'globe'});
        expect(spy.mock.calls[spy.mock.calls.length - 1][1]).toEqual({name: 'globe'});
    });

    test(
        'empty projection in import does not override projection in root style',
        async () => {
            const map = new StubMap();
            const style = new Style(map);

            style.loadJSON(createStyleJSON({
                projection: {name: 'albers'},
                imports: [{
                    id: 'streets',
                    url: '/styles/streets-v12.json',
                    data: createStyleJSON()
                }],
            }));

            const spy = vi.spyOn(map, '_prioritizeAndUpdateProjection');

            await waitFor(style, "style.load");
            expect(style.projection).toEqual({name: 'albers'});
            expect(spy.mock.calls[spy.mock.calls.length - 1][1]).toEqual({name: 'albers'});
        }
    );
});
describe('Transition', () => {
    test('resolves transition from import', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{id: 'standard', url: '/standard.json', data: createStyleJSON({
                transition: {duration: 900, delay: 200},
            })}]
        }));

        await waitFor(style, "style.load");
        expect(style.transition).toEqual({duration: 900, delay: 200});

        style.setTransition({duration: 0, delay: 0});
        expect(style.transition).toEqual({duration: 0, delay: 0});
    });

    test('root style overrides transition in imports', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            transition: {duration: 600, delay: 100},
            imports: [{id: 'standard', url: '/standard.json', data: createStyleJSON({
                transition: {duration: 900, delay: 200},
            })}]
        }));

        await waitFor(style, "style.load");
        expect(style.transition).toEqual({duration: 600, delay: 100});
    });
});
describe('Glyphs', () => {
    test('fallbacks to the default glyphs URL', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            fragment: true,
        }));

        await waitFor(style, "style.load");
        vi.spyOn(GlyphManager, 'loadGlyphRange').mockImplementation((stack, range, urlTemplate) => {
            expect(urlTemplate).toEqual('mapbox://fonts/mapbox/{fontstack}/{range}.pbf');
            expect(style.serialize().glyphs).toEqual(undefined);
        });

        style.glyphManager.getGlyphs({'Arial Unicode MS': [55]}, '');
    });
});

describe('Style#queryRenderedFeatures', () => {
    const transform = new Transform();
    transform.resize(512, 512);

    function tilesInStub() {
        return [{
            queryGeometry: {},
            tilespaceGeometry: {},
            bufferedTilespaceGeometry: {},
            bufferedTilespaceBounds: {},
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            tile: {tileID: new OverscaledTileID(0, 0, 0, 0, 0), queryRenderedFeatures: () => ({
                land: [{
                    featureIndex: 0,
                    feature: {type: 'Feature', geometry: {type: 'Point'}}
                }]
            })},
        }];
    }

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'land', type: 'line', source: 'mapbox'}],
    });

    const initialStyle = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'land', type: 'line', source: 'mapbox'}],
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    test('returns features only from the root style', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(initialStyle);

        await waitFor(style, 'style.load');
        style.getOwnSourceCache('mapbox').tilesIn = tilesInStub;
        style.getOwnSourceCache('mapbox').transform = transform;
        style.getSourceCache(makeFQID('mapbox', 'streets')).tilesIn = tilesInStub;
        style.getSourceCache(makeFQID('mapbox', 'streets')).transform = transform;

        const results = style.queryRenderedFeatures([0, 0], {}, transform);
        expect(results.length).toEqual(1);
    });

    test('returns features only from the root style when including layers', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(initialStyle);

        await waitFor(style, 'style.load');
        style.getOwnSourceCache('mapbox').tilesIn = tilesInStub;
        style.getOwnSourceCache('mapbox').transform = transform;
        style.getSourceCache(makeFQID('mapbox', 'streets')).tilesIn = tilesInStub;
        style.getSourceCache(makeFQID('mapbox', 'streets')).transform = transform;

        const results = style.queryRenderedFeatures([0, 0], {layers: ['land', makeFQID('land', 'streets')]}, transform);
        expect(results.length).toEqual(1);
    });
});

test('Style#setFeatureState', async () => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
    });

    const initialStyle = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    await new Promise(resolve => {
        const spy = vi.fn();
        style.on('error', spy);

        style.on('style.load', () => {
            style.setFeatureState({source: makeFQID('mapbox', 'streets'), id: 12345}, {'hover': true});
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0].error.message).toMatch(/does not exist in the map's style/);
            resolve();
        });
    });
});

test('Style#getFeatureState', () => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
    });

    const initialStyle = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = vi.fn();
    style.on('error', spy);

    style.on('style.load', () => {
        expect(style.getFeatureState({source: makeFQID('mapbox', 'streets'), id: 12345})).toBeFalsy();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].error.message).toMatch(/does not exist in the map's style/);
    });
});

test('Style#removeFeatureState', () => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
    });

    const initialStyle = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = vi.fn();
    style.on('error', spy);

    style.on('style.load', () => {
        style.removeFeatureState({source: makeFQID('mapbox', 'streets'), id: 12345}, 'hover');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].error.message).toMatch(/does not exist in the map's style/);
    });
});

test('Style#setLayoutProperty', () => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'land', type: 'line', source: 'mapbox', layout: {visibility: 'visible'}}],
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = vi.fn();
    style.on('error', spy);

    style.on('style.load', () => {
        style.setLayoutProperty(makeFQID('land', 'streets'), 'visibility', 'none');
        expect(spy.mock.calls[0][0].error.message).toMatch(/does not exist in the map's style/);

        expect(style.getLayoutProperty(makeFQID('land', 'streets'), 'visibility')).toBeFalsy();
        expect(spy.mock.calls[1][0].error.message).toMatch(/does not exist in the map's style/);

        expect(
            style.getLayer(makeFQID('land', 'streets')).serialize().layout['visibility']
        ).toEqual('visible');
        expect(spy).toHaveBeenCalledTimes(2);
    });
});

test('Style#setPaintProperty', () => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'land', type: 'background', source: 'mapbox', paint: {'background-color': 'blue'}}],
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = vi.fn();
    style.on('error', spy);

    style.on('style.load', () => {
        style.setPaintProperty(makeFQID('land', 'streets'), 'background-color', 'red');
        expect(spy.mock.calls[0][0].error.message).toMatch(/does not exist in the map's style/);

        expect(style.getPaintProperty(makeFQID('land', 'streets'), 'background-color')).toBeFalsy();
        expect(spy.mock.calls[1][0].error.message).toMatch(/does not exist in the map's style/);

        expect(
            style.getLayer(makeFQID('land', 'streets')).serialize().paint['background-color']
        ).toEqual('blue');
        expect(spy).toHaveBeenCalledTimes(2);
    });
});
test('Style#setLayerZoomRange', () => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'symbol', type: 'symbol', source: 'mapbox', minzoom: 0, maxzoom: 22}],
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = vi.fn();
    style.on('error', spy);

    style.on('style.load', () => {
        style.setLayerZoomRange(makeFQID('symbol', 'streets'), 5, 12);
        expect(spy.mock.calls[0][0].error.message).toMatch(/does not exist in the map's style/);

        expect(style.getLayer(makeFQID('symbol', 'streets')).minzoom).toEqual(0);
        expect(style.getLayer(makeFQID('symbol', 'streets')).maxzoom).toEqual(22);
    });
});

test('Style#setFilter', () => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'symbol', type: 'symbol', source: 'mapbox', filter: ['==', 'id', 0]}],
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = vi.fn();
    style.on('error', spy);

    style.on('style.load', () => {
        style.setFilter(makeFQID('symbol', 'streets'), ['==', 'id', 1]);
        expect(spy.mock.calls[0][0].error.message).toMatch(/does not exist in the map's style/);

        expect(style.getFilter(makeFQID('symbol', 'streets'))).toBeFalsy();
        expect(spy.mock.calls[1][0].error.message).toMatch(/does not exist in the map's style/);

        expect(style.getLayer(makeFQID('symbol', 'streets')).filter).toEqual(['==', 'id', 0]);
    });
});

test('Style#setGeoJSONSourceData', async () => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    await waitFor(style, 'style.load');
    expect(() =>
        style.setGeoJSONSourceData(makeFQID('mapbox', 'streets'), {type: 'FeatureCollection', features: []})).toThrowError(/There is no source with this ID/);
});

describe('Style#setConfigProperty', () => {
    test('Updates layers in scope', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'standard',
                url: '/standard.json',
                config: {showBackground: false},
                data: createStyleJSON({
                    layers: [{
                        id: 'background',
                        type: 'background',
                        layout: {visibility: ['case', ['config', 'showBackground'], 'visible', 'none']}
                    }],
                    schema: {
                        showBackground: {
                            default: false
                        }
                    }
                })
            }]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");

        expect(style.getConfigProperty('standard', 'showBackground')).toEqual(false);

        style.dispatcher.broadcast = function(key, value) {
            expect(key).toEqual('updateLayers');
            expect(value.scope).toEqual('standard');
            expect(value.removedIds).toEqual([]);
            const fqid = makeFQID('showBackground', 'standard');
            expect(value.options.get(fqid).value.value).toEqual(true);
            expect(value.layers.map(layer => layer.id)).toEqual(['background']);
        };

        style.setConfigProperty('standard', 'showBackground', true);
        expect(style.getConfigProperty('standard', 'showBackground')).toEqual(true);
        style.update({});
    });

    test('Reevaluates layer visibility', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'standard',
                url: '/standard.json',
                config: {showBackground: false},
                data: createStyleJSON({
                    layers: [{
                        id: 'background',
                        type: 'background',
                        layout: {visibility: ['case', ['config', 'showBackground'], 'visible', 'none']}
                    }],
                    schema: {showBackground: {default: false}}
                })
            }]
        });

        style.loadJSON(initialStyle);

        await waitFor(style, "style.load");
        const layer = style.getLayer(makeFQID('background', 'standard'));
        expect(layer.getLayoutProperty('visibility')).toEqual('none');

        style.setConfigProperty('standard', 'showBackground', true);
        expect(layer.getLayoutProperty('visibility')).toEqual('visible');
    });
});
describe('Style#setState', () => {
    test('Adds fragment', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON();
        style.loadJSON(initialStyle);

        await new Promise((resolve) => map.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        await new Promise((resolve) => map.on('style.import.load', resolve));

        expect(style.serialize()).toEqual(nextStyle);
    });

    test('Adds fragment to the existing fragments', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => map.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}, {id: 'b', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        await new Promise((resolve) => map.on('style.import.load', resolve));

        expect(style.serialize()).toEqual(nextStyle);
    });

    test('Adds fragment before another', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'b', url: '', data: createStyleJSON()}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => map.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}, {id: 'b', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        await new Promise((resolve) => map.on('style.import.load', resolve));

        expect(style.serialize()).toEqual(nextStyle);
    });

    test('Removes fragment', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}, {id: 'b', url: '', data: createStyleJSON()}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => style.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        expect(style.serialize()).toEqual(nextStyle);
    });

    test('Removes 3D light independently', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({imports: [{id: 'basemap', url: '', data: createStyleJSON({
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0.5}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.5}}
            ]
        })}]});

        style.loadJSON(initialStyle);
        await new Promise((resolve) => style.on('style.load', resolve));

        expect(style.ambientLight).toBeTruthy();
        expect(style.directionalLight).toBeTruthy();

        const nextStyle = createStyleJSON({imports: [{id: 'basemap', url: '', data: createStyleJSON({
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0.5}},
            ]
        })}]});

        style.setState(nextStyle);
        expect(style.serialize()).toEqual(nextStyle);

        expect(style.ambientLight).toBeFalsy();
        expect(style.directionalLight).toBeTruthy();
    });

    test('Removes all fragments', async () => {
        const style = new Style(new StubMap());

        const fragmentStyle = createStyleJSON({
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0.5}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.5}}
            ],
            fog: {range: [1, 2], color: 'white'},
            terrain: {source: 'mapbox-dem', exaggeration: 1.5},
            layers: [{id: 'land', type: 'background'}],
            sources: {'mapbox-dem': {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']}},
        });

        const initialStyle = createStyleJSON({imports: [{id: 'a', url: '', data: fragmentStyle}]});

        style.loadJSON(initialStyle);
        await new Promise((resolve) => style.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        style.setState(nextStyle);
        expect(style.serialize()).toEqual(nextStyle);

        expect(style.order).toEqual(['land']);
        expect(style.getSources().map((s) => s.id)).toEqual(['mapbox']);

        expect(style.ambientLight).toBeFalsy();
        expect(style.directionalLight).toBeFalsy();
        expect(style.fog).toBeFalsy();
        expect(style.terrain).toBeFalsy();
    });

    test('Moves fragment', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}, {id: 'b', url: '', data: createStyleJSON()}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => map.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'b', url: '', data: createStyleJSON()}, {id: 'a', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        await new Promise((resolve) => map.on('style.import.load', resolve));

        expect(style.serialize()).toEqual(nextStyle);
    });

    /**
     * @not For some reason in browser we not set loaded after style.load event
     */
    test.skip('Updates fragment URL', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const data = createStyleJSON({
            layers: [{id: 'a', type: 'background'}],
            schema: {lightPreset: {default: 'day'}}
        });

        networkWorker.use(
            http.get('/style1.json', () => {
                return HttpResponse.json(createStyleJSON({
                    schema: {lightPreset: {default: 'day'}}
                }));
            }),
            http.get('/style2.json', () => {
                return HttpResponse.json(data);
            })
        );

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '/style1.json', config: {lightPreset: 'night'}}],
            layers: [{id: 'b', type: 'background', paint: {'background-color': 'red'}}]
        });

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '/style2.json', config: {lightPreset: 'night'}}],
            layers: [{id: 'b', type: 'background', paint: {'background-color': 'pink'}}]
        });

        await new Promise(resolve => {
            map.on('style.load', () => {
                style.setState(nextStyle);

                expect(style.serialize()).toStrictEqual(createStyleJSON({
                    imports: [{id: 'a', url: '/style2.json', config: {lightPreset: 'night'}, data}],
                    layers: [{id: 'b', type: 'background', paint: {'background-color': 'pink'}}]
                }));

                expect(style.getConfigProperty('a', 'lightPreset')).toEqual('night');

                const updatedPaintProperties = style._changes.getUpdatedPaintProperties();
                expect(updatedPaintProperties.has('b')).toEqual(true);

                resolve();
            });

            style.loadJSON(initialStyle);
        });
    });

    test('Updates fragment data', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON({layers: [{id: 'a', type: 'background'}]})}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => style.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON({layers: [{id: 'b', type: 'background'}]})}]
        });

        style.setState(nextStyle);
        expect(style.serialize()).toEqual(nextStyle);
    });

    test('Updates layer slot', async () => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'middle', type: 'slot'},
                        {id: 'water', type: 'background'},
                        {id: 'top', type: 'slot'},
                        {id: 'labels', type: 'symbol', source: 'mapbox'}
                    ]
                })
            }],
            layers: [{id: 'layer', type: 'background', slot: 'middle'}]
        });

        style.loadJSON(initialStyle);

        await new Promise((resolve) => style.on('style.load', resolve));

        expect(style.order).toEqual([
            makeFQID('land', 'streets'),
            makeFQID('layer'),
            makeFQID('water', 'streets'),
            makeFQID('labels', 'streets'),
        ]);

        const nextStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'middle', type: 'slot'},
                        {id: 'water', type: 'background'},
                        {id: 'top', type: 'slot'},
                        {id: 'labels', type: 'symbol', source: 'mapbox'}
                    ]
                })
            }],
            layers: [{id: 'layer', type: 'background', slot: 'top'}]
        });

        style.setState(nextStyle);
        expect(style.serialize()).toEqual(nextStyle);

        expect(style.order).toEqual([
            makeFQID('land', 'streets'),
            makeFQID('water', 'streets'),
            makeFQID('layer'),
            makeFQID('labels', 'streets'),
        ]);
    });
});
test('Style#serialize', async () => {
    const style = new Style(new StubMap());

    const fragmentStyle = createStyleJSON({
        fog: {range: [1, 2], color: 'white', 'horizon-blend': 0},
        lights: [
            {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
            {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
        ],
        camera: {'camera-projection': 'orthographic'},
        sources: {'mapbox-dem': {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']}},
        terrain: {source: 'mapbox-dem', exaggeration: 1.5},
        projection: {name: 'globe'},
        transition: {duration: 900, delay: 200}
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'basemap', url: '', data: fragmentStyle}]
    });

    await new Promise((resolve) => {

        style.on('style.load', () => {
            const serialized = style.serialize();

            expect(serialized.fog).toBeFalsy();
            expect(serialized.lights).toBeFalsy();
            expect(serialized.camera).toBeFalsy();
            expect(serialized.terrain).toBeFalsy();
            expect(serialized.projection).toBeFalsy();
            expect(serialized.transition).toBeFalsy();
            expect(serialized.sources).toEqual({});

            resolve();
        });

        style.loadJSON(initialStyle);
    });
});

test('Style#areTilesLoaded', async () => {
    const style = new Style(new StubMap());

    const source = {type: 'geojson', data: {type: 'FeatureCollection', features: []}};
    const initialStyle = createStyleJSON({
        sources: {geojson: source},
        imports: [{id: 'basemap', url: '', data: createStyleJSON({
            sources: {geojson: source}
        })}]
    });

    expect(style.areTilesLoaded()).toEqual(true);

    await new Promise((resolve) => {
        style.on('style.load', () => {
            const fakeTileId = new OverscaledTileID(0, 0, 0, 0, 0);
            style.getOwnSourceCache('geojson')._tiles[fakeTileId.key] = new Tile(fakeTileId);
            expect(style.areTilesLoaded()).toEqual(false);

            style.getOwnSourceCache('geojson')._tiles[fakeTileId.key].state = 'loaded';
            expect(style.areTilesLoaded()).toEqual(true);

            style.getSourceCache(makeFQID('geojson', 'basemap'))._tiles[fakeTileId.key] = new Tile(fakeTileId);
            expect(style.areTilesLoaded()).toEqual(false);

            style.getSourceCache(makeFQID('geojson', 'basemap'))._tiles[fakeTileId.key].state = 'loaded';
            expect(style.areTilesLoaded()).toEqual(true);

            resolve();
        });

        style.loadJSON(initialStyle);
    });
});
