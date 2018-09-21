import { test } from 'mapbox-gl-js-test';
import assert from 'assert';
import Style from '../../../src/style/style';
import SourceCache from '../../../src/source/source_cache';
import StyleLayer from '../../../src/style/style_layer';
import Transform from '../../../src/geo/transform';
import { extend } from '../../../src/util/util';
import { Event, Evented } from '../../../src/util/evented';
import window from '../../../src/util/window';
import {
    setRTLTextPlugin,
    clearRTLTextPlugin,
    evented as rtlTextPluginEvented
} from '../../../src/source/rtl_text_plugin';
import browser from '../../../src/util/browser';
import { OverscaledTileID } from '../../../src/source/tile_id';

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
    }

    _transformRequest(url) {
        return { url };
    }
}

test('Style', (t) => {
    t.afterEach((callback) => {
        window.restore();
        callback();
    });

    t.test('registers plugin listener', (t) => {
        clearRTLTextPlugin();

        t.spy(Style, 'registerForPluginAvailability');

        const style = new Style(new StubMap());
        t.spy(style.dispatcher, 'broadcast');
        t.ok(Style.registerForPluginAvailability.calledOnce);

        setRTLTextPlugin("some bogus url");
        t.ok(style.dispatcher.broadcast.calledWith('loadRTLTextPlugin', "some bogus url"));
        t.end();
    });

    t.test('loads plugin immediately if already registered', (t) => {
        clearRTLTextPlugin();
        window.useFakeXMLHttpRequest();
        window.server.respondWith('/plugin.js', "doesn't matter");
        let firstError = true;
        setRTLTextPlugin("/plugin.js", (error) => {
            // Getting this error message shows the bogus URL was succesfully passed to the worker
            // We'll get the error from all workers, only pay attention to the first one
            if (firstError) {
                t.equals(error.message, 'RTL Text Plugin failed to import scripts from /plugin.js');
                t.end();
                firstError = false;
            }
        });
        window.server.respond();
        new Style(createStyleJSON());
    });

    t.end();
});

test('Style#loadURL', (t) => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.restore();
        callback();
    });

    t.test('fires "dataloading"', (t) => {
        const style = new Style(new StubMap());
        const spy = t.spy();

        style.on('dataloading', spy);
        style.loadURL('style.json');

        t.ok(spy.calledOnce);
        t.equal(spy.getCall(0).args[0].target, style);
        t.equal(spy.getCall(0).args[0].dataType, 'style');
        t.end();
    });

    t.test('transforms style URL before request', (t) => {
        const map = new StubMap();
        const spy = t.spy(map, '_transformRequest');

        const style = new Style(map);
        style.loadURL('style.json');

        t.ok(spy.calledOnce);
        t.equal(spy.getCall(0).args[0], 'style.json');
        t.equal(spy.getCall(0).args[1], 'Style');
        t.end();
    });

    t.test('validates the style', (t) => {
        const style = new Style(new StubMap());

        style.on('error', ({error}) => {
            t.ok(error);
            t.match(error.message, /version/);
            t.end();
        });

        style.loadURL('style.json');
        window.server.respondWith(JSON.stringify(createStyleJSON({version: 'invalid'})));
        window.server.respond();
    });

    t.test('skips validation for mapbox:// styles', (t) => {
        const style = new Style(new StubMap())
            .on('error', () => {
                t.fail();
            })
            .on('style.load', () => {
                t.end();
            });

        style.loadURL('mapbox://styles/test/test', {accessToken: 'none'});

        window.server.respondWith(JSON.stringify(createStyleJSON({version: 'invalid'})));
        window.server.respond();
    });

    t.test('cancels pending requests if removed', (t) => {
        const style = new Style(new StubMap());
        style.loadURL('style.json');
        style._remove();
        t.equal(window.server.lastRequest.aborted, true);
        t.end();
    });

    t.end();
});

