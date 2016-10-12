'use strict';

var test = require('tap').test;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var Style = require('../../../js/style/style');
var SourceCache = require('../../../js/source/source_cache');
var StyleLayer = require('../../../js/style/style_layer');
var util = require('../../../js/util/util');
var Evented = require('../../../js/util/evented');
var window = require('../../../js/util/window');

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

test('Style', function(t) {
    t.afterEach(function(callback) {
        window.restore();
        callback();
    });

    t.test('can be constructed from JSON', function(t) {
        var style = new Style(createStyleJSON());
        t.ok(style);
        t.end();
    });

    t.test('fires "dataloading"', function(t) {
        var eventedParent = Object.create(Evented);
        eventedParent.on('dataloading', t.end);
        new Style(createStyleJSON(), eventedParent);
    });

    t.test('can be constructed from a URL', function(t) {
        window.useFakeXMLHttpRequest();
        window.server.respondWith('/style.json', JSON.stringify(require('../../fixtures/style')));
        var style = new Style('/style.json');
        style.on('style.load', function() {
            window.restore();
            t.end();
        });
        window.server.respond();
    });

    t.test('creates sources', function(t) {
        var style = new Style(util.extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
        style.on('style.load', function() {
            t.ok(style.sourceCaches['mapbox'] instanceof SourceCache);
            t.end();
        });
    });

    t.test('validates the style by default', function(t) {
        var style = new Style(createStyleJSON({version: 'invalid'}));

        style.on('error', function(event) {
            t.ok(event.error);
            t.match(event.error.message, /version/);
            t.end();
        });
    });

    t.test('skips validation for mapbox:// styles', function(t) {
        var Style = proxyquire('../../../js/style/style', {
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
            .on('error', function() {
                t.fail();
            })
            .on('style.load', function() {
                window.restore();
                t.end();
            });

        window.server.respondWith('mapbox://styles/test/test', JSON.stringify(createStyleJSON({version: 'invalid'})));
        window.server.respond();
    });

    t.test('emits an error on non-existant vector source layer', function(t) {
        var style = new Style(createStyleJSON({
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

        style.on('style.load', function() {
            style.removeSource('-source-id-');

            var source = createSource();
            source['vector_layers'] = [{ id: 'green' }];
            style.addSource('-source-id-', source);
            style.update();
        });

        style.on('error', function(event) {
            var err = event.error;

            t.ok(err);
            t.ok(err.toString().indexOf('-source-layer-') !== -1);
            t.ok(err.toString().indexOf('-source-id-') !== -1);
            t.ok(err.toString().indexOf('-layer-id-') !== -1);

            t.end();
        });
    });

    t.test('sets up layer event forwarding', function(t) {
        var style = new Style(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', function(e) {
            t.deepEqual(e.layer, {id: 'background'});
            t.ok(e.mapbox);
            t.end();
        });

        style.on('style.load', function() {
            style._layers.background.fire('error', {mapbox: true});
        });
    });

    t.end();
});

test('Style#_remove', function(t) {

    t.test('clears tiles', function(t) {
        var style = new Style(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', function () {
            var sourceCache = style.sourceCaches['source-id'];
            sinon.spy(sourceCache, 'clearTiles');
            style._remove();
            t.ok(sourceCache.clearTiles.calledOnce);
            t.end();
        });
    });

    t.end();

});

test('Style#_updateWorkerLayers', function(t) {
    var style = new Style({
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

    style.on('error', function(error) { t.error(error); });

    style.on('style.load', function() {
        style.addLayer({id: 'first', source: 'source', type: 'fill', 'source-layer': 'source-layer' }, 'second');
        style.addLayer({id: 'third', source: 'source', type: 'fill', 'source-layer': 'source-layer' });

        style.dispatcher.broadcast = function(key, value) {
            t.equal(key, 'set layers');
            t.deepEqual(value.map(function(layer) { return layer.id; }), ['first', 'second', 'third']);
            t.end();
        };

        style._updateWorkerLayers();
    });
});

test('Style#_updateWorkerLayers with specific ids', function(t) {
    var style = new Style({
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

    style.on('error', function(error) { t.error(error); });

    style.on('style.load', function() {
        style.dispatcher.broadcast = function(key, value) {
            t.equal(key, 'update layers');
            t.deepEqual(value.map(function(layer) { return layer.id; }), ['second', 'third']);
            t.end();
        };

        style._updateWorkerLayers(['second', 'third']);
    });
});

test('Style#_resolve', function(t) {
    t.test('creates StyleLayers', function(t) {
        var style = new Style({
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

        style.on('error', function(error) { t.error(error); });

        style.on('style.load', function() {
            t.ok(style.getLayer('fill') instanceof StyleLayer);
            t.end();
        });
    });

    t.test('handles ref layer preceding referent', function(t) {
        var style = new Style({
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

        style.on('error', function(event) { t.error(event.error); });

        style.on('style.load', function() {
            var ref = style.getLayer('ref'),
                referent = style.getLayer('referent');
            t.equal(ref.type, 'fill');
            t.deepEqual(ref.layout, referent.layout);
            t.end();
        });
    });

    t.end();
});

test('Style#addSource', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('style.load', function () {
            t.equal(style.addSource('source-id', source), style);
            t.end();
        });
    });

    t.test('throw before loaded', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        t.throws(function () {
            style.addSource('source-id', source);
        }, Error, /load/i);
        style.on('style.load', function() {
            t.end();
        });
    });

    t.test('throw if missing source type', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();

        delete source.type;

        style.on('style.load', function() {
            t.throws(function () {
                style.addSource('source-id', source);
            }, Error, /type/i);
            t.end();
        });
    });

    t.test('fires "data" event', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.once('data', t.end);
        style.on('style.load', function () {
            style.addSource('source-id', source);
            style.update();
        });
    });

    t.test('throws on duplicates', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('style.load', function () {
            style.addSource('source-id', source);
            t.throws(function() {
                style.addSource('source-id', source);
            }, /There is already a source with this ID/);
            t.end();
        });
    });

    t.test('emits on invalid source', function(t) {
        var style = new Style(createStyleJSON());
        style.on('style.load', function() {
            style.on('error', function() {
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

    t.test('sets up source event forwarding', function(t) {
        var style = new Style(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));
        var source = createSource();

        style.on('style.load', function () {
            t.plan(4);

            style.on('error', function() { t.ok(true); });
            style.on('data', function() { t.ok(true); });
            style.on('source.load', function() { t.ok(true); });

            style.addSource('source-id', source); // Fires 'source.load' and 'data'
            style.sourceCaches['source-id'].fire('error');
            style.sourceCaches['source-id'].fire('data');
        });
    });

    t.end();
});

test('Style#removeSource', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('style.load', function () {
            style.addSource('source-id', source);
            t.equal(style.removeSource('source-id'), style);
            t.end();
        });
    });

    t.test('throw before loaded', function(t) {
        var style = new Style(createStyleJSON({
            "sources": {
                "source-id": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
        t.throws(function () {
            style.removeSource('source-id');
        }, Error, /load/i);
        style.on('style.load', function() {
            t.end();
        });
    });

    t.test('fires "data" event', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.once('data', t.end);
        style.on('style.load', function () {
            style.addSource('source-id', source);
            style.removeSource('source-id');
            style.update();
        });
    });

    t.test('clears tiles', function(t) {
        var style = new Style(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', function () {
            var sourceCache = style.sourceCaches['source-id'];
            sinon.spy(sourceCache, 'clearTiles');
            style.removeSource('source-id');
            t.ok(sourceCache.clearTiles.calledOnce);
            t.end();
        });
    });

    t.test('emits errors for an invalid style', function(t) {
        var stylesheet = createStyleJSON();
        stylesheet.version =  'INVALID';
        var style = new Style(stylesheet);
        style.on('error', function (e) {
            t.deepEqual(e.error.message, 'version: expected one of [8], INVALID found');
            t.end();
        });
    });

    t.test('throws on non-existence', function(t) {
        var style = new Style(createStyleJSON());
        style.on('style.load', function () {
            t.throws(function() {
                style.removeSource('source-id');
            }, /There is no source with this ID/);
            t.end();
        });
    });

    t.test('tears down source event forwarding', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();

        style.on('style.load', function () {
            style.addSource('source-id', source);
            source = style.sourceCaches['source-id'];

            style.removeSource('source-id');

            // Suppress error reporting
            source.on('error', function() {});

            style.on('data', function() { t.ok(false); });
            style.on('error', function() { t.ok(false); });
            source.fire('data');
            source.fire('error');

            t.end();
        });
    });

    t.end();
});

test('Style#addLayer', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('style.load', function() {
            t.equal(style.addLayer(layer), style);
            t.end();
        });
    });

    t.test('throw before loaded', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};
        t.throws(function () {
            style.addLayer(layer);
        }, Error, /load/i);
        style.on('style.load', function() {
            t.end();
        });
    });

    t.test('sets up layer event forwarding', function(t) {
        var style = new Style(createStyleJSON());

        style.on('error', function(e) {
            t.deepEqual(e.layer, {id: 'background'});
            t.ok(e.mapbox);
            t.end();
        });

        style.on('style.load', function() {
            style.addLayer({
                id: 'background',
                type: 'background'
            });
            style._layers.background.fire('error', {mapbox: true});
        });
    });

    t.test('throws on non-existant vector source layer', function(t) {
        var style = new Style(createStyleJSON({
            sources: {
                // At least one source must be added to trigger the load event
                dummy: { type: "vector", tiles: [] }
            }
        }));

        style.on('style.load', function() {
            var source = createSource();
            source['vector_layers'] = [{id: 'green'}];
            style.addSource('-source-id-', source);
            style.addLayer({
                'id': '-layer-id-',
                'type': 'circle',
                'source': '-source-id-',
                'source-layer': '-source-layer-'
            });
        });

        style.on('error', function(event) {
            var err = event.error;

            t.ok(err);
            t.ok(err.toString().indexOf('-source-layer-') !== -1);
            t.ok(err.toString().indexOf('-source-id-') !== -1);
            t.ok(err.toString().indexOf('-layer-id-') !== -1);

            t.end();
        });
    });

    t.test('emits error on invalid layer', function(t) {
        var style = new Style(createStyleJSON());
        style.on('style.load', function() {
            style.on('error', function() {
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

    t.test('reloads source', function(t) {
        var style = new Style(util.extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
        var layer = {
            "id": "symbol",
            "type": "symbol",
            "source": "mapbox",
            "source-layer": "boxmap",
            "filter": ["==", "id", 0]
        };

        style.on('style.load', function() {
            style.sourceCaches['mapbox'].reload = t.end;

            style.addLayer(layer);
            style.update();
        });
    });

    t.test('fires "data" event', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', function() {
            style.addLayer(layer);
            style.update();
        });
    });

    t.test('emits error on duplicates', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('error', function(e) {
            t.deepEqual(e.layer, {id: 'background'});
            t.notOk(/duplicate/.match(e.error.message));
            t.end();
        });

        style.on('style.load', function() {
            style.addLayer(layer);
            style.addLayer(layer);
            t.end();
        });
    });

    t.test('adds to the end by default', function(t) {
        var style = new Style(createStyleJSON({
                layers: [{
                    id: 'a',
                    type: 'background'
                }, {
                    id: 'b',
                    type: 'background'
                }]
            })),
            layer = {id: 'c', type: 'background'};

        style.on('style.load', function() {
            style.addLayer(layer);
            t.deepEqual(style._order, ['a', 'b', 'c']);
            t.end();
        });
    });

    t.test('adds before the given layer', function(t) {
        var style = new Style(createStyleJSON({
                layers: [{
                    id: 'a',
                    type: 'background'
                }, {
                    id: 'b',
                    type: 'background'
                }]
            })),
            layer = {id: 'c', type: 'background'};

        style.on('style.load', function() {
            style.addLayer(layer, 'a');
            t.deepEqual(style._order, ['c', 'a', 'b']);
            t.end();
        });
    });

    t.end();
});

test('Style#removeLayer', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('style.load', function() {
            style.addLayer(layer);
            t.equal(style.removeLayer('background'), style);
            t.end();
        });
    });

    t.test('throw before loaded', function(t) {
        var style = new Style(createStyleJSON({
            "layers": [{id: 'background', type: 'background'}]
        }));
        t.throws(function () {
            style.removeLayer('background');
        }, Error, /load/i);
        style.on('style.load', function() {
            t.end();
        });
    });

    t.test('fires "data" event', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', function() {
            style.addLayer(layer);
            style.removeLayer('background');
            style.update();
        });
    });

    t.test('tears down layer event forwarding', function(t) {
        var style = new Style(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', function() {
            t.fail();
        });

        style.on('style.load', function() {
            var layer = style._layers.background;
            style.removeLayer('background');

            // Bind a listener to prevent fallback Evented error reporting.
            layer.on('error', function() {});

            layer.fire('error', {mapbox: true});
            t.end();
        });
    });

    t.test('throws on non-existence', function(t) {
        var style = new Style(createStyleJSON());

        style.on('style.load', function() {
            t.throws(function () {
                style.removeLayer('background');
            }, /There is no layer with this ID/);
            t.end();
        });
    });

    t.test('removes from the order', function(t) {
        var style = new Style(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));

        style.on('style.load', function() {
            style.removeLayer('a');
            t.deepEqual(style._order, ['b']);
            t.end();
        });
    });

    t.test('removes referring layers', function(t) {
        var style = new Style(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                ref: 'a'
            }]
        }));

        style.on('style.load', function() {
            style.removeLayer('a');
            t.deepEqual(style.getLayer('a'), undefined);
            t.deepEqual(style.getLayer('b'), undefined);
            t.end();
        });
    });

    t.end();
});

