import {describe, test, beforeAll, beforeEach, afterEach, afterAll, expect, waitFor, vi} from "../../util/vitest.js";
import {getNetworkWorker, http, HttpResponse, getPNGResponse} from '../../util/network.js';
import Style from '../../../src/style/style.js';
import SourceCache from '../../../src/source/source_cache.js';
import StyleLayer from '../../../src/style/style_layer.js';
import Transform from '../../../src/geo/transform.js';
import {extend} from '../../../src/util/util.js';
import {RequestManager} from '../../../src/util/mapbox.js';
import {Event, Evented} from '../../../src/util/evented.js';
import styleSpec from '../../../src/style-spec/reference/latest.js';
import {
    setRTLTextPlugin,
    clearRTLTextPlugin,
    evented as rtlTextPluginEvented
} from '../../../src/source/rtl_text_plugin.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';

function createStyleJSON(properties) {
    return extend({
        "version": 8,
        "sources": {},
        "layers": []
    }, properties);
}

function createSource() {
    return {
        type: 'vector',
        minzoom: 1,
        maxzoom: 10,
        attribution: 'Mapbox',
        tiles: ['http://example.com/{z}/{x}/{y}.png']
    };
}

function createGeoJSONSource() {
    return {
        "type": "geojson",
        "data": {
            "type": "FeatureCollection",
            "features": []
        }
    };
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

describe('Style', () => {
    test('registers plugin state change listener', () => {
        clearRTLTextPlugin();
        networkWorker.use(http.all('*', () => new HttpResponse(null)));
        vi.spyOn(Style, 'registerForPluginStateChange');
        const style = new Style(new StubMap());
        vi.spyOn(style.dispatcher, 'broadcast').mockImplementation(() => {});
        expect(Style.registerForPluginStateChange).toHaveBeenCalledTimes(1);

        setRTLTextPlugin("/plugin.js",);
        expect(style.dispatcher.broadcast.mock.calls[0][0]).toEqual("syncRTLPluginState");
        expect(style.dispatcher.broadcast.mock.calls[0][1]).toEqual({
            pluginStatus: 'deferred',
            pluginURL: expect.stringContaining("/plugin.js")
        });
        // window.clearFakeWorkerPresence();
    });

    /**
     * @note Currently we cannot mock workers
     * @see https://github.com/vitest-dev/vitest/issues/4033
     * @todo Test with @vitest/web-worker
     */
    test.skip('loads plugin immediately if already registered', async () => {
        clearRTLTextPlugin();
        networkWorker.use(http.get('/plugin.js', new HttpResponse("doesn't matter")));
        window.URL.createObjectURL = () => 'blob:';

        await new Promise(resolve => {
            let firstError = true;
            setRTLTextPlugin("/plugin.js", (error) => {
                // Getting this error message shows the bogus URL was succesfully passed to the worker
                // We'll get the error from all workers, only pay attention to the first one
                if (firstError) {
                    expect(error.message).toEqual('RTL Text Plugin failed to import scripts from /plugin.js');
                    firstError = false;
                    resolve();
                }
            });
            new Style(createStyleJSON());
        });
    });
});

describe('Style#loadURL', () => {
    test('fires "dataloading"', async () => {
        const style = new Style(new StubMap());
        const spy = vi.fn();

        networkWorker.use(
            http.get('/style.json', () => HttpResponse.json(createStyleJSON()))
        );

        style.on('dataloading', spy);
        style.loadURL('/style.json');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].target).toEqual(style);
        expect(spy.mock.calls[0][0].dataType).toEqual('style');
    });

    test('transforms style URL before request', async () => {
        const map = new StubMap();
        const spy = vi.spyOn(map._requestManager, 'transformRequest');

        networkWorker.use(
            http.get('/style.json', () => {
                return HttpResponse.json(createStyleJSON());
            })
        );

        const style = new Style(map);
        style.loadURL('/style.json');

        await waitFor(style, 'style.load');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual('/style.json');
        expect(spy.mock.calls[0][1]).toEqual('Style');
    });

    test('validates the style', async () => {
        const style = new Style(new StubMap());

        networkWorker.use(
            http.get('/style.json', () => {
                return HttpResponse.json(createStyleJSON({version: 'invalid'}));
            })
        );

        style.loadURL('/style.json');

        const {error} = await waitFor(style, "error");
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/version/);

    });

    test('skips validation for mapbox:// styles', async () => {
        networkWorker.use(
            http.get('https://api.mapbox.com/styles/v1/test/test', () => {
                return HttpResponse.json(createStyleJSON({version: 'invalid'}));
            })
        );

        await new Promise(resolve => {
            const style = new Style(new StubMap())
                .on('error', () => {
                    expect.unreachable();
                })
                .on('style.load', () => {
                    resolve();
                });

            style.loadURL('mapbox://styles/test/test', {accessToken: 'none'});
        });
    });

    test('cancels pending requests if removed', () => {
        const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
        const style = new Style(new StubMap());
        style.loadURL('style.json');
        style._remove();
        expect(abortSpy).toHaveBeenCalledTimes(1);
    });
});