test('Style#loadJSON', (t) => {
    t.afterEach((callback) => {
        window.restore();
        callback();
    });

    t.test('fires "dataloading" (synchronously)', (t) => {
        const style = new Style(new StubMap());
        const spy = t.spy();

        style.on('dataloading', spy);
        style.loadJSON(createStyleJSON());

        t.ok(spy.calledOnce);
        t.equal(spy.getCall(0).args[0].target, style);
        t.equal(spy.getCall(0).args[0].dataType, 'style');
        t.end();
    });

    t.test('fires "data" (asynchronously)', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON());

        style.on('data', (e) => {
            t.equal(e.target, style);
            t.equal(e.dataType, 'style');
            t.end();
        });
    });

    t.test('fires "data" when the sprite finishes loading', (t) => {
        window.useFakeXMLHttpRequest();

        // Stubbing to bypass Web APIs that supported by jsdom:
        // * `URL.createObjectURL` in ajax.getImage (https://github.com/tmpvar/jsdom/issues/1721)
        // * `canvas.getContext('2d')` in browser.getImageData
        t.stub(window.URL, 'revokeObjectURL');
        t.stub(browser, 'getImageData');
        // stub Image so we can invoke 'onload'
        // https://github.com/jsdom/jsdom/commit/58a7028d0d5b6aacc5b435daee9fd8f9eacbb14c
        const img = {};
        t.stub(window, 'Image').returns(img);
        // stub this manually because sinon does not stub non-existent methods
        assert(!window.URL.createObjectURL);
        window.URL.createObjectURL = () => 'blob:';
        t.tearDown(() => delete window.URL.createObjectURL);

        // fake the image request (sinon doesn't allow non-string data for
        // server.respondWith, so we do so manually)
        const requests = [];
        window.XMLHttpRequest.onCreate = req => { requests.push(req); };
        const respond = () => {
            let req = requests.find(req => req.url === 'http://example.com/sprite.png');
            req.setStatus(200);
            req.response = new ArrayBuffer(8);
            req.onload();
            img.onload();

            req = requests.find(req => req.url === 'http://example.com/sprite.json');
            req.setStatus(200);
            req.response = '{}';
            req.onload();
        };

        const style = new Style(new StubMap());

        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [],
            "sprite": "http://example.com/sprite"
        });

        style.once('error', (e) => t.error(e));

        style.once('data', (e) => {
            t.equal(e.target, style);
            t.equal(e.dataType, 'style');

            style.once('data', (e) => {
                t.equal(e.target, style);
                t.equal(e.dataType, 'style');
                t.end();
            });

            respond();
        });
    });

    t.test('validates the style', (t) => {
        const style = new Style(new StubMap());

        style.on('error', ({error}) => {
            t.ok(error);
            t.match(error.message, /version/);
            t.end();
        });

        style.loadJSON(createStyleJSON({version: 'invalid'}));
    });

    t.test('creates sources', (t) => {
        const style = new Style(new StubMap());

        style.on('style.load', () => {
            t.ok(style.sourceCaches['mapbox'] instanceof SourceCache);
            t.end();
        });

        style.loadJSON(extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
    });

    t.test('creates layers', (t) => {
        const style = new Style(new StubMap());

        style.on('style.load', () => {
            t.ok(style.getLayer('fill') instanceof StyleLayer);
            t.end();
        });

        style.loadJSON({
            "version": 8,
            "sources": {
                "foo": {
                    "type": "vector"
                }
            },
            "layers": [{
                "id": "fill",
                "source": "foo",
                "source-layer": "source-layer",
                "type": "fill"
            }]
        });
    });

    t.test('transforms sprite json and image URLs before request', (t) => {
        window.useFakeXMLHttpRequest();

        const map = new StubMap();
        const transformSpy = t.spy(map, '_transformRequest');
        const style = new Style(map);

        style.on('style.load', () => {
            t.equal(transformSpy.callCount, 2);
            t.equal(transformSpy.getCall(0).args[0], 'http://example.com/sprites/bright-v8.json');
            t.equal(transformSpy.getCall(0).args[1], 'SpriteJSON');
            t.equal(transformSpy.getCall(1).args[0], 'http://example.com/sprites/bright-v8.png');
            t.equal(transformSpy.getCall(1).args[1], 'SpriteImage');
            t.end();
        });

        style.loadJSON(extend(createStyleJSON(), {
            "sprite": "http://example.com/sprites/bright-v8"
        }));
    });

    t.test('emits an error on non-existant vector source layer', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {
                '-source-id-': { type: "vector", tiles: [] }
            },
            layers: []
        }));

        style.on('style.load', () => {
            style.removeSource('-source-id-');

            const source = createSource();
            source['vector_layers'] = [{ id: 'green' }];
            style.addSource('-source-id-', source);
            style.addLayer({
                'id': '-layer-id-',
                'type': 'circle',
                'source': '-source-id-',
                'source-layer': '-source-layer-'
            });
            style.update({});
        });

        style.on('error', (event) => {
            const err = event.error;
            t.ok(err);
            t.ok(err.toString().indexOf('-source-layer-') !== -1);
            t.ok(err.toString().indexOf('-source-id-') !== -1);
            t.ok(err.toString().indexOf('-layer-id-') !== -1);

            t.end();
        });
    });

    t.test('sets up layer event forwarding', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', (e) => {
            t.deepEqual(e.layer, {id: 'background'});
            t.ok(e.mapbox);
            t.end();
        });

        style.on('style.load', () => {
            style._layers.background.fire(new Event('error', {mapbox: true}));
        });
    });

    t.end();
});