test('Style#setFilter', function(t) {
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

    t.test('sets filter', function(t) {
        var style = createStyle();

        style.on('style.load', function() {
            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'update layers');
                t.deepEqual(value[0].id, 'symbol');
                t.deepEqual(value[0].filter, ['==', 'id', 1]);
                t.end();
            };

            style.setFilter('symbol', ['==', 'id', 1]);
            t.deepEqual(style.getFilter('symbol'), ['==', 'id', 1]);
            style.update({}, {}); // trigger dispatcher broadcast
        });
    });

    t.test('gets a clone of the filter', function(t) {
        var style = createStyle();

        style.on('style.load', function() {
            var filter1 = ['==', 'id', 1];
            style.setFilter('symbol', filter1);
            var filter2 = style.getFilter('symbol');
            var filter3 = style.getLayer('symbol').filter;

            t.notEqual(filter1, filter2);
            t.notEqual(filter1, filter3);
            t.notEqual(filter2, filter3);

            t.end();
        });
    });

    t.test('sets again mutated filter', function(t) {
        var style = createStyle();

        style.on('style.load', function() {
            var filter = ['==', 'id', 1];
            style.setFilter('symbol', filter);
            style.update({}, {}); // flush pending operations

            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'update layers');
                t.deepEqual(value[0].id, 'symbol');
                t.deepEqual(value[0].filter, ['==', 'id', 2]);
                t.end();
            };
            filter[2] = 2;
            style.setFilter('symbol', filter);
            style.update({}, {}); // trigger dispatcher broadcast
        });
    });

    t.test('sets filter on parent', function(t) {
        var style = createStyle();

        style.on('style.load', function() {
            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'update layers');
                t.deepEqual(value.map(function(layer) { return layer.id; }), ['symbol']);
            };

            style.setFilter('symbol-child', ['==', 'id', 1]);
            t.deepEqual(style.getFilter('symbol'), ['==', 'id', 1]);
            t.deepEqual(style.getFilter('symbol-child'), ['==', 'id', 1]);
            t.end();
        });
    });

    t.test('throws if style is not loaded', function(t) {
        var style = createStyle();

        t.throws(function () {
            style.setFilter('symbol', ['==', 'id', 1]);
        }, Error, /load/i);

        t.end();
    });

    t.test('emits if invalid', function(t) {
        var style = createStyle();
        style.on('style.load', function() {
            style.on('error', function() {
                t.deepEqual(style.getLayer('symbol').serialize().filter, ['==', 'id', 0]);
                t.end();
            });
            style.setFilter('symbol', ['==', '$type', 1]);
        });
    });

    t.end();
});