describe('Style#loadJSON', () => {
    test('fires "dataloading" (synchronously)', async () => {
        const style = new Style(new StubMap());
        const spy = vi.fn();

        style.on('dataloading', spy);
        style.loadJSON(createStyleJSON());

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].target).toEqual(style);
        expect(spy.mock.calls[0][0].dataType).toEqual('style');
    });

    test('fires "data" (asynchronously)', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON());

        const e = await waitFor(style, "data");
        expect(e.target).toEqual(style);
        expect(e.dataType).toEqual('style');
    });

    test('fires "data" when the sprite finishes loading', async () => {
        networkWorker.use(
            http.get('http://example.com/sprite.png', async () => {
                return new HttpResponse(await getPNGResponse());
            }),
            http.get('http://example.com/sprite.json', async () => {
                return HttpResponse.json({});
            })
        );

        const style = new Style(new StubMap());

        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [],
            "sprite": "http://example.com/sprite"
        });

        await new Promise(resolve => {
            style.once('error', () => expect.unreachable());

            style.once('data', (e) => {
                expect(e.target).toBe(style);
                expect(e.dataType).toEqual('style');

                style.once('data', (e) => {
                    expect(e.target).toBe(style);
                    expect(e.dataType).toEqual('style');
                    resolve();
                });
            });
        });
    });

    test('validates the style', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({version: 'invalid'}));
        const {error} = await waitFor(style, "error");
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/version/);
    });

    test('creates sources', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
        await waitFor(style, "style.load");
        expect(style.getOwnSourceCache('mapbox') instanceof SourceCache).toBeTruthy();
    });

    test('creates layers', async () => {
        const style = new Style(new StubMap());

        style.loadJSON({
            "version": 8,
            "sources": {
                "foo": {
                    "type": "vector",
                    "tiles": []
                }
            },
            "layers": [{
                "id": "fill",
                "source": "foo",
                "source-layer": "source-layer",
                "type": "fill"
            }]
        });

        await waitFor(style, "style.load");
        expect(style.getLayer('fill') instanceof StyleLayer).toBeTruthy();
    });

    test('transforms sprite json and image URLs before request', async () => {
        networkWorker.use(
            http.get('http://example.com/sprites/bright-v8.png', async () => {
                return new HttpResponse(await getPNGResponse());
            }),
            http.get('http://example.com/sprites/bright-v8.json', () => {
                return HttpResponse.json({});
            })
        );

        const map = new StubMap();
        const transformSpy = vi.spyOn(map._requestManager, 'transformRequest');
        const style = new Style(map);

        style.loadJSON(extend(createStyleJSON(), {
            "sprite": "http://example.com/sprites/bright-v8"
        }));

        await waitFor(style, 'style.load');

        expect(transformSpy).toHaveBeenCalledTimes(2);
        expect(transformSpy.mock.calls[0][0]).toEqual('http://example.com/sprites/bright-v8.json');
        expect(transformSpy.mock.calls[0][1]).toEqual('SpriteJSON');
        expect(transformSpy.mock.calls[1][0]).toEqual('http://example.com/sprites/bright-v8.png');
        expect(transformSpy.mock.calls[1][1]).toEqual('SpriteImage');

        await waitFor(style, "data");
    });

    test('emits an error on non-existant vector source layer', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {
                '-source-id-': {type: "vector", tiles: []}
            },
            layers: []
        }));

        await waitFor(style, "style.load");
        style.removeSource('-source-id-');

        const source = createSource();
        source['vector_layers'] = [{id: 'green'}];
        style.addSource('-source-id-', source);
        style.addLayer({
            'id': '-layer-id-',
            'type': 'circle',
            'source': '-source-id-',
            'source-layer': '-source-layer-'
        });
        style.update({});
        const event = await waitFor(style, "error");
        const err = event.error;
        expect(err).toBeTruthy();
        expect(err.toString().indexOf('-source-layer-') !== -1).toBeTruthy();
        expect(err.toString().indexOf('-source-id-') !== -1).toBeTruthy();
        expect(err.toString().indexOf('-layer-id-') !== -1).toBeTruthy();
    });

    test('sets up layer event forwarding', async () => {
        const style = new Style(new StubMap());

        await new Promise(resolve => {
            style.loadJSON(createStyleJSON({
                layers: [{
                    id: 'background',
                    type: 'background'
                }]
            }));

            style.on('error', (e) => {
                expect(e.layer).toStrictEqual({id: 'background'});
                expect(e.mapbox).toBeTruthy();
                resolve();
            });

            style.on('style.load', () => {
                style._layers.background.fire(new Event('error', {mapbox: true}));
            });

        });
    });
});

describe('Style#_remove', () => {
    test('clears tiles', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        await waitFor(style, "style.load");
        const sourceCache = style.getOwnSourceCache('source-id');
        vi.spyOn(sourceCache, 'clearTiles');
        style._remove();
        expect(sourceCache.clearTiles).toHaveBeenCalledTimes(1);
    });

    test('deregisters plugin listener', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        vi.spyOn(style.dispatcher, 'broadcast');

        await waitFor(style, "style.load");
        style._remove();

        rtlTextPluginEvented.fire(new Event('pluginStateChange'));
        expect(style.dispatcher.broadcast).not.toHaveBeenCalledWith('syncRTLPluginState');
    });
});

test('Style#update', () => {
    const style = new Style(new StubMap());
    style.loadJSON({
        'version': 8,
        'sources': {
            'source': {
                'type': 'vector',
                'tiles': []
            }
        },
        'layers': [{
            'id': 'second',
            'source': 'source',
            'source-layer': 'source-layer',
            'type': 'fill'
        }]
    });

    style.on('error', (error) => { expect(error).toBeFalsy(); });

    style.on('style.load', () => {
        style.addLayer({id: 'first', source: 'source', type: 'fill', 'source-layer': 'source-layer'}, 'second');
        style.addLayer({id: 'third', source: 'source', type: 'fill', 'source-layer': 'source-layer'});
        style.removeLayer('second');

        style.dispatcher.broadcast = function(key, value) {
            expect(key).toEqual('updateLayers');
            expect(value.layers.map((layer) => { return layer.id; })).toEqual(['first', 'third']);
            expect(value.removedIds).toEqual(['second']);
        };

        style.update({});
    });
});

describe('Style#setState', () => {
    test('throw before loaded', () => {
        const style = new Style(new StubMap());
        expect(() => style.setState(createStyleJSON())).toThrowError(/load/i);
    });

    test('do nothing if there are no changes', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        [
            'addLayer',
            'removeLayer',
            'setPaintProperty',
            'setLayoutProperty',
            'setFilter',
            'addSource',
            'removeSource',
            'setGeoJSONSourceData',
            'setLayerZoomRange',
            'setFlatLight'
        ].forEach((method) => vi.spyOn(style, method).mockImplementation(() => expect.unreachable(`${method} called`)));
        await waitFor(style, "style.load");
        const didChange = style.setState(createStyleJSON());
        expect(didChange).toBeFalsy();
    });

    test('Issue #3893: compare new source options against originally provided options rather than normalized properties', async () => {
        networkWorker.use(
            http.get('/tilejson.json', () => {
                return HttpResponse.json({
                    tiles: ['http://tiles.server']
                });
            })
        );

        const initial = createStyleJSON();
        initial.sources.mySource = {
            type: 'raster',
            url: '/tilejson.json'
        };
        const style = new Style(new StubMap());
        style.loadJSON(initial);

        await waitFor(style, "style.load");

        vi.spyOn(style, 'removeSource').mockImplementation(() => expect.unreachable('removeSource called'));
        vi.spyOn(style, 'addSource').mockImplementation(() => expect.unreachable('addSource called'));
        style.setState(initial);

        await waitFor(style, 'data');
    });

    test('return true if there is a change', async () => {
        const initialState = createStyleJSON();
        const nextState = createStyleJSON({
            sources: {
                foo: {
                    type: 'geojson',
                    data: {type: 'FeatureCollection', features: []}
                }
            }
        });

        const style = new Style(new StubMap());
        style.loadJSON(initialState);
        await waitFor(style, "style.load");
        const didChange = style.setState(nextState);
        expect(didChange).toBeTruthy();
        expect(style.stylesheet).toStrictEqual(nextState);
    });

    test('sets GeoJSON source data if different', async () => {
        const initialState = createStyleJSON({
            "sources": {"source-id": createGeoJSONSource()}
        });

        const geoJSONSourceData = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [125.6, 10.1]
                    }
                }
            ]
        };

        const nextState = createStyleJSON({
            "sources": {
                "source-id": {
                    "type": "geojson",
                    "data": geoJSONSourceData
                }
            }
        });

        const style = new Style(new StubMap());
        style.loadJSON(initialState);

        await waitFor(style, "style.load");
        const geoJSONSource = style.getSource('source-id');
        vi.spyOn(style, 'setGeoJSONSourceData');
        vi.spyOn(geoJSONSource, 'setData');
        const didChange = style.setState(nextState);

        expect(style.setGeoJSONSourceData).toHaveBeenCalledWith('source-id', geoJSONSourceData);
        expect(geoJSONSource.setData).toHaveBeenCalledWith(geoJSONSourceData);
        expect(didChange).toBeTruthy();
        expect(style.stylesheet).toStrictEqual(nextState);
    });
});