test('Style#_remove', (t) => {
    t.test('clears tiles', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', () => {
            const sourceCache = style.sourceCaches['source-id'];
            t.spy(sourceCache, 'clearTiles');
            style._remove();
            t.ok(sourceCache.clearTiles.calledOnce);
            t.end();
        });
    });

    t.test('deregisters plugin listener', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        t.spy(style.dispatcher, 'broadcast');

        style.on('style.load', () => {
            style._remove();

            rtlTextPluginEvented.fire(new Event('pluginAvailable'));
            t.notOk(style.dispatcher.broadcast.calledWith('loadRTLTextPlugin'));
            t.end();
        });
    });

    t.end();
});

test('Style#update', (t) => {
    const style = new Style(new StubMap());
    style.loadJSON({
        'version': 8,
        'sources': {
            'source': {
                'type': 'vector'
            }
        },
        'layers': [{
            'id': 'second',
            'source': 'source',
            'source-layer': 'source-layer',
            'type': 'fill'
        }]
    });

    style.on('error', (error) => { t.error(error); });

    style.on('style.load', () => {
        style.addLayer({id: 'first', source: 'source', type: 'fill', 'source-layer': 'source-layer' }, 'second');
        style.addLayer({id: 'third', source: 'source', type: 'fill', 'source-layer': 'source-layer' });
        style.removeLayer('second');

        style.dispatcher.broadcast = function(key, value) {
            t.equal(key, 'updateLayers');
            t.deepEqual(value.layers.map((layer) => { return layer.id; }), ['first', 'third']);
            t.deepEqual(value.removedIds, ['second']);
            t.end();
        };

        style.update({});
    });
});

test('Style#setState', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        t.throws(() => style.setState(createStyleJSON()), /load/i);
        t.end();
    });

    t.test('do nothing if there are no changes', (t) => {
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
            'setLight'
        ].forEach((method) => t.stub(style, method).callsFake(() => t.fail(`${method} called`)));
        style.on('style.load', () => {
            const didChange = style.setState(createStyleJSON());
            t.notOk(didChange, 'return false');
            t.end();
        });
    });

    t.test('Issue #3893: compare new source options against originally provided options rather than normalized properties', (t) => {
        window.useFakeXMLHttpRequest();
        window.server.respondWith('/tilejson.json', JSON.stringify({
            tiles: ['http://tiles.server']
        }));
        const initial = createStyleJSON();
        initial.sources.mySource = {
            type: 'raster',
            url: '/tilejson.json'
        };
        const style = new Style(new StubMap());
        style.loadJSON(initial);
        style.on('style.load', () => {
            t.stub(style, 'removeSource').callsFake(() => t.fail('removeSource called'));
            t.stub(style, 'addSource').callsFake(() => t.fail('addSource called'));
            style.setState(initial);
            window.restore();
            t.end();
        });
        window.server.respond();
    });

    t.test('return true if there is a change', (t) => {
        const initialState = createStyleJSON();
        const nextState = createStyleJSON({
            sources: {
                foo: {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                }
            }
        });

        const style = new Style(new StubMap());
        style.loadJSON(initialState);
        style.on('style.load', () => {
            const didChange = style.setState(nextState);
            t.ok(didChange);
            t.same(style.stylesheet, nextState);
            t.end();
        });
    });

    t.test('sets GeoJSON source data if different', (t) => {
        const initialState = createStyleJSON({
            "sources": { "source-id": createGeoJSONSource() }
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

        style.on('style.load', () => {
            const geoJSONSource = style.sourceCaches['source-id'].getSource();
            t.spy(style, 'setGeoJSONSourceData');
            t.spy(geoJSONSource, 'setData');
            const didChange = style.setState(nextState);

            t.ok(style.setGeoJSONSourceData.calledWith('source-id', geoJSONSourceData));
            t.ok(geoJSONSource.setData.calledWith(geoJSONSourceData));
            t.ok(didChange);
            t.same(style.stylesheet, nextState);
            t.end();
        });
    });

    t.end();
});

test('Style#addSource', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        t.throws(() => style.addSource('source-id', createSource()), /load/i);
        t.end();
    });

    t.test('throw if missing source type', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        const source = createSource();
        delete source.type;

        style.on('style.load', () => {
            t.throws(() => style.addSource('source-id', source), /type/i);
            t.end();
        });
    });

    t.test('fires "data" event', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.once('data', t.end);
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.update({});
        });
    });

    t.test('throws on duplicates', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.on('style.load', () => {
            style.addSource('source-id', source);
            t.throws(() => {
                style.addSource('source-id', source);
            }, /There is already a source with this ID/);
            t.end();
        });
    });

    t.test('emits on invalid source', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            style.on('error', () => {
                t.notOk(style.sourceCaches['source-id']);
                t.end();
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

    t.test('sets up source event forwarding', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));
        const source = createSource();

        style.on('style.load', () => {
            t.plan(4);

            style.on('error', () => { t.ok(true); });
            style.on('data', (e) => {
                if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                    t.ok(true);
                } else if (e.sourceDataType === 'content' && e.dataType === 'source') {
                    t.ok(true);
                } else {
                    t.ok(true);
                }
            });

            style.addSource('source-id', source); // fires data twice
            style.sourceCaches['source-id'].fire(new Event('error'));
            style.sourceCaches['source-id'].fire(new Event('data'));
        });
    });

    t.end();
});