test('Style#setLayerZoomRange', function(t) {
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

    t.test('sets zoom range', function(t) {
        var style = createStyle();

        style.on('style.load', function() {
            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'update layers');
                t.deepEqual(value.map(function(layer) { return layer.id; }), ['symbol']);
            };

            style.setLayerZoomRange('symbol', 5, 12);
            t.equal(style.getLayer('symbol').minzoom, 5, 'set minzoom');
            t.equal(style.getLayer('symbol').maxzoom, 12, 'set maxzoom');
            t.end();
        });
    });

    t.test('sets zoom range on parent layer', function(t) {
        var style = createStyle();

        style.on('style.load', function() {
            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'update layers');
                t.deepEqual(value.map(function(layer) { return layer.id; }), ['symbol']);
            };

            style.setLayerZoomRange('symbol-child', 5, 12);
            t.equal(style.getLayer('symbol').minzoom, 5, 'set minzoom');
            t.equal(style.getLayer('symbol').maxzoom, 12, 'set maxzoom');
            t.end();
        });
    });

    t.test('throw before loaded', function(t) {
        var style = createStyle();
        t.throws(function () {
            style.setLayerZoomRange('symbol', 5, 12);
        }, Error, /load/i);
        style.on('style.load', function() {
            t.end();
        });
    });

    t.end();
});

