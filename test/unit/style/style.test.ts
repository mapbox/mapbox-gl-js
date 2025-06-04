// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    describe,
    test,
    beforeEach,
    expect,
    waitFor,
    vi,
} from '../../util/vitest';
import {mockFetch} from '../../util/network';
import Style from '../../../src/style/style';
import SourceCache from '../../../src/source/source_cache';
import StyleLayer from '../../../src/style/style_layer';
import Transform from '../../../src/geo/transform';
import {extend} from '../../../src/util/util';
import {Event} from '../../../src/util/evented';
import styleSpec from '../../../src/style-spec/reference/latest';
import {
    setRTLTextPlugin,
    clearRTLTextPlugin,
    evented as rtlTextPluginEvented
} from '../../../src/source/rtl_text_plugin';
import Tile from '../../../src/source/tile';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {ImageId} from '../../../src/style-spec/expression/types/image_id';
import {StubMap} from './utils';

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

describe('Style', () => {
    test('registers plugin state change listener', () => {
        clearRTLTextPlugin();
        mockFetch({
            '.*': () => new Response(null)
        });
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
        mockFetch({
            '/plugin.js': () => new Response("doesn't matter")
        });
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
    test('fires "dataloading"', () => {
        const style = new Style(new StubMap());
        const spy = vi.fn();

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(createStyleJSON()))
        });

        style.on('dataloading', spy);
        style.loadURL('/style.json');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].target).toEqual(style);
        expect(spy.mock.calls[0][0].dataType).toEqual('style');
    });

    test('transforms style URL before request', async () => {
        const map = new StubMap();
        const spy = vi.spyOn(map._requestManager, 'transformRequest');

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(createStyleJSON()))
        });

        const style = new Style(map);
        style.loadURL('/style.json');

        await waitFor(style, 'style.load');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual('/style.json');
        expect(spy.mock.calls[0][1]).toEqual('Style');
    });

    test('validates the style', async () => {
        const style = new Style(new StubMap());

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(createStyleJSON({version: 'invalid'})))
        });

        style.loadURL('/style.json');

        const {error} = await waitFor(style, "error");
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/version/);

    });

    test('skips validation for mapbox:// styles', async () => {
        mockFetch({
            'https://api.mapbox.com/styles/v1/test/test': () => new Response(JSON.stringify(createStyleJSON({
                version: 'invalid'
            })))
        });

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
        mockFetch({
            '/style.json': () => new Response(JSON.stringify(createStyleJSON()))
        });
        const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
        const style = new Style(new StubMap());
        style.loadURL('/style.json');
        style._remove();
        expect(abortSpy).toHaveBeenCalledTimes(1);
    });
});