test('Style#removeSource', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        t.throws(() => style.removeSource('source-id'), /load/i);
        t.end();
    });

    t.test('fires "data" event', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.once('data', t.end);
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.removeSource('source-id');
            style.update({});
        });
    });

    t.test('clears tiles', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', () => {
            const sourceCache = style.sourceCaches['source-id'];
            t.spy(sourceCache, 'clearTiles');
            style.removeSource('source-id');
            t.ok(sourceCache.clearTiles.calledOnce);
            t.end();
        });
    });

    t.test('throws on non-existence', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            t.throws(() => {
                style.removeSource('source-id');
            }, /There is no source with this ID/);
            t.end();
        });
    });

    function createStyle(callback) {
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
        style.on('style.load', () => {
            style.update(1, 0);
            callback(style);
        });
        return style;
    }

    t.test('throws if source is in use', (t) => {
        createStyle((style) => {
            style.on('error', (event) => {
                t.ok(event.error.message.includes('"mapbox-source"'));
                t.ok(event.error.message.includes('"mapbox-layer"'));
                t.end();
            });
            style.removeSource('mapbox-source');
        });
    });

    t.test('does not throw if source is not in use', (t) => {
        createStyle((style) => {
            style.on('error', () => {
                t.fail();
            });
            style.removeLayer('mapbox-layer');
            style.removeSource('mapbox-source');
            t.end();
        });
    });

    t.test('tears down source event forwarding', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        let source = createSource();

        style.on('style.load', () => {
            style.addSource('source-id', source);
            source = style.sourceCaches['source-id'];

            style.removeSource('source-id');

            // Suppress error reporting
            source.on('error', () => {});

            style.on('data', () => { t.ok(false); });
            style.on('error', () => { t.ok(false); });
            source.fire(new Event('data'));
            source.fire(new Event('error'));

            t.end();
        });
    });

    t.end();
});

test('Style#setGeoJSONSourceData', (t) => {
    const geoJSON = {type: "FeatureCollection", features: []};

    t.test('throws before loaded', (t) => {
        const style = new Style(new StubMap());
        t.throws(() => style.setGeoJSONSourceData('source-id', geoJSON), /load/i);
        t.end();
    });

    t.test('throws on non-existence', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            t.throws(() => style.setGeoJSONSourceData('source-id', geoJSON), /There is no source with this ID/);
            t.end();
        });
    });

    t.end();
});