describe('Style#addSource', () => {
    test('throw before loaded', () => {
        const style = new Style(new StubMap());
        expect(() => style.addSource('source-id', createSource())).toThrowError(/load/i);
    });

    test('throw if missing source type', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        const source = createSource();
        delete source.type;

        await waitFor(style, "style.load");
        expect(() => style.addSource('source-id', source)).toThrowError(/type/i);
    });

    test('fires "data" event', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();

        await waitFor(style, "style.load");
        await new Promise(resolve => {
            style.once('data', resolve);
            style.addSource('source-id', source);
            style.update({});
        });
    });

    test('throws on duplicates', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        await waitFor(style, "style.load");
        style.addSource('source-id', source);
        expect(() => {
            style.addSource('source-id', source);
        }).toThrowError(/There is already a source with ID \"source-id\"./);
    });

    test('emits on invalid source', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        await new Promise(resolve => {
            style.on('style.load', () => {
                style.on('error', () => {
                    expect(style.getOwnSourceCache('source-id')).toBeFalsy();
                    resolve();
                });
                style.addSource('source-id', {
                    type: 'vector',
                    minzoom: '1', // Shouldn't be a string
                    maxzoom: 10,
                    attribution: 'Mapbox',
                    tiles: ['http://example.com/{z}/{x}/{y}.png']
                });
            });
        });
    });

    test('sets up source event forwarding', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));
        const source = createSource();

        await waitFor(style, "style.load");

        style.addSource('source-id', source); // fires data twice
        style.getSource('source-id').fire(new Event('error'));
        style.getSource('source-id').fire(new Event('data'));

        const e = await waitFor(style, "data");
        if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
            expect(true).toBeTruthy();
        } else if (e.sourceDataType === 'content' && e.dataType === 'source') {
            expect(true).toBeTruthy();
        } else {
            expect(true).toBeTruthy();
        }

    });
});

describe('Style#removeSource', () => {
    test('throw before loaded', () => {
        const style = new Style(new StubMap());
        expect(() => style.removeSource('source-id')).toThrowError(/load/i);
    });

    test('fires "data" event', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        await new Promise(resolve => {
            style.once('data', resolve);
            style.on('style.load', () => {
                style.addSource('source-id', source);
                style.removeSource('source-id');
                style.update({});
            });
        });
    });

    test('clears tiles', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        await waitFor(style, "style.load");
        const sourceCache = style.getOwnSourceCache('source-id');
        vi.spyOn(sourceCache, 'clearTiles');
        style.removeSource('source-id');
        expect(sourceCache.clearTiles).toHaveBeenCalledTimes(1);
    });

    test('throws on non-existence', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        await waitFor(style, "style.load");
        expect(() => {
            style.removeSource('source-id');
        }).toThrowError(/There is no source with this ID/);
    });

    async function createStyle() {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            'sources': {
                'mapbox-source': createGeoJSONSource()
            },
            'layers': [{
                'id': 'mapbox-layer',
                'type': 'circle',
                'source': 'mapbox-source',
                'source-layer': 'whatever'
            }]
        }));
        await waitFor(style, 'style.load');
        style.update({zoom: 1, fadeDuration: 0});
        return style;
    }

    test('throws if source is in use', async () => {
        const style = await createStyle();
        await new Promise(resolve => {
            style.on('error', (event) => {
                expect(event.error.message.includes('"mapbox-source"')).toBeTruthy();
                expect(event.error.message.includes('"mapbox-layer"')).toBeTruthy();
                resolve();
            });
            style.removeSource('mapbox-source');
        });
    });

    test('does not throw if source is not in use', async () => {
        const style = await createStyle();
        style.removeLayer('mapbox-layer');
        style.removeSource('mapbox-source');
        style.once("error", () => {
            expect.unreachable();
        });
    });

    test('tears down source event forwarding', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        let source = createSource();

        style.on('style.load', () => {
            style.addSource('source-id', source);
            source = style.getSource('source-id');

            style.removeSource('source-id');

            // Suppress error reporting
            source.on('error', () => {});

            style.on('data', () => { expect.unreachable(); });
            style.on('error', () => { expect.unreachable(); });
            source.fire(new Event('data'));
            source.fire(new Event('error'));
        });
    });
});

describe('Style#setGeoJSONSourceData', () => {
    const geoJSON = {type: "FeatureCollection", features: []};

    test('throws before loaded', () => {
        const style = new Style(new StubMap());
        expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrowError(/load/i);
    });

    test('throws on non-existence', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        await waitFor(style, "style.load");
        expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrowError(/There is no source with this ID/);
    });
});