test('Style#queryRenderedFeatures', function(t) {
    var style;
    var Style = proxyquire('../../../js/style/style', {
        '../source/query_features': {
            rendered: function(source, layers, queryGeom, params) {
                if (source.id !== 'mapbox') {
                    return [];
                }

                var features = {
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
                    for (var l in features) {
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

    style.on('style.load', function() {
        style._applyClasses([]);
        style._recalculate(0);

        t.test('returns feature type', function(t) {
            var results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);
            t.equal(results[0].geometry.type, 'Line');
            t.end();
        });

        t.test('filters by `layers` option', function(t) {
            var results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layers: ['land']}, 0, 0);
            t.equal(results.length, 2);
            t.end();
        });

        t.test('includes layout properties', function(t) {
            var results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);
            var layout = results[0].layer.layout;
            t.deepEqual(layout['line-cap'], 'round');
            t.end();
        });

        t.test('includes paint properties', function(t) {
            var results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);
            t.deepEqual(results[2].layer.paint['line-color'], [1, 0, 0, 1]);
            t.end();
        });

        t.test('ref layer inherits properties', function(t) {
            var results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);
            var layer = results[1].layer;
            var refLayer = results[0].layer;
            t.deepEqual(layer.layout, refLayer.layout);
            t.deepEqual(layer.type, refLayer.type);
            t.deepEqual(layer.id, refLayer.ref);
            t.notEqual(layer.paint, refLayer.paint);
            t.end();
        });

        t.test('includes metadata', function(t) {
            var results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, 0, 0);

            var layer = results[1].layer;
            t.equal(layer.metadata.something, 'else');

            t.end();
        });

        t.test('include multiple layers', function(t) {
            var results = style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layers: ['land', 'landref']}, 0, 0);
            t.equals(results.length, 3);
            t.end();
        });

        t.test('does not query sources not implicated by `layers` parameter', function (t) {
            style.sourceCaches.mapbox.queryRenderedFeatures = function() { t.fail(); };
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layers: ['land--other']});
            t.end();
        });

        t.test('fires an error if layer included in params does not exist on the style', function(t) {
            var errors = 0;
            sinon.stub(style, 'fire', function(type, data) {
                if (data.error && data.error.includes('does not exist in the map\'s style and cannot be queried for features.')) errors++;
            });
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layers:['merp']});
            t.equals(errors, 1);
            t.end();
        });

        t.end();
    });
});