test('Style#addLayer', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        t.throws(() => style.addLayer({id: 'background', type: 'background'}), /load/i);
        t.end();
    });

    t.test('sets up layer event forwarding', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        style.on('error', (e) => {
            t.deepEqual(e.layer, {id: 'background'});
            t.ok(e.mapbox);
            t.end();
        });

        style.on('style.load', () => {
            style.addLayer({
                id: 'background',
                type: 'background'
            });
            style._layers.background.fire(new Event('error', {mapbox: true}));
        });
    });

    t.test('throws on non-existant vector source layer', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {
                // At least one source must be added to trigger the load event
                dummy: { type: "vector", tiles: [] }
            }
        }));

        style.on('style.load', () => {
            const source = createSource();
            source['vector_layers'] = [{id: 'green'}];
            style.addSource('-source-id-', source);
            style.addLayer({
                'id': '-layer-id-',
                'type': 'circle',
                'source': '-source-id-',
                'source-layer': '-source-layer-'
            });
        });

        style.on('error', (event) => {
            const err = event.error;

            t.ok(err);
            t.ok(err.toString().indexOf('-source-layer-') !== -1);
            t.ok(err.toString().indexOf('-source-id-') !== -1);
            t.ok(err.toString().indexOf('-layer-id-') !== -1);

            t.end();
        });
    });

    t.test('emits error on invalid layer', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            style.on('error', () => {
                t.notOk(style.getLayer('background'));
                t.end();
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

    t.test('#4040 does not mutate source property when provided inline', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            const source = {
                "type": "geojson",
                "data": {
                    "type": "Point",
                    "coordinates": [ 0, 0]
                }
            };
            const layer = {id: 'inline-source-layer', type: 'circle', source: source };
            style.addLayer(layer);
            t.deepEqual(layer.source, source);
            t.end();
        });
    });

    t.test('reloads source', (t) => {
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

        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapbox'].reload = t.end;
                style.addLayer(layer);
                style.update({});
            }
        });
    });

    t.test('#3895 reloads source (instead of clearing) if adding this layer with the same type, immediately after removing it', (t) => {
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

        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapbox'].reload = t.end;
                style.sourceCaches['mapbox'].clearTiles = t.fail;
                style.removeLayer('my-layer');
                style.addLayer(layer);
                style.update({});
            }
        });

    });

    t.test('clears source (instead of reloading) if adding this layer with a different type, immediately after removing it', (t) => {
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
        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapbox'].reload = t.fail;
                style.sourceCaches['mapbox'].clearTiles = t.end;
                style.removeLayer('my-layer');
                style.addLayer(layer);
                style.update({});
            }
        });

    });

    t.test('fires "data" event', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', () => {
            style.addLayer(layer);
            style.update({});
        });
    });

    t.test('emits error on duplicates', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.on('error', (e) => {
            t.match(e.error, /already exists/);
            t.end();
        });

        style.on('style.load', () => {
            style.addLayer(layer);
            style.addLayer(layer);
        });
    });

    t.test('adds to the end by default', (t) => {
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

        style.on('style.load', () => {
            style.addLayer(layer);
            t.deepEqual(style._order, ['a', 'b', 'c']);
            t.end();
        });
    });

    t.test('adds before the given layer', (t) => {
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

        style.on('style.load', () => {
            style.addLayer(layer, 'a');
            t.deepEqual(style._order, ['c', 'a', 'b']);
            t.end();
        });
    });

    t.test('fire error if before layer does not exist', (t) => {
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

        style.on('style.load', () => {
            style.on('error', (error)=>{
                t.match(error.error, /does not exist on this map/);
                t.end();
            });
            style.addLayer(layer, 'z');
        });
    });

    t.test('fires an error on non-existant source layer', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            sources: {
                dummy: {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                }
            }
        }));

        const layer = {
            id: 'dummy',
            type: 'fill',
            source: 'dummy',
            'source-layer': 'dummy'
        };

        style.on('style.load', () => {
            style.on('error', ({ error }) => {
                t.match(error.message, /does not exist on source/);
                t.end();
            });
            style.addLayer(layer);
        });

    });

    t.end();
});

test('Style#removeLayer', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        t.throws(() => style.removeLayer('background'), /load/i);
        t.end();
    });

    t.test('fires "data" event', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', () => {
            style.addLayer(layer);
            style.removeLayer('background');
            style.update({});
        });
    });

    t.test('tears down layer event forwarding', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', () => {
            t.fail();
        });

        style.on('style.load', () => {
            const layer = style._layers.background;
            style.removeLayer('background');

            // Bind a listener to prevent fallback Evented error reporting.
            layer.on('error', () => {});

            layer.fire(new Event('error', {mapbox: true}));
            t.end();
        });
    });

    t.test('fires an error on non-existence', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        style.on('style.load', () => {
            style.on('error', ({ error }) => {
                t.match(error.message, /does not exist in the map\'s style and cannot be removed/);
                t.end();
            });
            style.removeLayer('background');
        });
    });

    t.test('removes from the order', (t) => {
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

        style.on('style.load', () => {
            style.removeLayer('a');
            t.deepEqual(style._order, ['b']);
            t.end();
        });
    });

    t.test('does not remove dereffed layers', (t) => {
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

        style.on('style.load', () => {
            style.removeLayer('a');
            t.equal(style.getLayer('a'), undefined);
            t.notEqual(style.getLayer('b'), undefined);
            t.end();
        });
    });

    t.end();
});

test('Style#moveLayer', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        t.throws(() => style.moveLayer('background'), /load/i);
        t.end();
    });

    t.test('fires "data" event', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', () => {
            style.addLayer(layer);
            style.moveLayer('background');
            style.update({});
        });
    });

    t.test('fires an error on non-existence', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        style.on('style.load', () => {
            style.on('error', ({ error }) => {
                t.match(error.message, /does not exist in the map\'s style and cannot be moved/);
                t.end();
            });
            style.moveLayer('background');
        });
    });

    t.test('changes the order', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
                {id: 'c', type: 'background'}
            ]
        }));

        style.on('style.load', () => {
            style.moveLayer('a', 'c');
            t.deepEqual(style._order, ['b', 'a', 'c']);
            t.end();
        });
    });

    t.test('moves to existing location', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
                {id: 'c', type: 'background'}
            ]
        }));

        style.on('style.load', () => {
            style.moveLayer('b', 'b');
            t.deepEqual(style._order, ['a', 'b', 'c']);
            t.end();
        });
    });

    t.end();
});

