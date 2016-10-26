'use strict';

const test = require('mapbox-gl-js-test').test;
const proxyquire = require('proxyquire');
const Style = require('../../../js/style/style');
const SourceCache = require('../../../js/source/source_cache');
const StyleLayer = require('../../../js/style/style_layer');
const util = require('../../../js/util/util');
const Evented = require('../../../js/util/evented');
const window = require('../../../js/util/window');

function createStyleJSON(properties) {
    return util.extend({
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

test('Style', (t) => {
    t.afterEach((callback) => {
        window.restore();
        callback();
    });

    t.test('can be constructed from JSON', (t) => {
        const style = new Style(createStyleJSON());
        t.ok(style);
        t.end();
    });

    t.test('fires "dataloading"', (t) => {
        const eventedParent = new Evented();
        eventedParent.on('dataloading', t.end);
        new Style(createStyleJSON(), eventedParent);
    });

    t.test('can be constructed from a URL', (t) => {
        window.useFakeXMLHttpRequest();
        window.server.respondWith('/style.json', JSON.stringify(require('../../fixtures/style')));
        const style = new Style('/style.json');
        style.on('style.load', () => {
            window.restore();
            t.end();
        });
        window.server.respond();
    });

    t.test('creates sources', (t) => {
        const style = new Style(util.extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
        style.on('style.load', () => {
            t.ok(style.sourceCaches['mapbox'] instanceof SourceCache);
            t.end();
        });
    });

    t.test('validates the style by default', (t) => {
        const style = new Style(createStyleJSON({version: 'invalid'}));

        style.on('error', (event) => {
            t.ok(event.error);
            t.match(event.error.message, /version/);
            t.end();
        });
    });

    t.test('skips validation for mapbox:// styles', (t) => {
        const Style = proxyquire('../../../js/style/style', {
            '../util/mapbox': {
                isMapboxURL: function(url) {
                    t.equal(url, 'mapbox://styles/test/test');
                    return true;
                },
                normalizeStyleURL: function(url) {
                    t.equal(url, 'mapbox://styles/test/test');
                    return url;
                }
            }
        });

        window.useFakeXMLHttpRequest();

        new Style('mapbox://styles/test/test')
            .on('error', () => {
                t.fail();
            })
            .on('style.load', () => {
                window.restore();
                t.end();
            });

        window.server.respondWith('mapbox://styles/test/test', JSON.stringify(createStyleJSON({version: 'invalid'})));
        window.server.respond();
    });

    t.test('emits an error on non-existant vector source layer', (t) => {
        const style = new Style(createStyleJSON({
            sources: {
                '-source-id-': { type: "vector", tiles: [] }
            },
            layers: [{
                'id': '-layer-id-',
                'type': 'circle',
                'source': '-source-id-',
                'source-layer': '-source-layer-'
            }]
        }));

        style.on('style.load', () => {
            style.removeSource('-source-id-');

            const source = createSource();
            source['vector_layers'] = [{ id: 'green' }];
            style.addSource('-source-id-', source);
            style.update();
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
        const style = new Style(createStyleJSON({
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
            style._layers.background.fire('error', {mapbox: true});
        });
    });

    t.end();
});

test('Style#_remove', (t) => {

    t.test('clears tiles', (t) => {
        const style = new Style(createStyleJSON({
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

    t.end();

});

test('Style#_updateWorkerLayers', (t) => {
    const style = new Style({
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

        style.dispatcher.broadcast = function(key, value) {
            t.equal(key, 'setLayers');
            t.deepEqual(value.map((layer) => { return layer.id; }), ['first', 'second', 'third']);
            t.end();
        };

        style._updateWorkerLayers();
    });
});

test('Style#_updateWorkerLayers with specific ids', (t) => {
    const style = new Style({
        'version': 8,
        'sources': {
            'source': {
                'type': 'vector'
            }
        },
        'layers': [
            {id: 'first', source: 'source', type: 'fill', 'source-layer': 'source-layer'},
            {id: 'second', source: 'source', type: 'fill', 'source-layer': 'source-layer'},
            {id: 'third', source: 'source', type: 'fill', 'source-layer': 'source-layer'}
        ]
    });

    style.on('error', (error) => { t.error(error); });

    style.on('style.load', () => {
        style.dispatcher.broadcast = function(key, value) {
            t.equal(key, 'updateLayers');
            t.deepEqual(value.map((layer) => { return layer.id; }), ['second', 'third']);
            t.end();
        };

        style._updateWorkerLayers(['second', 'third']);
    });
});

test('Style#_resolve', (t) => {
    t.test('creates StyleLayers', (t) => {
        const style = new Style({
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

        style.on('error', (error) => { t.error(error); });

        style.on('style.load', () => {
            t.ok(style.getLayer('fill') instanceof StyleLayer);
            t.end();
        });
    });

    t.test('handles ref layer preceding referent', (t) => {
        const style = new Style({
            "version": 8,
            "sources": {
                "foo": {
                    "type": "vector"
                }
            },
            "layers": [{
                "id": "ref",
                "ref": "referent"
            }, {
                "id": "referent",
                "source": "foo",
                "source-layer": "source-layer",
                "type": "fill",
                "layout": {"visibility": "none"}
            }]
        });

        style.on('error', (event) => { t.error(event.error); });

        style.on('style.load', () => {
            const ref = style.getLayer('ref'),
                referent = style.getLayer('referent');
            t.equal(ref.type, 'fill');
            t.deepEqual(ref.layout, referent.layout);
            t.end();
        });
    });

    t.end();
});

test('Style#addSource', (t) => {
    t.test('returns self', (t) => {
        const style = new Style(createStyleJSON()),
            source = createSource();
        style.on('style.load', () => {
            t.equal(style.addSource('source-id', source), style);
            t.end();
        });
    });

    t.test('throw before loaded', (t) => {
        const style = new Style(createStyleJSON()),
            source = createSource();
        t.throws(() => {
            style.addSource('source-id', source);
        }, Error, /load/i);
        style.on('style.load', () => {
            t.end();
        });
    });

    t.test('throw if missing source type', (t) => {
        const style = new Style(createStyleJSON()),
            source = createSource();

        delete source.type;

        style.on('style.load', () => {
            t.throws(() => {
                style.addSource('source-id', source);
            }, Error, /type/i);
            t.end();
        });
    });

    t.test('fires "data" event', (t) => {
        const style = new Style(createStyleJSON()),
            source = createSource();
        style.once('data', t.end);
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.update();
        });
    });

    t.test('throws on duplicates', (t) => {
        const style = new Style(createStyleJSON()),
            source = createSource();
        style.on('style.load', () => {
            style.addSource('source-id', source);
            t.throws(() => {
                style.addSource('source-id', source);
            }, /There is already a source with this ID/);
            t.end();
        });
    });

    t.test('emits on invalid source', (t) => {
        const style = new Style(createStyleJSON());
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
        const style = new Style(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));
        const source = createSource();

        style.on('style.load', () => {
            t.plan(4);

            style.on('error', () => { t.ok(true); });
            style.on('data', () => { t.ok(true); });
            style.on('source.load', () => { t.ok(true); });

            style.addSource('source-id', source); // Fires 'source.load' and 'data'
            style.sourceCaches['source-id'].fire('error');
            style.sourceCaches['source-id'].fire('data');
        });
    });

    t.end();
});

test('Style#removeSource', (t) => {
    t.test('returns self', (t) => {
        const style = new Style(createStyleJSON()),
            source = createSource();
        style.on('style.load', () => {
            style.addSource('source-id', source);
            t.equal(style.removeSource('source-id'), style);
            t.end();
        });
    });

    t.test('throw before loaded', (t) => {
        const style = new Style(createStyleJSON({
            "sources": {
                "source-id": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
        t.throws(() => {
            style.removeSource('source-id');
        }, Error, /load/i);
        style.on('style.load', () => {
            t.end();
        });
    });

    t.test('fires "data" event', (t) => {
        const style = new Style(createStyleJSON()),
            source = createSource();
        style.once('data', t.end);
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.removeSource('source-id');
            style.update();
        });
    });

    t.test('clears tiles', (t) => {
        const style = new Style(createStyleJSON({
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

    t.test('emits errors for an invalid style', (t) => {
        const stylesheet = createStyleJSON();
        stylesheet.version =  'INVALID';
        const style = new Style(stylesheet);
        style.on('error', (e) => {
            t.deepEqual(e.error.message, 'version: expected one of [8], INVALID found');
            t.end();
        });
    });

    t.test('throws on non-existence', (t) => {
        const style = new Style(createStyleJSON());
        style.on('style.load', () => {
            t.throws(() => {
                style.removeSource('source-id');
            }, /There is no source with this ID/);
            t.end();
        });
    });

    t.test('tears down source event forwarding', (t) => {
        const style = new Style(createStyleJSON());
        let source = createSource();

        style.on('style.load', () => {
            style.addSource('source-id', source);
            source = style.sourceCaches['source-id'];

            style.removeSource('source-id');

            // Suppress error reporting
            source.on('error', () => {});

            style.on('data', () => { t.ok(false); });
            style.on('error', () => { t.ok(false); });
            source.fire('data');
            source.fire('error');

            t.end();
        });
    });

    t.end();
});

test('Style#addLayer', (t) => {
    t.test('returns self', (t) => {
        const style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('style.load', () => {
            t.equal(style.addLayer(layer), style);
            t.end();
        });
    });

    t.test('throw before loaded', (t) => {
        const style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};
        t.throws(() => {
            style.addLayer(layer);
        }, Error, /load/i);
        style.on('style.load', () => {
            t.end();
        });
    });

    t.test('sets up layer event forwarding', (t) => {
        const style = new Style(createStyleJSON());

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
            style._layers.background.fire('error', {mapbox: true});
        });
    });

    t.test('throws on non-existant vector source layer', (t) => {
        const style = new Style(createStyleJSON({
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
        const style = new Style(createStyleJSON());
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

    t.test('reloads source', (t) => {
        const style = new Style(util.extend(createStyleJSON(), {
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

        style.on('style.load', () => {
            style.sourceCaches['mapbox'].reload = t.end;

            style.addLayer(layer);
            style.update();
        });
    });

    t.test('fires "data" event', (t) => {
        const style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', () => {
            style.addLayer(layer);
            style.update();
        });
    });

    t.test('emits error on duplicates', (t) => {
        const style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('error', (e) => {
            t.deepEqual(e.layer, {id: 'background'});
            t.notOk(/duplicate/.match(e.error.message));
            t.end();
        });

        style.on('style.load', () => {
            style.addLayer(layer);
            style.addLayer(layer);
            t.end();
        });
    });

    t.test('adds to the end by default', (t) => {
        const style = new Style(createStyleJSON({
                layers: [{
                    id: 'a',
                    type: 'background'
                }, {
                    id: 'b',
                    type: 'background'
                }]
            })),
            layer = {id: 'c', type: 'background'};

        style.on('style.load', () => {
            style.addLayer(layer);
            t.deepEqual(style._order, ['a', 'b', 'c']);
            t.end();
        });
    });

    t.test('adds before the given layer', (t) => {
        const style = new Style(createStyleJSON({
                layers: [{
                    id: 'a',
                    type: 'background'
                }, {
                    id: 'b',
                    type: 'background'
                }]
            })),
            layer = {id: 'c', type: 'background'};

        style.on('style.load', () => {
            style.addLayer(layer, 'a');
            t.deepEqual(style._order, ['c', 'a', 'b']);
            t.end();
        });
    });

    t.end();
});

test('Style#removeLayer', (t) => {
    t.test('returns self', (t) => {
        const style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('style.load', () => {
            style.addLayer(layer);
            t.equal(style.removeLayer('background'), style);
            t.end();
        });
    });

    t.test('throw before loaded', (t) => {
        const style = new Style(createStyleJSON({
            "layers": [{id: 'background', type: 'background'}]
        }));
        t.throws(() => {
            style.removeLayer('background');
        }, Error, /load/i);
        style.on('style.load', () => {
            t.end();
        });
    });

    t.test('fires "data" event', (t) => {
        const style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', () => {
            style.addLayer(layer);
            style.removeLayer('background');
            style.update();
        });
    });

    t.test('tears down layer event forwarding', (t) => {
        const style = new Style(createStyleJSON({
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

            layer.fire('error', {mapbox: true});
            t.end();
        });
    });

    t.test('throws on non-existence', (t) => {
        const style = new Style(createStyleJSON());

        style.on('style.load', () => {
            t.throws(() => {
                style.removeLayer('background');
            }, /There is no layer with this ID/);
            t.end();
        });
    });

    t.test('removes from the order', (t) => {
        const style = new Style(createStyleJSON({
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

    t.test('removes referring layers', (t) => {
        const style = new Style(createStyleJSON({
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
            t.deepEqual(style.getLayer('a'), undefined);
            t.deepEqual(style.getLayer('b'), undefined);
            t.end();
        });
    });

    t.end();
});

test('Style#setFilter', (t) => {
    function createStyle() {
        return new Style({
            version: 8,
            sources: {
                geojson: createGeoJSONSource()
            },
            layers: [
                { id: 'symbol', type: 'symbol', source: 'geojson', filter: ['==', 'id', 0] },
                { id: 'symbol-child', ref: 'symbol' }
            ]
        });
    }

    t.test('sets filter', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'updateLayers');
                t.deepEqual(value[0].id, 'symbol');
                t.deepEqual(value[0].filter, ['==', 'id', 1]);
                t.end();
            };

            style.setFilter('symbol', ['==', 'id', 1]);
            t.deepEqual(style.getFilter('symbol'), ['==', 'id', 1]);
            style.update({}, {}); // trigger dispatcher broadcast
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
            style.update({}, {}); // flush pending operations

            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'updateLayers');
                t.deepEqual(value[0].id, 'symbol');
                t.deepEqual(value[0].filter, ['==', 'id', 2]);
                t.end();
            };
            filter[2] = 2;
            style.setFilter('symbol', filter);
            style.update({}, {}); // trigger dispatcher broadcast
        });
    });

    t.test('sets filter on parent', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'updateLayers');
                t.deepEqual(value.map((layer) => { return layer.id; }), ['symbol']);
            };

            style.setFilter('symbol-child', ['==', 'id', 1]);
            t.deepEqual(style.getFilter('symbol'), ['==', 'id', 1]);
            t.deepEqual(style.getFilter('symbol-child'), ['==', 'id', 1]);
            t.end();
        });
    });

    t.test('throws if style is not loaded', (t) => {
        const style = createStyle();

        t.throws(() => {
            style.setFilter('symbol', ['==', 'id', 1]);
        }, Error, /load/i);

        t.end();
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

    t.end();
});

test('Style#setLayerZoomRange', (t) => {
    function createStyle() {
        return new Style({
            "version": 8,
            "sources": {
                "geojson": createGeoJSONSource()
            },
            "layers": [{
                "id": "symbol",
                "type": "symbol",
                "source": "geojson"
            }, {
                "id": "symbol-child",
                "ref": "symbol"
            }]
        });
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

    t.test('sets zoom range on parent layer', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'updateLayers');
                t.deepEqual(value.map((layer) => { return layer.id; }), ['symbol']);
            };

            style.setLayerZoomRange('symbol-child', 5, 12);
            t.equal(style.getLayer('symbol').minzoom, 5, 'set minzoom');
            t.equal(style.getLayer('symbol').maxzoom, 12, 'set maxzoom');
            t.end();
        });
    });

    t.test('throw before loaded', (t) => {
        const style = createStyle();
        t.throws(() => {
            style.setLayerZoomRange('symbol', 5, 12);
        }, Error, /load/i);
        style.on('style.load', () => {
            t.end();
        });
    });

    t.end();
});

test('Style#queryRenderedFeatures', (t) => {
    let style; // eslint-disable-line prefer-const
    const Style = proxyquire('../../../js/style/style', {
        '../source/query_features': {
            rendered: function(source, layers, queryGeom, params) {
                if (source.id !== 'mapbox') {
                    return [];
                }

                const features = {
                    'land': [{
                        type: 'Feature',
                        layer: style._layers.land,
                        geometry: {
                            type: 'Polygon'
                        }
                    }, {
                        type: 'Feature',
                        layer: style._layers.land,
                        geometry: {
                            type: 'Point'
                        }
                    }],
                    'landref': [{
                        type: 'Feature',
                        layer: style._layers.landref,
                        geometry: {
                            type: 'Line'
                        }
                    }]
                };

                if (params.layers) {
                    for (const l in features) {
                        if (params.layers.indexOf(l) < 0) {
                            delete features[l];
                        }
                    }
                }

                return features;
            }
        }
    });

    style = new Style({
        "version": 8,
        "sources": {
            "mapbox": {
                "type": "vector",
                "tiles": ["local://tiles/{z}-{x}-{y}.vector.pbf"]
            },
            "other": {
                "type": "vector",
                "tiles": ["local://tiles/{z}-{x}-{y}.vector.pbf"]
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
        style._applyClasses([]);
        style._recalculate(0);

        t.test('returns feature type', (t) => {
            const results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);
            t.equal(results[0].geometry.type, 'Line');
            t.end();
        });

        t.test('filters by `layers` option', (t) => {
            const results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layers: ['land']}, 0, 0);
            t.equal(results.length, 2);
            t.end();
        });

        t.test('includes layout properties', (t) => {
            const results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);
            const layout = results[0].layer.layout;
            t.deepEqual(layout['line-cap'], 'round');
            t.end();
        });

        t.test('includes paint properties', (t) => {
            const results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);
            t.deepEqual(results[2].layer.paint['line-color'], [1, 0, 0, 1]);
            t.end();
        });

        t.test('ref layer inherits properties', (t) => {
            const results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);
            const layer = results[1].layer;
            const refLayer = results[0].layer;
            t.deepEqual(layer.layout, refLayer.layout);
            t.deepEqual(layer.type, refLayer.type);
            t.deepEqual(layer.id, refLayer.ref);
            t.notEqual(layer.paint, refLayer.paint);
            t.end();
        });

        t.test('includes metadata', (t) => {
            const results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);

            const layer = results[1].layer;
            t.equal(layer.metadata.something, 'else');

            t.end();
        });

        t.test('include multiple layers', (t) => {
            const results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layers: ['land', 'landref']}, 0, 0);
            t.equals(results.length, 3);
            t.end();
        });

        t.test('does not query sources not implicated by `layers` parameter', (t) => {
            style.sourceCaches.mapbox.queryRenderedFeatures = function() { t.fail(); };
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layers: ['land--other']});
            t.end();
        });

        t.test('fires an error if layer included in params does not exist on the style', (t) => {
            let errors = 0;
            t.stub(style, 'fire', (type, data) => {
                if (data.error && data.error.includes('does not exist in the map\'s style and cannot be queried for features.')) errors++;
            });
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layers:['merp']});
            t.equals(errors, 1);
            t.end();
        });

        t.end();
    });
});

test('Style defers expensive methods', (t) => {
    const style = new Style(createStyleJSON({
        "sources": {
            "streets": createGeoJSONSource(),
            "terrain": createGeoJSONSource()
        }
    }));

    style.on('style.load', () => {
        style.update();

        // spies to track defered methods
        t.spy(style, 'fire');
        t.spy(style, '_reloadSource');
        t.spy(style, '_updateWorkerLayers');
        t.spy(style, '_groupLayers');

        style.addLayer({ id: 'first', type: 'symbol', source: 'streets' });
        style.addLayer({ id: 'second', type: 'symbol', source: 'streets' });
        style.addLayer({ id: 'third', type: 'symbol', source: 'terrain' });

        style.setPaintProperty('first', 'text-color', 'black');
        style.setPaintProperty('first', 'text-halo-color', 'white');

        t.notOk(style.fire.called, 'fire is deferred');
        t.notOk(style._reloadSource.called, '_reloadSource is deferred');
        t.notOk(style._updateWorkerLayers.called, '_updateWorkerLayers is deferred');
        t.notOk(style._groupLayers.called, '_groupLayers is deferred');

        style.update();

        t.ok(style.fire.calledWith('data'), 'a data event was fired');

        // called per source
        t.ok(style._reloadSource.calledTwice, '_reloadSource is called per source');
        t.ok(style._reloadSource.calledWith('streets'), '_reloadSource is called for streets');
        t.ok(style._reloadSource.calledWith('terrain'), '_reloadSource is called for terrain');

        // called once
        t.ok(style._updateWorkerLayers.calledOnce, '_updateWorkerLayers is called once');
        t.ok(style._groupLayers.calledOnce, '_groupLayers is called once');

        t.end();
    });
});

test('Style updates source to switch fill[-extrusion] bucket types', (t) => {
    // Runtime switching between non-extruded and extruded fills requires
    // switching bucket types, so setPaintProperty in this case should trigger
    // a worker roundtrip (as also happens when setting property functions)

    const style = new Style(createStyleJSON({
        "sources": {
            "streets": createGeoJSONSource(),
            "terrain": createGeoJSONSource()
        }
    }));

    style.on('style.load', () => {
        style.addLayer({ id: 'fill', type: 'fill', source: 'streets', paint: {}});
        style.update();

        t.notOk(style._updates.sources.streets);

        style.setPaintProperty('fill', 'fill-color', 'green');
        t.notOk(style._updates.sources.streets);

        style.setPaintProperty('fill', 'fill-extrude-height', 10);
        t.ok(style._updates.sources.streets);

        t.end();
    });
});

test('Style#query*Features', (t) => {

    // These tests only cover filter validation. Most tests for these methods
    // live in mapbox-gl-test-suite.

    let style;
    let onError;

    t.beforeEach((callback) => {
        style = new Style({
            "version": 8,
            "sources": {
                "geojson": createGeoJSONSource()
            },
            "layers": [{
                "id": "symbol",
                "type": "symbol",
                "source": "geojson"
            }, {
                "id": "symbol-child",
                "ref": "symbol"
            }]
        });

        onError = t.spy();

        style.on('error', onError)
            .on('style.load', () => {
                callback();
            });
    });

    t.test('querySourceFeatures emits an error on incorrect filter', (t) => {
        t.deepEqual(style.querySourceFeatures([10, 100], {filter: 7}), []);
        t.match(onError.args[0][0].error.message, /querySourceFeatures\.filter/);
        t.end();
    });

    t.test('queryRenderedFeatures emits an error on incorrect filter', (t) => {
        t.deepEqual(style.queryRenderedFeatures([10, 100], {filter: 7}), []);
        t.match(onError.args[0][0].error.message, /queryRenderedFeatures\.filter/);
        t.end();
    });

    t.end();
});

test('Style#addSourceType', (t) => {
    const _types = { 'existing': function () {} };
    const Style = proxyquire('../../../js/style/style', {
        '../source/source': {
            getType: function (name) { return _types[name]; },
            setType: function (name, create) { _types[name] = create; }
        }
    });

    t.test('adds factory function', (t) => {
        const style = new Style(createStyleJSON());
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
        const style = new Style(createStyleJSON());
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
        const style = new Style(createStyleJSON());
        style.addSourceType('existing', () => {}, (err) => {
            t.ok(err);
            t.end();
        });
    });

    t.end();
});