test('Style defers expensive methods', function(t) {
    var style = new Style(createStyleJSON({
        "sources": {
            "streets": createGeoJSONSource(),
            "terrain": createGeoJSONSource()
        }
    }));

    style.on('style.load', function() {
        style.update();

        // spies to track defered methods
        sinon.spy(style, 'fire');
        sinon.spy(style, '_reloadSource');
        sinon.spy(style, '_updateWorkerLayers');
        sinon.spy(style, '_groupLayers');

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

test('Style#query*Features', function(t) {

    // These tests only cover filter validation. Most tests for these methods
    // live in mapbox-gl-test-suite.

    var style;
    var onError;

    t.beforeEach(function (callback) {
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

        onError = sinon.spy();

        style.on('error', onError)
            .on('style.load', function() {
                callback();
            });
    });

    t.test('querySourceFeatures emits an error on incorrect filter', function(t) {
        t.deepEqual(style.querySourceFeatures([10, 100], {filter: 7}), []);
        t.match(onError.args[0][0].error.message, /querySourceFeatures\.filter/);
        t.end();
    });

    t.test('queryRenderedFeatures emits an error on incorrect filter', function(t) {
        t.deepEqual(style.queryRenderedFeatures([10, 100], {filter: 7}), []);
        t.match(onError.args[0][0].error.message, /queryRenderedFeatures\.filter/);
        t.end();
    });

    t.end();
});

test('Style#addSourceType', function (t) {
    var _types = { 'existing': function () {} };
    var Style = proxyquire('../../../js/style/style', {
        '../source/source': {
            getType: function (name) { return _types[name]; },
            setType: function (name, create) { _types[name] = create; }
        }
    });

    t.test('adds factory function', function (t) {
        var style = new Style(createStyleJSON());
        var SourceType = function () {};

        // expect no call to load worker source
        style.dispatcher.broadcast = function (type) {
            if (type === 'load worker source') {
                t.fail();
            }
        };

        style.addSourceType('foo', SourceType, function () {
            t.equal(_types['foo'], SourceType);
            t.end();
        });
    });

    t.test('triggers workers to load worker source code', function (t) {
        var style = new Style(createStyleJSON());
        var SourceType = function () {};
        SourceType.workerSourceURL = 'worker-source.js';

        style.dispatcher.broadcast = function (type, params) {
            if (type === 'load worker source') {
                t.equal(_types['bar'], SourceType);
                t.equal(params.name, 'bar');
                t.equal(params.url, 'worker-source.js');
                t.end();
            }
        };

        style.addSourceType('bar', SourceType, function (err) { t.error(err); });
    });

    t.test('refuses to add new type over existing name', function (t) {
        var style = new Style(createStyleJSON());
        style.addSourceType('existing', function () {}, function (err) {
            t.ok(err);
            t.end();
        });
    });

    t.end();
});