test('Style#setPaintProperty', (t) => {
    t.test('#4738 postpones source reload until layers have been broadcast to workers', (t) => {
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

        style.once('style.load', () => {
            style.update(tr.zoom, 0);
            const sourceCache = style.sourceCaches['geojson'];
            const source = style.getSource('geojson');

            let begun = false;
            let styleUpdateCalled = false;

            source.on('data', (e) => setImmediate(() => {
                if (!begun && sourceCache.loaded()) {
                    begun = true;
                    t.stub(sourceCache, 'reload').callsFake(() => {
                        t.ok(styleUpdateCalled, 'loadTile called before layer data broadcast');
                        t.end();
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
            }));
        });
    });

    t.test('#5802 clones the input', (t) => {
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

        style.on('style.load', () => {
            const value = {stops: [[0, 'red'], [10, 'blue']]};
            style.setPaintProperty('background', 'background-color', value);
            t.notEqual(style.getPaintProperty('background', 'background-color'), value);
            t.ok(style._changed);

            style.update({});
            t.notOk(style._changed);

            value.stops[0][0] = 1;
            style.setPaintProperty('background', 'background-color', value);
            t.ok(style._changed);

            t.end();
        });
    });

    t.end();
});

test('Style#getPaintProperty', (t) => {
    t.test('#5802 clones the output', (t) => {
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

        style.on('style.load', () => {
            style.setPaintProperty('background', 'background-color', {stops: [[0, 'red'], [10, 'blue']]});
            style.update({});
            t.notOk(style._changed);

            const value = style.getPaintProperty('background', 'background-color');
            value.stops[0][0] = 1;
            style.setPaintProperty('background', 'background-color', value);
            t.ok(style._changed);

            t.end();
        });
    });

    t.end();
});

test('Style#setLayoutProperty', (t) => {
    t.test('#5802 clones the input', (t) => {
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

        style.on('style.load', () => {
            const value = {stops: [[0, 'butt'], [10, 'round']]};
            style.setLayoutProperty('line', 'line-cap', value);
            t.notEqual(style.getLayoutProperty('line', 'line-cap'), value);
            t.ok(style._changed);

            style.update({});
            t.notOk(style._changed);

            value.stops[0][0] = 1;
            style.setLayoutProperty('line', 'line-cap', value);
            t.ok(style._changed);

            t.end();
        });
    });

    t.end();
});

test('Style#getLayoutProperty', (t) => {
    t.test('#5802 clones the output', (t) => {
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

        style.on('style.load', () => {
            style.setLayoutProperty('line', 'line-cap', {stops: [[0, 'butt'], [10, 'round']]});
            style.update({});
            t.notOk(style._changed);

            const value = style.getLayoutProperty('line', 'line-cap');
            value.stops[0][0] = 1;
            style.setLayoutProperty('line', 'line-cap', value);
            t.ok(style._changed);

            t.end();
        });
    });

    t.end();
});

test('Style#setFilter', (t) => {
    t.test('throws if style is not loaded', (t) => {
        const style = new Style(new StubMap());
        t.throws(() => style.setFilter('symbol', ['==', 'id', 1]), /load/i);
        t.end();
    });

    function createStyle() {
        const style = new Style(new StubMap());
        style.loadJSON({
            version: 8,
            sources: {
                geojson: createGeoJSONSource()
            },
            layers: [
                { id: 'symbol', type: 'symbol', source: 'geojson', filter: ['==', 'id', 0] }
            ]
        });
        return style;
    }

    t.test('sets filter', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'updateLayers');
                t.deepEqual(value.layers[0].id, 'symbol');
                t.deepEqual(value.layers[0].filter, ['==', 'id', 1]);
                t.end();
            };

            style.setFilter('symbol', ['==', 'id', 1]);
            t.deepEqual(style.getFilter('symbol'), ['==', 'id', 1]);
            style.update({}); // trigger dispatcher broadcast
        });
    });

    t.test('gets a clone of the filter', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            const filter1 = ['==', 'id', 1];
            style.setFilter('symbol', filter1);
            const filter2 = style.getFilter('symbol');
            const filter3 = style.getLayer('symbol').filter;

            t.notEqual(filter1, filter2);
            t.notEqual(filter1, filter3);
            t.notEqual(filter2, filter3);

            t.end();
        });
    });

    t.test('sets again mutated filter', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            const filter = ['==', 'id', 1];
            style.setFilter('symbol', filter);
            style.update({}); // flush pending operations

            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'updateLayers');
                t.deepEqual(value.layers[0].id, 'symbol');
                t.deepEqual(value.layers[0].filter, ['==', 'id', 2]);
                t.end();
            };
            filter[2] = 2;
            style.setFilter('symbol', filter);
            style.update({}); // trigger dispatcher broadcast
        });
    });

    t.test('unsets filter', (t) => {
        const style = createStyle();
        style.on('style.load', () => {
            style.setFilter('symbol', null);
            t.equal(style.getLayer('symbol').serialize().filter, undefined);
            t.end();
        });
    });

    t.test('emits if invalid', (t) => {
        const style = createStyle();
        style.on('style.load', () => {
            style.on('error', () => {
                t.deepEqual(style.getLayer('symbol').serialize().filter, ['==', 'id', 0]);
                t.end();
            });
            style.setFilter('symbol', ['==', '$type', 1]);
        });
    });

    t.test('fires an error if layer not found', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.on('error', ({ error }) => {
                t.match(error.message, /does not exist in the map\'s style and cannot be filtered/);
                t.end();
            });
            style.setFilter('non-existant', ['==', 'id', 1]);
        });
    });

    t.end();
});