describe('Style#addLayer', () => {
    test('throw before loaded', () => {
        const style = new Style(new StubMap());
        expect(() => style.addLayer({id: 'background', type: 'background'})).toThrowError(/load/i);
    });

    test('sets up layer event forwarding', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        await new Promise(resolve => {
            style.on('error', (e) => {
                expect(e.layer).toStrictEqual({id: 'background'});
                expect(e.mapbox).toBeTruthy();
                resolve();
            });

            style.on('style.load', () => {
                style.addLayer({
                    id: 'background',
                    type: 'background'
                });
                style._layers.background.fire(new Event('error', {mapbox: true}));
            });
        });
    });

    test('throws on non-existant vector source layer', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {
                // At least one source must be added to trigger the load event
                dummy: {type: "vector", tiles: []}
            }
        }));

        await waitFor(style, "style.load");
        const source = createSource();
        source['vector_layers'] = [{id: 'green'}];
        style.addSource('-source-id-', source);
        style.addLayer({
            'id': '-layer-id-',
            'type': 'circle',
            'source': '-source-id-',
            'source-layer': '-source-layer-'
        });
        const event = await waitFor(style, "error");
        const err = event.error;

        expect(err).toBeTruthy();
        expect(err.toString().indexOf('-source-layer-') !== -1).toBeTruthy();
        expect(err.toString().indexOf('-source-id-') !== -1).toBeTruthy();
        expect(err.toString().indexOf('-layer-id-') !== -1).toBeTruthy();
    });

    test('emits error on invalid layer', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        await new Promise(resolve => {
            style.on('style.load', () => {
                style.on('error', () => {
                    expect(style.getLayer('background')).toBeFalsy();
                    resolve();
                });
                style.addLayer({
                    id: 'background',
                    type: 'background',
                    paint: {
                        'background-opacity': 5
                    }
                });
            });
        });
    });

    test('#4040 does not mutate source property when provided inline', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        await waitFor(style, "style.load");
        const source = {
            "type": "geojson",
            "data": {
                "type": "Point",
                "coordinates": [ 0, 0]
            }
        };
        const layer = {id: 'inline-source-layer', type: 'circle', source};
        style.addLayer(layer);
        expect(layer.source).toEqual(source);
    });

    test('reloads source', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
        const layer = {
            "id": "symbol",
            "type": "symbol",
            "source": "mapbox",
            "source-layer": "boxmap",
            "filter": ["==", "id", 0]
        };

        await new Promise(resolve => {
            style.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'content') {
                    style.getOwnSourceCache('mapbox').reload = resolve;
                    style.addLayer(layer);
                    style.update({});
                }
            });
        });

    });

    test(
        '#3895 reloads source (instead of clearing) if adding this layer with the same type, immediately after removing it',
        async () => {
            const style = new Style(new StubMap());
            style.loadJSON(extend(createStyleJSON(), {
                "sources": {
                    "mapbox": {
                        "type": "vector",
                        "tiles": []
                    }
                },
                layers: [{
                    "id": "my-layer",
                    "type": "symbol",
                    "source": "mapbox",
                    "source-layer": "boxmap",
                    "filter": ["==", "id", 0]
                }]
            }));

            const layer = {
                "id": "my-layer",
                "type": "symbol",
                "source": "mapbox",
                "source-layer": "boxmap"
            };

            await new Promise(resolve => {
                style.on('data', (e) => {
                    if (e.dataType === 'source' && e.sourceDataType === 'content') {
                        style.getOwnSourceCache('mapbox').reload = resolve;
                        style.getOwnSourceCache('mapbox').clearTiles = expect.unreachable;
                        style.removeLayer('my-layer');
                        style.addLayer(layer);
                        style.update({});
                    }
                });
            });
        });

    test(
        'clears source (instead of reloading) if adding this layer with a different type, immediately after removing it',
        async () => {
            const style = new Style(new StubMap());
            style.loadJSON(extend(createStyleJSON(), {
                "sources": {
                    "mapbox": {
                        "type": "vector",
                        "tiles": []
                    }
                },
                layers: [{
                    "id": "my-layer",
                    "type": "symbol",
                    "source": "mapbox",
                    "source-layer": "boxmap",
                    "filter": ["==", "id", 0]
                }]
            }));

            const layer = {
                "id": "my-layer",
                "type": "circle",
                "source": "mapbox",
                "source-layer": "boxmap"
            };
            await new Promise(resolve => {
                style.on('data', (e) => {
                    if (e.dataType === 'source' && e.sourceDataType === 'content') {
                        style.getOwnSourceCache('mapbox').reload = expect.unreachable;
                        style.getOwnSourceCache('mapbox').clearTiles = resolve;
                        style.removeLayer('my-layer');
                        style.addLayer(layer);
                        style.update({});
                    }
                });
            });
        });

    test('fires "data" event', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        await new Promise(resolve => {
            style.once('data', resolve);

            style.on('style.load', () => {
                style.addLayer(layer);
                style.update({});
            });
        });
    });

    test('emits error on duplicates', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        await waitFor(style, "style.load");

        await new Promise(resolve => {
            style.once("error", e => {
                expect(e.error.message).toMatch(/already exists/);
                resolve();
            });
            style.addLayer(layer);
            style.addLayer(layer);
        });
    });

    test('adds to the end by default', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));
        const layer = {id: 'c', type: 'background'};

        await waitFor(style, "style.load");
        style.addLayer(layer);
        expect(style._order).toEqual(['a', 'b', 'c']);
    });

    test('adds before the given layer', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));
        const layer = {id: 'c', type: 'background'};

        await waitFor(style, "style.load");
        style.addLayer(layer, 'a');
        expect(style._order).toEqual(['c', 'a', 'b']);
    });

    test('fire error if before layer does not exist', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));
        const layer = {id: 'c', type: 'background'};

        await waitFor(style, "style.load");

        await new Promise(resolve => {
            style.once("error", ({error}) => {
                expect(error.message).toMatch(/does not exist on this map/);
                resolve();
            });
            style.addLayer(layer, 'z');
        });
    });

    test('fires an error on non-existant source layer', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            sources: {
                dummy: {
                    type: 'geojson',
                    data: {type: 'FeatureCollection', features: []}
                }
            }
        }));

        const layer = {
            id: 'dummy',
            type: 'fill',
            source: 'dummy',
            'source-layer': 'dummy'
        };

        await waitFor(style, "style.load");
        await new Promise(resolve => {
            style.once("error", ({error}) => {
                expect(error.message).toMatch(/does not exist on source/);
                resolve();
            });
            style.addLayer(layer);
        });
    });
});

describe('Style#removeLayer', () => {
    test('throw before loaded', () => {
        const style = new Style(new StubMap());
        expect(() => style.removeLayer('background')).toThrowError(/load/i);
    });

    test('fires "data" event', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        await waitFor(style, "style.load");

        await new Promise(resolve => {
            style.once('data', resolve);
            style.addLayer(layer);
            style.removeLayer('background');
            style.update({});
        });

    });

    test('tears down layer event forwarding', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', () => {
            expect.unreachable();
        });

        await new Promise(resolve => {
            style.on('style.load', () => {
                const layer = style._layers.background;
                style.removeLayer('background');

                // Bind a listener to prevent fallback Evented error reporting.
                layer.on('error', () => {});

                layer.fire(new Event('error', {mapbox: true}));
                resolve();
            });

        });
    });

    test('fires an error on non-existence', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        await waitFor(style, "style.load");

        await new Promise(resolve => {
            style.on("error", ({error}) => {
                expect(error.message).toMatch(/does not exist in the map\'s style/);
                resolve();
            });
            style.removeLayer('background');
        });
    });

    test('removes from the order', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));

        await waitFor(style, "style.load");
        style.removeLayer('a');
        expect(style._order).toEqual(['b']);
    });

    test('does not remove dereffed layers', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                ref: 'a'
            }]
        }));

        await waitFor(style, "style.load");
        style.removeLayer('a');
        expect(style.getLayer('a')).toEqual(undefined);
        expect(style.getLayer('b')).not.toEqual(undefined);
    });
});

describe('Style#moveLayer', () => {
    test('throw before loaded', () => {
        const style = new Style(new StubMap());
        expect(() => style.moveLayer('background')).toThrowError(/load/i);
    });

    test('fires "data" event', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        await new Promise(resolve => {
            style.once('data', resolve);

            style.on('style.load', () => {
                style.addLayer(layer);
                style.moveLayer('background');
                style.update({});
            });
        });
    });

    test('fires an error on non-existence', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        await new Promise(resolve => {
            style.on('style.load', () => {
                style.on('error', ({error}) => {
                    expect(error.message).toMatch(/does not exist in the map\'s style/);
                    resolve();
                });
                style.moveLayer('background');
            });
        });
    });

    test('changes the order', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
                {id: 'c', type: 'background'}
            ]
        }));

        await waitFor(style, "style.load");
        style.moveLayer('a', 'c');
        expect(style._order).toEqual(['b', 'a', 'c']);
    });

    test('moves to existing location', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
                {id: 'c', type: 'background'}
            ]
        }));

        await waitFor(style, "style.load");
        style.moveLayer('b', 'b');
        expect(style._order).toEqual(['a', 'b', 'c']);
    });
});