describe('Style#loadJSON', () => {
    test('fires "dataloading" (synchronously)', () => {
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

        style.dispatcher.broadcast = function (key, value) {
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
        mockFetch({
            '/tilejson.json': () => new Response(JSON.stringify({
                tiles: ['http://tiles.server']
            }))
        });

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

    test('tears down source event forwarding', () => {
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
                "coordinates": [0, 0]
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
        style.dispatcher.broadcast = function (key, value) {
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

        style.dispatcher.broadcast = function (key, value) {
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
        style.dispatcher.broadcast = function (key, value) {
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
        style.dispatcher.broadcast = function (key, value) {
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

    let style: any;
    let onError: any;
    let transform: any;

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
        style.querySourceFeatures('foo', {filter: "invalidFilter", validate: false}, transform);
        expect(errors).toEqual(0);
    });

    test('queryRenderedFeatures does not break on custom layers', () => {
        style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": []
        });
        style.on('style.load', () => {
            style.addLayer({
                "id": "custom",
                "type": "custom",
                render() {}
            });
            expect(() => {
                style.queryRenderedFeatures([0, 0], {}, transform);
            }).not.toThrowError();
        });
    });
});

describe('Style#addSourceType', () => {
    const _types = {'existing'() {}};

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

describe('Style#setColorTheme', () => {
    test('GLJS-905 empty lut loads faster than non-empty', async () => {
        const style = new Style(new StubMap());
        expect(style._styleColorTheme.lutLoadingCorrelationID).toEqual(0);
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
            "color-theme": {
                "data": "iVBORw0KGgoAAAANSUhEUgAABAAAAAAgCAYAAACM/gqmAAAAAXNSR0IArs4c6QAABSFJREFUeF7t3cFO40AQAFHnBv//wSAEEgmJPeUDsid5h9VqtcMiZsfdPdXVzmVZlo+3ZVm+fr3//L7257Lm778x+prL1ff0/b//H+z/4/M4OkuP/n70Nc7f+nnb+yzb//sY6vxt5xXPn+dP/aH+GsXJekb25izxR/ypZ6ucUefv9g4z2jPP3/HPHwAAgABAABgACIACkAAsAL1SD4yKWQAUAHUBdAG8buKNYoYL8PEX4FcHQAAAAAAAAAAAAAAAAAAAAAAA8LAeGF1mABAABAABQACQbZP7+hk5AwACAAAAAAAAAAAAAAAAAAAAAAAA4EE9AICMx4QBAAAAAAAANgvJsxGQV1dA/PxmMEtxU9YoABQACoC5CgDxX/wvsb2sEf/Ff/Ff/N96l5n73+/5YAB4CeBqx2VvMqXgUfD2npkzBCAXEBeQcrkoa5x/FxAXEBcQF5A2Wy3/t32qNYr8I//Mln+MABgBMAJgBMAIgBEAIwBGAIwAGAEwAmAE4K4eAGCNQIw+qQ0AmQ+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/6gEABAB5RgACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN/UAAPKcAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEFNODICRtDkDO/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOhvlPUWem+h9xKQ+V4CUt9wO6KZnn/Pv+ff8z/bW5DFP59CUnJbWSP+iX/iX78znqED/urxnwHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADoNMcHUAdQAQcAUfAe8xEwH0O86t3IPz8OvClu17WqD/UH+oP9cf1Gdia01d/LQsDgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABkCnSQwABgACj8Aj8D1mItAMAB1wHfDS3S5r5F/5V/6Vf3XAW12h/mIArHY89iZTAAQA2XtmBKAWqOslyf4rgBXACmAFcIur8k/bJ/mnQTr5V/6Vf+fKv0YAjAAYATACYATACIARACMARgCMABgBMAJgBMAIgBEAIwCdZuiA64AjwAgwAtxjpg6cDlztLlLA7/Pr1gueyr56/jx/5ZzUNeof9Y/6R/0zk4HGAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHQaQ4DgAGAgCPgCHiPmTqQOpC1u8gAYACMjAf5V/6Vf+XfmTrQ8l97v8Z/5X8GAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADIBO0xgADAAdCB0IHYgeMxkADAAdkGM7IPbf/pfuWlmj/lH/qH/UPzMZGAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAJ3mMAAYAAg4Ao6A95jJAGAA6EDrQJfuclkj/8q/8q/8O1MHWv47Nv8xABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAB0msYAYADoQOhA6ED0mMkAYADogBzbAbH/9r/YFWWN+kf9o/5R/8xkYDAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgAHSawwBgACDgCDgC3mMmA4ABoAOtA126y2WN/Cv/yr/y70wdaPnv2PzHAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHQaRoDgAGgA6EDoQPRYyYDgAGgA3JsB8T+2/9iV5Q16h/1j/pH/TOTgcEAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAPgyQ2AT4NBIB3ew5dkAAAAAElFTkSuQmCC"
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

        expect(style._styleColorTheme.lutLoadingCorrelationID).toEqual(1);

        const bwColorTheme = "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";
        style.setColorTheme({"data": bwColorTheme});
        style.setColorTheme({"data": ""});
        expect(style._styleColorTheme.lutLoadingCorrelationID).toEqual(3);

        await waitFor(style, "colorthemeset");
        await waitFor(style, "colorthemeset");
        expect(style._styleColorTheme.lut).toEqual(null);
    });
});

test('Style#addImage', async () => {
    const style = new Style(new StubMap());
    style.loadJSON(createStyleJSON());
    await waitFor(style, 'style.load');

    const errorSpy = vi.fn();
    style.on('error', errorSpy);
    vi.spyOn(style, 'fire');
    vi.spyOn(style.dispatcher, 'broadcast');

    const imageId = ImageId.from('image');
    style.addImage(imageId, {});

    expect(style._changes.isDirty()).toEqual(true);

    expect(style.dispatcher.broadcast).toHaveBeenCalledTimes(1);
    expect(style.dispatcher.broadcast).toHaveBeenLastCalledWith(
        'setImages',
        {scope: '', images: [imageId]}
    );

    expect(style.fire).toHaveBeenCalledTimes(1);
    expect(style.fire).toHaveBeenLastCalledWith(
        expect.objectContaining({
            type: 'data',
            dataType: 'style'
        })
    );

    // Adding an image with the same name should fire an error
    style.addImage(imageId, {});

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
            type: 'error',
            error: expect.objectContaining({message: 'An image with the name "image" already exists.'})
        })
    );
});

test('Style#addImages', async () => {
    const style = new Style(new StubMap());
    style.loadJSON(createStyleJSON());
    await waitFor(style, 'style.load');

    vi.spyOn(style, 'fire');
    vi.spyOn(style.dispatcher, 'broadcast');

    const styleImageMap = new Map();
    const imageId1 = ImageId.from('image1');
    const imageId2 = ImageId.from('image2');
    styleImageMap.set(imageId1, {});
    styleImageMap.set(imageId2, {});
    style.addImages(styleImageMap);

    expect(style._changes.isDirty()).toEqual(true);

    expect(style.dispatcher.broadcast).toHaveBeenCalledTimes(1);
    expect(style.dispatcher.broadcast).toHaveBeenLastCalledWith(
        'setImages',
        {scope: '', images: [imageId1, imageId2]}
    );

    expect(style.fire).toHaveBeenCalledTimes(1);
    expect(style.fire).toHaveBeenLastCalledWith(
        expect.objectContaining({
            type: 'data',
            dataType: 'style'
        })
    );
});

test('Style#updateImage', async () => {
    const style = new Style(new StubMap());
    style.loadJSON(createStyleJSON());
    await waitFor(style, 'style.load');

    const imageId = ImageId.from('image');
    style.addImage(imageId, {width: 1, height: 1, data: new Uint8Array(4)});
    style.update({}); // reset style changes

    vi.spyOn(style, 'fire');
    vi.spyOn(style.dispatcher, 'broadcast');

    // Basic update does not trigger update in Workers
    style.updateImage(imageId, {width: 1, height: 1, data: new Uint8Array(4)});

    expect(style._changes.isDirty()).toEqual(false);
    expect(style.dispatcher.broadcast).toHaveBeenCalledTimes(0);
    expect(style.fire).toHaveBeenCalledTimes(0);

    // Performing symbol layout must trigger update in Workers
    style.updateImage(imageId, {width: 1, height: 1, data: new Uint8Array(4)}, true);

    expect(style._changes.isDirty()).toEqual(true);
    expect(style.dispatcher.broadcast).toHaveBeenCalledTimes(1);
    expect(style.dispatcher.broadcast).toHaveBeenLastCalledWith(
        'setImages',
        {scope: '', images: [imageId]}
    );

    expect(style.fire).toHaveBeenCalledTimes(1);
    expect(style.fire).toHaveBeenLastCalledWith(
        expect.objectContaining({
            type: 'data',
            dataType: 'style'
        })
    );
});

test('Style#removeImage', async () => {
    const style = new Style(new StubMap());
    style.loadJSON(createStyleJSON());
    await waitFor(style, 'style.load');

    const imageId = ImageId.from('image');
    style.addImage(imageId, {});
    style.update({}); // reset style changes

    vi.spyOn(style, 'fire');
    vi.spyOn(style.dispatcher, 'broadcast');

    style.removeImage(imageId);

    expect(style._changes.isDirty()).toEqual(true);
    expect(style.dispatcher.broadcast).toHaveBeenCalledTimes(1);
    expect(style.dispatcher.broadcast).toHaveBeenLastCalledWith(
        'setImages',
        {scope: '', images: []}
    );

    expect(style.fire).toHaveBeenCalledTimes(1);
    expect(style.fire).toHaveBeenLastCalledWith(
        expect.objectContaining({
            type: 'data',
            dataType: 'style'
        })
    );
});

test('Style#_updateTilesForChangedImages', async () => {
    const style = new Style(new StubMap());

    style.loadJSON(createStyleJSON({sources: {geojson: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}}));

    await waitFor(style, 'style.load');
    vi.spyOn(style, '_updateTilesForChangedImages');

    const sourceCache = style.getSourceCache('geojson');
    vi.spyOn(sourceCache, 'setDependencies');
    vi.spyOn(sourceCache, 'reloadTilesForDependencies');

    const imageId = ImageId.from('missing-image');
    const imageIdStr = imageId.toString();
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

    const tile = new Tile(tileID);
    sourceCache._tiles[tileID.key] = tile;
    vi.spyOn(tile, 'setDependencies');

    await new Promise((resolve) => {
        expect(tile.hasDependency(['icons'], [imageIdStr])).toEqual(false);

        style.getImages(0, {images: [imageId], source: 'geojson', scope: '', tileID, type: 'icons'}, (err, result) => {
            expect(err).toBeFalsy();
            expect(result.size).toEqual(0);
            resolve();
        });
    });

    expect(style._updateTilesForChangedImages).toHaveBeenCalledTimes(1);
    expect(sourceCache.setDependencies).toHaveBeenCalledTimes(1);
    expect(sourceCache.setDependencies).toHaveBeenCalledWith(tileID.key, 'icons', [imageIdStr]);

    expect(tile.setDependencies).toHaveBeenCalledTimes(1);
    expect(tile.setDependencies).toHaveBeenCalledWith('icons', [imageIdStr]);
    expect(tile.hasDependency(['icons'], [imageIdStr])).toEqual(true);

    style.addImage(imageId, {});
    style.update({});

    expect(style._updateTilesForChangedImages).toHaveBeenCalledTimes(2);
    expect(sourceCache.reloadTilesForDependencies).toHaveBeenCalledTimes(1);
    expect(sourceCache.reloadTilesForDependencies).toHaveBeenCalledWith(['icons', 'patterns'], [imageIdStr]);
});