test('Style#setLayerZoomRange', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        t.throws(() => style.setLayerZoomRange('symbol', 5, 12), /load/i);
        t.end();
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

    t.test('sets zoom range', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'updateLayers');
                t.deepEqual(value.map((layer) => { return layer.id; }), ['symbol']);
            };

            style.setLayerZoomRange('symbol', 5, 12);
            t.equal(style.getLayer('symbol').minzoom, 5, 'set minzoom');
            t.equal(style.getLayer('symbol').maxzoom, 12, 'set maxzoom');
            t.end();
        });
    });

    t.test('fires an error if layer not found', (t) => {
        const style = createStyle();
        style.on('style.load', () => {
            style.on('error', ({ error }) => {
                t.match(error.message, /does not exist in the map\'s style and cannot have zoom extent/);
                t.end();
            });
            style.setLayerZoomRange('non-existant', 5, 12);
        });
    });

    t.end();
});

test('Style#queryRenderedFeatures', (t) => {
    const style = new Style(new StubMap());
    const transform = new Transform();
    transform.resize(512, 512);

    function queryMapboxFeatures(layers, getFeatureState, queryGeom, scale, params) {
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
                ({ feature, featureIndex }));
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
                "data": { type: "FeatureCollection", features: [] }
            },
            "other": {
                "type": "geojson",
                "data": { type: "FeatureCollection", features: [] }
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

    style.on('style.load', () => {
        style.sourceCaches.mapbox.tilesIn = () => {
            return [{
                tile: { queryRenderedFeatures: queryMapboxFeatures },
                tileID: new OverscaledTileID(0, 0, 0, 0, 0),
                queryGeometry: [],
                scale: 1
            }];
        };
        style.sourceCaches.other.tilesIn = () => {
            return [];
        };

        style.sourceCaches.mapbox.transform = transform;
        style.sourceCaches.other.transform = transform;

        style.update(0);
        style._updateSources(transform);

        t.test('returns feature type', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
            t.equal(results[0].geometry.type, 'Line');
            t.end();
        });

        t.test('filters by `layers` option', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land']}, transform);
            t.equal(results.length, 2);
            t.end();
        });

        t.test('checks type of `layers` option', (t) => {
            let errors = 0;
            t.stub(style, 'fire').callsFake((event) => {
                if (event.error && event.error.message.includes('parameters.layers must be an Array.')) errors++;
            });
            style.queryRenderedFeatures([{x: 0, y: 0}], {layers:'string'}, transform);
            t.equals(errors, 1);
            t.end();
        });

        t.test('includes layout properties', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
            const layout = results[0].layer.layout;
            t.deepEqual(layout['line-cap'], 'round');
            t.end();
        });

        t.test('includes paint properties', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
            t.deepEqual(results[2].layer.paint['line-color'], 'red');
            t.end();
        });

        t.test('includes metadata', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);

            const layer = results[1].layer;
            t.equal(layer.metadata.something, 'else');

            t.end();
        });

        t.test('include multiple layers', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land', 'landref']}, transform);
            t.equals(results.length, 3);
            t.end();
        });

        t.test('does not query sources not implicated by `layers` parameter', (t) => {
            style.sourceCaches.mapbox.queryRenderedFeatures = function() { t.fail(); };
            style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land--other']}, transform);
            t.end();
        });

        t.test('fires an error if layer included in params does not exist on the style', (t) => {
            let errors = 0;
            t.stub(style, 'fire').callsFake((event) => {
                if (event.error && event.error.message.includes('does not exist in the map\'s style and cannot be queried for features.')) errors++;
            });
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers:['merp']}, transform);
            t.equals(errors, 1);
            t.equals(results.length, 0);
            t.end();
        });

        t.end();
    });
});