describe('Style#setPaintProperty', () => {
    test(
        '#4738 postpones source reload until layers have been broadcast to workers',
        async () => {
            const style = new Style(new StubMap());
            style.loadJSON(extend(createStyleJSON(), {
                "sources": {
                    "geojson": {
                        "type": "geojson",
                        "data": {"type": "FeatureCollection", "features": []}
                    }
                },
                "layers": [
                    {
                        "id": "circle",
                        "type": "circle",
                        "source": "geojson"
                    }
                ]
            }));

            const tr = new Transform();
            tr.resize(512, 512);

            await waitFor(style, "style.load");
            style.update({zoom: tr.zoom, fadeDuration: 0});
            const sourceCache = style.getOwnSourceCache('geojson');
            const source = style.getSource('geojson');

            let begun = false;
            let styleUpdateCalled = false;

            await new Promise(resolve => {
                source.on('data', (e) => setTimeout(() => {
                    if (!begun && sourceCache.loaded()) {
                        begun = true;
                        vi.spyOn(sourceCache, 'reload').mockImplementation(() => {
                            expect(styleUpdateCalled).toBeTruthy(); // loadTile called before layer data broadcast
                            resolve();
                        });

                        source.setData({"type": "FeatureCollection", "features": []});
                        style.setPaintProperty('circle', 'circle-color', {type: 'identity', property: 'foo'});
                    }

                    if (begun && e.sourceDataType === 'content') {
                        // setData() worker-side work is complete; simulate an
                        // animation frame a few ms later, so that this test can
                        // confirm that SourceCache#reload() isn't called until
                        // after the next Style#update()
                        setTimeout(() => {
                            styleUpdateCalled = true;
                            style.update({});
                        }, 50);
                    }
                }), 0);
            });
        });

    test('#5802 clones the input', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [
                {
                    "id": "background",
                    "type": "background"
                }
            ]
        });

        await waitFor(style, 'style.load');
        const value = {stops: [[0, 'red'], [10, 'blue']]};
        style.setPaintProperty('background', 'background-color', value);
        expect(style.getPaintProperty('background', 'background-color')).not.toBe(value);
        expect(style._changes.isDirty()).toBeTruthy();

        style.update({});
        expect(style._changes.isDirty()).toBeFalsy();

        value.stops[0][0] = 1;
        style.setPaintProperty('background', 'background-color', value);
        expect(style._changes.isDirty()).toBeTruthy();
    });
});

test('respects validate option', async () => {
    const style = new Style(new StubMap());
    style.loadJSON({
        "version": 8,
        "sources": {},
        "layers": [
            {
                "id": "background",
                "type": "background"
            }
        ]
    });

    await waitFor(style, "style.load");
    vi.spyOn(console, 'error').mockImplementation(() => {});

    style.setPaintProperty('background', 'background-color', 'notacolor', {validate: false});
    expect(console.error).not.toHaveBeenCalled();

    expect(style._changes.isDirty()).toBeTruthy();
    style.update({});

    style.setPaintProperty('background', 'background-color', 'alsonotacolor');
    expect(console.error).toHaveBeenCalledTimes(1);
});

describe('Style#getPaintProperty', () => {
    test('#5802 clones the output', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [
                {
                    "id": "background",
                    "type": "background"
                }
            ]
        });

        await waitFor(style, "style.load");
        style.setPaintProperty('background', 'background-color', {stops: [[0, 'red'], [10, 'blue']]});
        style.update({});
        expect(style._changes.isDirty()).toBeFalsy();

        const value = style.getPaintProperty('background', 'background-color');
        value.stops[0][0] = 1;
        style.setPaintProperty('background', 'background-color', value);
        expect(style._changes.isDirty()).toBeTruthy();
    });
});

describe('Style#setLayoutProperty', () => {
    test('#5802 clones the input', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": {
                    "type": "geojson",
                    "data": {
                        "type": "FeatureCollection",
                        "features": []
                    }
                }
            },
            "layers": [
                {
                    "id": "line",
                    "type": "line",
                    "source": "geojson"
                }
            ]
        });

        await waitFor(style, 'style.load');
        const value = {stops: [[0, 'butt'], [10, 'round']]};
        style.setLayoutProperty('line', 'line-cap', value);
        expect(style.getLayoutProperty('line', 'line-cap')).not.toBe(value);
        expect(style._changes.isDirty()).toBeTruthy();

        style.update({});
        expect(style._changes.isDirty()).toBeFalsy();

        value.stops[0][0] = 1;
        style.setLayoutProperty('line', 'line-cap', value);
        expect(style._changes.isDirty()).toBeTruthy();
    });

    test('respects validate option', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": {
                    "type": "geojson",
                    "data": {
                        "type": "FeatureCollection",
                        "features": []
                    }
                }
            },
            "layers": [
                {
                    "id": "line",
                    "type": "line",
                    "source": "geojson"
                }
            ]
        });

        await waitFor(style, "style.load");
        vi.spyOn(console, 'error').mockImplementation(() => {});

        style.setLayoutProperty('line', 'line-cap', 'invalidcap', {validate: false});
        expect(console.error).not.toHaveBeenCalled();
        expect(style._changes.isDirty()).toBeTruthy();
        style.update({});

        style.setLayoutProperty('line', 'line-cap', 'differentinvalidcap');
        expect(console.error).toHaveBeenCalledTimes(1);
    });
});

describe('Style#getLayoutProperty', () => {
    test('#5802 clones the output', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": {
                    "type": "geojson",
                    "data": {
                        "type": "FeatureCollection",
                        "features": []
                    }
                }
            },
            "layers": [
                {
                    "id": "line",
                    "type": "line",
                    "source": "geojson"
                }
            ]
        });

        await waitFor(style, "style.load");
        style.setLayoutProperty('line', 'line-cap', {stops: [[0, 'butt'], [10, 'round']]});
        style.update({});
        expect(style._changes.isDirty()).toBeFalsy();

        const value = style.getLayoutProperty('line', 'line-cap');
        value.stops[0][0] = 1;
        style.setLayoutProperty('line', 'line-cap', value);
        expect(style._changes.isDirty()).toBeTruthy();
    });
});

describe('Style#setFilter', () => {
    test('throws if style is not loaded', () => {
        const style = new Style(new StubMap());
        expect(() => style.setFilter('symbol', ['==', 'id', 1])).toThrowError(/load/i);
    });

    function createStyle() {
        const style = new Style(new StubMap());
        style.loadJSON({
            version: 8,
            sources: {
                geojson: createGeoJSONSource()
            },
            layers: [
                {id: 'symbol', type: 'symbol', source: 'geojson', filter: ['==', 'id', 0]}
            ]
        });
        return style;
    }

    test('sets filter', async () => {
        const style = createStyle();

        await waitFor(style, "style.load");
        style.dispatcher.broadcast = function(key, value) {
            expect(key).toEqual('updateLayers');
            expect(value.layers[0].id).toEqual('symbol');
            expect(value.layers[0].filter).toEqual(['==', 'id', 1]);
        };

        style.setFilter('symbol', ['==', 'id', 1]);
        expect(style.getFilter('symbol')).toEqual(['==', 'id', 1]);
        style.update({}); // trigger dispatcher broadcast
    });

    test('gets a clone of the filter', async () => {
        const style = createStyle();

        await waitFor(style, "style.load");
        const filter1 = ['==', 'id', 1];
        style.setFilter('symbol', filter1);
        const filter2 = style.getFilter('symbol');
        const filter3 = style.getLayer('symbol').filter;

        expect(filter1).not.toBe(filter2);
        expect(filter1).not.toBe(filter3);
        expect(filter2).not.toBe(filter3);
    });

    test('sets again mutated filter', async () => {
        const style = createStyle();

        await waitFor(style, "style.load");
        const filter = ['==', 'id', 1];
        style.setFilter('symbol', filter);
        style.update({}); // flush pending operations

        style.dispatcher.broadcast = function(key, value) {
            expect(key).toEqual('updateLayers');
            expect(value.layers[0].id).toEqual('symbol');
            expect(value.layers[0].filter).toEqual(['==', 'id', 2]);
        };
        filter[2] = 2;
        style.setFilter('symbol', filter);
        style.update({}); // trigger dispatcher broadcast
    });

    test('unsets filter', async () => {
        const style = createStyle();
        await waitFor(style, "style.load");
        style.setFilter('symbol', null);
        expect(style.getLayer('symbol').serialize().filter).toEqual(undefined);
    });

    test('emits if invalid', async () => {
        const style = createStyle();
        await waitFor(style, "style.load");
        await new Promise(resolve => {
            style.on('error', () => {
                expect(style.getLayer('symbol').serialize().filter).toStrictEqual(['==', 'id', 0]);
                resolve();
            });
            style.setFilter('symbol', ['==', '$type', 1]);
        });
    });

    test('fires an error if layer not found', async () => {
        const style = createStyle();

        await waitFor(style, "style.load");
        await new Promise((resolve) => {
            style.on('error', ({error}) => {
                expect(error.message).toMatch(/does not exist in the map\'s style/);
                resolve();
            });
            style.setFilter('non-existant', ['==', 'id', 1]);
        });
    });

    test('validates filter by default', async () => {
        const style = createStyle();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await waitFor(style, "style.load");
        style.setFilter('symbol', 'notafilter');
        expect(style.getFilter('symbol')).toEqual(['==', 'id', 0]);
        expect(console.error).toHaveBeenCalledTimes(1);
        style.update({}); // trigger dispatcher broadcast
    });

    test('respects validate option', async () => {
        const style = createStyle();

        await waitFor(style, "style.load");
        style.dispatcher.broadcast = function(key, value) {
            expect(key).toEqual('updateLayers');
            expect(value.layers[0].id).toEqual('symbol');
            expect(value.layers[0].filter).toEqual('notafilter');
        };

        style.setFilter('symbol', 'notafilter', {validate: false});
        expect(style.getFilter('symbol')).toEqual('notafilter');
        style.update({}); // trigger dispatcher broadcast
    });
});

describe('Style#setLayerZoomRange', () => {
    test('throw before loaded', () => {
        const style = new Style(new StubMap());
        expect(() => style.setLayerZoomRange('symbol', 5, 12)).toThrowError(/load/i);
    });

    function createStyle() {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": createGeoJSONSource()
            },
            "layers": [{
                "id": "symbol",
                "type": "symbol",
                "source": "geojson"
            }]
        });
        return style;
    }

    test('sets zoom range', async () => {
        const style = createStyle();

        await waitFor(style, "style.load");
        style.dispatcher.broadcast = function(key, value) {
            expect(key).toEqual('updateLayers');
            expect(value.map((layer) => { return layer.id; })).toEqual(['symbol']);
        };

        style.setLayerZoomRange('symbol', 5, 12);
        expect(style.getLayer('symbol').minzoom).toEqual(5);
        expect(style.getLayer('symbol').maxzoom).toEqual(12);
    });

    test('fires an error if layer not found', async () => {
        const style = createStyle();
        await waitFor(style, "style.load");
        await new Promise(resolve => {
            style.on('error', ({error}) => {
                expect(error.message).toMatch(/does not exist in the map\'s style/);
                resolve();
            });
            style.setLayerZoomRange('non-existant', 5, 12);
        });
    });

    test('does not reload raster source', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "raster": {
                    type: "raster",
                    tiles: ['http://tiles.server']
                }
            },
            "layers": [{
                "id": "raster",
                "type": "raster",
                "source": "raster"
            }]
        });

        await waitFor(style, "style.load");
        vi.spyOn(style, 'reloadSource');

        style.setLayerZoomRange('raster', 5, 12);
        style.update({zoom: 0});
        expect(style.reloadSource.called).toBeFalsy();
    });
});

test('Style#hasLayer, Style#has*Layers()', () => {
    function createStyle() {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": createGeoJSONSource()
            },
            "layers": [{
                "id": "symbol_id",
                "type": "symbol",
                "source": "geojson"
            },
            {
                "id": "background_id",
                "type": "background"
            },
            {
                "id": "fill_id",
                "type": "fill",
                "source": "geojson"
            },
            {
                "id": "line_id",
                "type": "line",
                "source": "geojson"
            }]
        });
        return style;
    }

    const style = createStyle();

    style.on('style.load', () => {
        expect(style.hasLayer('symbol_id')).toBeTruthy();
        expect(style.hasLayer('background_id')).toBeTruthy();
        expect(style.hasLayer('fill_id')).toBeTruthy();
        expect(style.hasLayer('line_id')).toBeTruthy();
        expect(style.hasLayer('non_existing_symbol_id')).toBeFalsy();
        expect(style.hasLayer('non_existing_background_id')).toBeFalsy();
        expect(style.hasLayer('non_existing_fill_id')).toBeFalsy();
        expect(style.hasLayer('non_existing_line_id')).toBeFalsy();

        expect(style.hasSymbolLayers()).toBeTruthy();
        expect(style.has3DLayers()).toBeFalsy();
        expect(style.hasCircleLayers()).toBeFalsy();

        style.addLayer({id: 'first', source: 'geojson', type: 'fill-extrusion'});
        style.removeLayer('symbol_id');

        expect(style.hasSymbolLayers()).toBeFalsy();
        expect(style.has3DLayers()).toBeTruthy();
        expect(style.hasCircleLayers()).toBeFalsy();
    });
});