test('Style defers expensive methods', (t) => {
    const style = new Style(new StubMap());
    style.loadJSON(createStyleJSON({
        "sources": {
            "streets": createGeoJSONSource(),
            "terrain": createGeoJSONSource()
        }
    }));

    style.on('style.load', () => {
        style.update({});

        // spies to track defered methods
        t.spy(style, 'fire');
        t.spy(style, '_reloadSource');
        t.spy(style, '_updateWorkerLayers');

        style.addLayer({ id: 'first', type: 'symbol', source: 'streets' });
        style.addLayer({ id: 'second', type: 'symbol', source: 'streets' });
        style.addLayer({ id: 'third', type: 'symbol', source: 'terrain' });

        style.setPaintProperty('first', 'text-color', 'black');
        style.setPaintProperty('first', 'text-halo-color', 'white');

        t.notOk(style.fire.called, 'fire is deferred');
        t.notOk(style._reloadSource.called, '_reloadSource is deferred');
        t.notOk(style._updateWorkerLayers.called, '_updateWorkerLayers is deferred');

        style.update({});

        t.equal(style.fire.args[0][0].type, 'data', 'a data event was fired');

        // called per source
        t.ok(style._reloadSource.calledTwice, '_reloadSource is called per source');
        t.ok(style._reloadSource.calledWith('streets'), '_reloadSource is called for streets');
        t.ok(style._reloadSource.calledWith('terrain'), '_reloadSource is called for terrain');

        // called once
        t.ok(style._updateWorkerLayers.calledOnce, '_updateWorkerLayers is called once');

        t.end();
    });
});

test('Style#query*Features', (t) => {

    // These tests only cover filter validation. Most tests for these methods
    // live in the integration tests.

    let style;
    let onError;
    let transform;

    t.beforeEach((callback) => {
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

        onError = t.spy();

        style.on('error', onError)
            .on('style.load', () => {
                callback();
            });
    });

    t.test('querySourceFeatures emits an error on incorrect filter', (t) => {
        t.deepEqual(style.querySourceFeatures([10, 100], {filter: 7}, transform), []);
        t.match(onError.args[0][0].error.message, /querySourceFeatures\.filter/);
        t.end();
    });

    t.test('queryRenderedFeatures emits an error on incorrect filter', (t) => {
        t.deepEqual(style.queryRenderedFeatures([{x: 0, y: 0}], {filter: 7}, transform), []);
        t.match(onError.args[0][0].error.message, /queryRenderedFeatures\.filter/);
        t.end();
    });

    t.end();
});

test('Style#addSourceType', (t) => {
    const _types = { 'existing': function () {} };

    t.stub(Style, 'getSourceType').callsFake(name => _types[name]);
    t.stub(Style, 'setSourceType').callsFake((name, create) => {
        _types[name] = create;
    });

    t.test('adds factory function', (t) => {
        const style = new Style(new StubMap());
        const SourceType = function () {};

        // expect no call to load worker source
        style.dispatcher.broadcast = function (type) {
            if (type === 'loadWorkerSource') {
                t.fail();
            }
        };

        style.addSourceType('foo', SourceType, () => {
            t.equal(_types['foo'], SourceType);
            t.end();
        });
    });

    t.test('triggers workers to load worker source code', (t) => {
        const style = new Style(new StubMap());
        const SourceType = function () {};
        SourceType.workerSourceURL = 'worker-source.js';

        style.dispatcher.broadcast = function (type, params) {
            if (type === 'loadWorkerSource') {
                t.equal(_types['bar'], SourceType);
                t.equal(params.name, 'bar');
                t.equal(params.url, 'worker-source.js');
                t.end();
            }
        };

        style.addSourceType('bar', SourceType, (err) => { t.error(err); });
    });

    t.test('refuses to add new type over existing name', (t) => {
        const style = new Style(new StubMap());
        style.addSourceType('existing', () => {}, (err) => {
            t.ok(err);
            t.end();
        });
    });

    t.end();
});

test('Style#hasTransitions', (t) => {
    t.test('returns false when the style is loading', (t) => {
        const style = new Style(new StubMap());
        t.equal(style.hasTransitions(), false);
        t.end();
    });

    t.test('returns true when a property is transitioning', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [{
                "id": "background",
                "type": "background"
            }]
        });

        style.on('style.load', () => {
            style.setPaintProperty("background", "background-color", "blue");
            style.update({transition: { duration: 300, delay: 0 }});
            t.equal(style.hasTransitions(), true);
            t.end();
        });
    });

    t.test('returns false when a property is not transitioning', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [{
                "id": "background",
                "type": "background"
            }]
        });

        style.on('style.load', () => {
            style.setPaintProperty("background", "background-color", "blue");
            style.update({transition: { duration: 0, delay: 0 }});
            t.equal(style.hasTransitions(), false);
            t.end();
        });
    });

    t.end();
});