describe('Style#queryRenderedFeatures', () => {
    let style, transform;

    beforeEach(async () => {
        style = new Style(new StubMap());
        transform = new Transform();
        transform.resize(512, 512);

        function queryMapboxFeatures(layers, serializedLayers, getFeatureState, queryGeom, params) {
            const features = {
                'land': [{
                    type: 'Feature',
                    layer: style._layers.land.serialize(),
                    geometry: {
                        type: 'Polygon'
                    }
                }, {
                    type: 'Feature',
                    layer: style._layers.land.serialize(),
                    geometry: {
                        type: 'Point'
                    }
                }],
                'landref': [{
                    type: 'Feature',
                    layer: style._layers.landref.serialize(),
                    geometry: {
                        type: 'Line'
                    }
                }]
            };

            // format result to shape of tile.queryRenderedFeatures result
            for (const layer in features) {
                features[layer] = features[layer].map((feature, featureIndex) =>
                    ({feature, featureIndex}));
            }

            if (params.layers) {
                for (const l in features) {
                    if (params.layers.indexOf(l) < 0) {
                        delete features[l];
                    }
                }
            }

            return features;
        }

        style.loadJSON({
            "version": 8,
            "sources": {
                "mapbox": {
                    "type": "geojson",
                    "data": {type: "FeatureCollection", features: []}
                },
                "other": {
                    "type": "geojson",
                    "data": {type: "FeatureCollection", features: []}
                }
            },
            "layers": [{
                "id": "land",
                "type": "line",
                "source": "mapbox",
                "source-layer": "water",
                "layout": {
                    'line-cap': 'round'
                },
                "paint": {
                    "line-color": "red"
                },
                "metadata": {
                    "something": "else"
                }
            }, {
                "id": "landref",
                "ref": "land",
                "paint": {
                    "line-color": "blue"
                }
            }, {
                "id": "land--other",
                "type": "line",
                "source": "other",
                "source-layer": "water",
                "layout": {
                    'line-cap': 'round'
                },
                "paint": {
                    "line-color": "red"
                },
                "metadata": {
                    "something": "else"
                }
            }]
        });

        await waitFor(style, 'style.load');
        style.getOwnSourceCache('mapbox').tilesIn = () => {
            return [{
                queryGeometry: {},
                tilespaceGeometry: {},
                bufferedTilespaceGeometry: {},
                bufferedTilespaceBounds: {},
                tile: {queryRenderedFeatures: queryMapboxFeatures, tileID: new OverscaledTileID(0, 0, 0, 0, 0)},
                tileID: new OverscaledTileID(0, 0, 0, 0, 0)
            }];
        };
        style.getOwnSourceCache('other').tilesIn = () => {
            return [];
        };

        style.getOwnSourceCache('mapbox').transform = transform;
        style.getOwnSourceCache('other').transform = transform;

        style.update({zoom: 0});
        style.updateSources(transform);
    });

    test('returns feature type', () => {
        const results = style.queryRenderedFeatures([0, 0], {}, transform);
        expect(results[0].geometry.type).toEqual('Line');
    });

    test('filters by `layers` option', () => {
        const results = style.queryRenderedFeatures([0, 0], {layers: ['land']}, transform);
        expect(results.length).toEqual(2);
    });

    test('checks type of `layers` option', () => {
        let errors = 0;
        vi.spyOn(style, 'fire').mockImplementation((event) => {
            if (event.error && event.error.message.includes('parameters.layers must be an Array.')) errors++;
        });
        style.queryRenderedFeatures([0, 0], {layers:'string'}, transform);
        expect(errors).toEqual(1);
    });

    test('includes layout properties', () => {
        const results = style.queryRenderedFeatures([0, 0], {}, transform);
        const layout = results[0].layer.layout;
        expect(layout['line-cap']).toEqual('round');
    });

    test('includes paint properties', () => {
        const results = style.queryRenderedFeatures([0, 0], {}, transform);
        expect(results[2].layer.paint['line-color']).toEqual('red');
    });

    test('includes metadata', () => {
        const results = style.queryRenderedFeatures([0, 0], {}, transform);

        const layer = results[1].layer;
        expect(layer.metadata.something).toEqual('else');
    });

    test('include multiple layers', () => {
        const results = style.queryRenderedFeatures([0, 0], {layers: ['land', 'landref']}, transform);
        expect(results.length).toEqual(3);
    });

    test('does not query sources not implicated by `layers` parameter', () => {
        style.getOwnSourceCache('mapbox').queryRenderedFeatures = function() { expect.unreachable(); };
        style.queryRenderedFeatures([0, 0], {layers: ['land--other']}, transform);
    });

    test('fires an error if layer included in params does not exist on the style', () => {
        let errors = 0;
        vi.spyOn(style, 'fire').mockImplementation((event) => {
            if (event.error && event.error.message.includes('does not exist in the map\'s style and cannot be queried for features.')) errors++;
        });
        const results = style.queryRenderedFeatures([0, 0], {layers:['merp']}, transform);
        expect(errors).toEqual(1);
        expect(results.length).toEqual(0);
    });
});

test('Style defers expensive methods', async () => {
    const style = new Style(new StubMap());
    style.loadJSON(createStyleJSON({
        "sources": {
            "streets": createGeoJSONSource(),
            "terrain": createGeoJSONSource()
        }
    }));

    await waitFor(style, 'style.load');
    style.update({});

    // spies to track defered methods
    vi.spyOn(style, 'fire');
    vi.spyOn(style, 'reloadSource');
    vi.spyOn(style, '_updateWorkerLayers');

    style.addLayer({id: 'first', type: 'symbol', source: 'streets'});
    style.addLayer({id: 'second', type: 'symbol', source: 'streets'});
    style.addLayer({id: 'third', type: 'symbol', source: 'terrain'});

    style.setPaintProperty('first', 'text-color', 'black');
    style.setPaintProperty('first', 'text-halo-color', 'white');

    expect(style.fire.called).toBeFalsy();
    expect(style.reloadSource.called).toBeFalsy();
    expect(style._updateWorkerLayers.called).toBeFalsy();

    style.update({});

    expect(style.fire.mock.calls[0][0].type).toEqual('data');

    // called per source
    expect(style.reloadSource).toHaveBeenCalledTimes(2);
    expect(style.reloadSource).toHaveBeenCalledWith('streets');
    expect(style.reloadSource).toHaveBeenCalledWith('terrain');

    // called once
    expect(style._updateWorkerLayers).toHaveBeenCalledTimes(1);
});

describe('Style#query*Features', () => {
    // These tests only cover filter validation. Most tests for these methods
    // live in the integration tests.

    let style;
    let onError;
    let transform;

    beforeEach(() => {
        transform = new Transform();
        transform.resize(100, 100);
        style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": createGeoJSONSource()
            },
            "layers": [{
                "id": "symbol",
                "type": "symbol",
                "source": "geojson"
            }]
        });

        onError = vi.fn();

        return new Promise((resolve) => {
            style.on('error', onError).on('style.load', () => resolve());
        });
    });

    test('querySourceFeatures emits an error on incorrect filter', () => {
        expect(style.querySourceFeatures([10, 100], {filter: 7}, transform)).toEqual([]);
        expect(onError.mock.calls[0][0].error.message).toMatch(/querySourceFeatures\.filter/);
    });

    test('queryRenderedFeatures emits an error on incorrect filter', () => {
        expect(style.queryRenderedFeatures([0, 0], {filter: 7}, transform)).toEqual([]);
        expect(onError.mock.calls[0][0].error.message).toMatch(/queryRenderedFeatures\.filter/);
    });

    test('querySourceFeatures not raise validation errors if validation was disabled', () => {
        let errors = 0;
        vi.spyOn(style, 'fire').mockImplementation((event) => {
            if (event.error) {
                console.log(event.error.message);
                errors++;
            }
        });
        style.queryRenderedFeatures([0, 0], {filter: "invalidFilter", validate: false}, transform);
        expect(errors).toEqual(0);
    });

    test('querySourceFeatures not raise validation errors if validation was disabled', () => {
        let errors = 0;
        vi.spyOn(style, 'fire').mockImplementation((event) => {
            if (event.error) errors++;
        });
        style.querySourceFeatures([{x: 0, y: 0}], {filter: "invalidFilter", validate: false}, transform);
        expect(errors).toEqual(0);
    });
});

describe('Style#addSourceType', () => {
    const _types = {'existing' () {}};

    beforeEach(() => {
        vi.spyOn(Style, 'getSourceType').mockImplementation(name => _types[name]);
        vi.spyOn(Style, 'setSourceType').mockImplementation((name, create) => {
            _types[name] = create;
        });
    });

    test('adds factory function', () => {
        const style = new Style(new StubMap());
        const SourceType = function () {};

        // expect no call to load worker source
        style.dispatcher.broadcast = function (type) {
            if (type === 'loadWorkerSource') {
                expect.unreachable();
            }
        };

        style.addSourceType('foo', SourceType, () => {
            expect(_types['foo']).toEqual(SourceType);
        });
    });

    test('triggers workers to load worker source code', () => {
        const style = new Style(new StubMap());
        const SourceType = function () {};
        SourceType.workerSourceURL = 'worker-source.js';

        style.dispatcher.broadcast = function (type, params) {
            if (type === 'loadWorkerSource') {
                expect(_types['bar']).toEqual(SourceType);
                expect(params.name).toEqual('bar');
                expect(params.url).toEqual('worker-source.js');
            }
        };

        style.addSourceType('bar', SourceType, (err) => { expect(err).toBeFalsy(); });
    });

    test('refuses to add new type over existing name', () => {
        const style = new Style(new StubMap());
        style.addSourceType('existing', () => {}, (err) => {
            expect(err).toBeTruthy();
        });
    });
});

describe('Style#hasTransitions', () => {
    test('returns false when the style is loading', () => {
        const style = new Style(new StubMap());
        expect(style.hasTransitions()).toEqual(false);
    });

    test('returns true when a property is transitioning', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [{
                "id": "background",
                "type": "background"
            }]
        });

        await waitFor(style, "style.load");
        style.setPaintProperty("background", "background-color", "blue");
        style.update({transition: {duration: 300, delay: 0}});
        expect(style.hasTransitions()).toEqual(true);
    });

    test('returns false when a property is not transitioning', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [{
                "id": "background",
                "type": "background"
            }]
        });

        await waitFor(style, "style.load");
        style.setPaintProperty("background", "background-color", "blue");
        style.update({transition: {duration: 0, delay: 0}});
        expect(style.hasTransitions()).toEqual(false);
    });
});

describe('Style#setTerrain', () => {
    test('rolls up inline source into style', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [{
                "id": "background",
                "type": "background"
            }]
        });

        await waitFor(style, "style.load");
        style.setTerrain({
            "source": {
                "type": "raster-dem",
                "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                "tileSize": 256,
                "maxzoom": 14
            }
        });
        expect(style.getSource('terrain-dem-src')).toBeTruthy();
        expect(style.getSource('terrain-dem-src').type).toEqual('raster-dem');
    });

    test('raises error during creation terrain without source', async () => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        await waitFor(style, "style.load");
        await new Promise(resolve => {

            style.on('error', ({error}) => {
                expect(error).toBeTruthy();
                expect(error.message).toMatch(`terrain: terrain is missing required property "source"`);
                resolve();
            });
            style.setTerrain({
                exaggeration: 2
            });
        });
    });

    test('updates terrain properties', async () => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON());
        await waitFor(style, "style.load");

        style.setTerrain({
            "source": {
                "type": "raster-dem",
                "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                "tileSize": 256,
                "maxzoom": 14
            },
            "exaggeration": 1
        });

        expect(style.getTerrain().exaggeration).toEqual(1);

        style.setTerrain({
            exaggeration: 2
        });

        expect(style.getTerrain().exaggeration).toEqual(2);
    });

    test('setTerrain(undefined) removes terrain', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "mapbox-dem": {
                    "type": "raster-dem",
                    "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                    "tileSize": 256,
                    "maxzoom": 14
                }
            },
            "terrain": {"source": "mapbox-dem"},
            "layers": [{
                "id": "background",
                "type": "background"
            }]
        });

        await waitFor(style, "style.load");
        style.setTerrain(undefined);
        expect(style.terrain == null).toBeTruthy();
        const serialized = style.serialize();
        expect(serialized.terrain == null).toBeTruthy();
    });
});

describe('Style#getTerrain', () => {
    test('rolls up inline source into style', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [{
                "id": "background",
                "type": "background"
            }]
        });

        await waitFor(style, "style.load");
        style.setTerrain({
            "source": {
                "type": "raster-dem",
                "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                "tileSize": 256,
                "maxzoom": 14
            }
        });
        expect(style.getTerrain()).toBeTruthy();
        expect(style.getTerrain()).toEqual({"source": "terrain-dem-src"});
    });
});

describe('Style#setFog', () => {
    test('setFog(undefined) removes fog', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "fog": {"range": [1, 2], "color": "white", "horizon-blend": 0.05},
            "sources": {},
            "layers": []
        });

        await waitFor(style, "style.load");
        style.setFog(undefined);
        expect(style.fog == null).toBeTruthy();
        const serialized = style.serialize();
        expect(serialized.fog == null).toBeTruthy();
    });
});

describe('Style#getFog', () => {
    const defaultHighColor = styleSpec.fog["high-color"].default;
    const defaultStarIntensity = styleSpec.fog["star-intensity"].default;
    const defaultSpaceColor = styleSpec.fog["space-color"].default;
    const defaultRange = styleSpec.fog["range"].default;
    const defaultColor = styleSpec.fog["color"].default;
    const defaultHorizonBlend = styleSpec.fog["horizon-blend"].default;
    const defaultVerticalRange = styleSpec.fog["vertical-range"].default;

    test('rolls up inline source into style', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "fog": {"range": [1, 2], "color": "white", "horizon-blend": 0, "vertical-range": [0, 0]},
            "sources": {},
            "layers": []
        });

        await waitFor(style, "style.load");
        style.setFog({"range": [0, 1], "color": "white", "horizon-blend": 0, "vertical-range": [0, 0]});
        expect(style.getFog()).toBeTruthy();
        expect(style.getFog()).toEqual({
            "range": [0, 1],
            "color": "white",
            "horizon-blend": 0,
            "high-color": defaultHighColor,
            "star-intensity": defaultStarIntensity,
            "space-color": defaultSpaceColor,
            "vertical-range": defaultVerticalRange
        });
    });

    test('default fog styling', async () => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "fog": {},
            "sources": {},
            "layers": []
        });

        await waitFor(style, "style.load");
        expect(style.getFog()).toBeTruthy();
        expect(style.getFog()).toEqual({
            "range": defaultRange,
            "color": defaultColor,
            "horizon-blend": defaultHorizonBlend,
            "high-color": defaultHighColor,
            "star-intensity": defaultStarIntensity,
            "space-color": defaultSpaceColor,
            "vertical-range": defaultVerticalRange
        });
    });
});

test('Style#castShadows check', async () => {
    function createStyle() {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "lights": [
                {
                    "type": "ambient",
                    "id": "environment",
                    "properties": {
                        "intensity": 0.2
                    }
                },
                {
                    "type": "directional",
                    "id": "sun_light",
                    "properties": {
                        "intensity": 0.8,
                        "cast-shadows": true,
                        "shadow-intensity": 1.0
                    }
                }
            ],
            "sources": {
                "geojson": createGeoJSONSource()
            },
            "layers": [{
                "id": "symbol_id",
                "type": "symbol",
                "source": "geojson"
            },
            {
                "id": "background_id",
                "type": "background"
            },
            {
                "id": "line_id",
                "type": "line",
                "source": "geojson"
            }]
        });
        return style;
    }

    const style = createStyle();

    await waitFor(style, 'style.load');
    const sourceCache = style.getOwnSourceCache('geojson');
    expect(sourceCache.castsShadows).toBeFalsy();
    style.addLayer({id: 'fillext', source: 'geojson', type: 'fill-extrusion'});
    expect(sourceCache.castsShadows).toBeTruthy();
    style.removeLayer('fillext');
    expect(sourceCache.castsShadows).toBeFalsy();
});

