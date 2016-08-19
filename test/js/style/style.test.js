'use strict';

var test = require('tap').test;
var st = require('st');
var http = require('http');
var path = require('path');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var Style = require('../../../js/style/style');
var SourceCache = require('../../../js/source/source_cache');
var StyleLayer = require('../../../js/style/style_layer');
var util = require('../../../js/util/util');

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
    var server = http.createServer(st({path: path.join(__dirname, '/../../fixtures')}));

    t.test('before', function(t) {
        server.listen(2900, t.end);
    });

    t.test('can be constructed from JSON', function(t) {
        var style = new Style(createStyleJSON());
        t.ok(style);
        t.end();
    });

    t.test('can be constructed from a URL', function(t) {
        var style = new Style("http://localhost:2900/style-basic.json");
        style.on('load', function() {
            t.end();
        });
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
        style.on('load', function() {
            t.ok(style.sources['mapbox'] instanceof SourceCache);
            t.end();
        });
    });

    t.test('throws on non-existant vector source layer', function(t) {
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

        style.on('load', function() {
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

    t.test('after', function(t) {
        server.close(t.end);
    });

    t.test('sets up layer event forwarding', function(t) {
        var style = new Style(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('layer.error', function(e) {
            t.deepEqual(e.layer, {id: 'background'});
            t.ok(e.mapbox);
            t.end();
        });

        style.on('load', function() {
            style._layers.background.fire('error', {mapbox: true});
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

    style.on('load', function() {
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

    style.on('load', function() {
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

        style.on('load', function() {
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

        style.on('load', function() {
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
        style.on('load', function () {
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
        style.on('load', function() {
            t.end();
        });
    });

    t.test('throw if missing source type', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();

        delete source.type;

        style.on('load', function() {
            t.throws(function () {
                style.addSource('source-id', source);
            }, Error, /type/i);
            t.end();
        });
    });

    t.test('fires source.add', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('source.add', function(e) {
            t.same(e.source.serialize(), source);
            t.end();
        });
        style.on('load', function () {
            style.addSource('source-id', source);
            style.update();
        });
    });

    t.test('throws on duplicates', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('load', function () {
            style.addSource('source-id', source);
            t.throws(function() {
                style.addSource('source-id', source);
            }, /There is already a source with this ID/);
            t.end();
        });
    });

    t.test('emits on invalid source', function(t) {
        var style = new Style(createStyleJSON());
        style.on('load', function() {
            style.on('error', function() {
                t.notOk(style.sources['source-id']);
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

        function sourceEvent(e) {
            t.same(e.source.serialize(), source);
        }

        function tileEvent(e) {
            t.same(e.source.serialize(), source);
        }

        style.on('source.load',   sourceEvent);
        style.on('source.error',  sourceEvent);
        style.on('source.change', sourceEvent);
        style.on('tile.add',      tileEvent);
        style.on('tile.load',     tileEvent);
        style.on('tile.error',    tileEvent);
        style.on('tile.remove',   tileEvent);

        style.on('load', function () {
            t.plan(7);
            style.addSource('source-id', source); // Fires load
            style.sources['source-id'].fire('error');
            style.sources['source-id'].fire('change');
            style.sources['source-id'].fire('tile.add');
            style.sources['source-id'].fire('tile.load');
            style.sources['source-id'].fire('tile.error');
            style.sources['source-id'].fire('tile.remove');
        });
    });

    t.end();
});

test('Style#removeSource', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('load', function () {
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
        style.on('load', function() {
            t.end();
        });
    });

    t.test('fires source.remove', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('source.remove', function(e) {
            t.same(e.source.serialize(), source);
            t.end();
        });
        style.on('load', function () {
            style.addSource('source-id', source);
            style.removeSource('source-id');
            style.update();
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
        style.on('load', function () {
            t.throws(function() {
                style.removeSource('source-id');
            }, /There is no source with this ID/);
            t.end();
        });
    });

    t.test('tears down source event forwarding', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();

        style.on('source.load',   t.fail);
        style.on('source.error',  t.fail);
        style.on('source.change', t.fail);
        style.on('tile.add',      t.fail);
        style.on('tile.load',     t.fail);
        style.on('tile.error',    t.fail);
        style.on('tile.remove',   t.fail);

        style.on('load', function () {
            style.addSource('source-id', source);
            source = style.sources['source-id'];

            style.removeSource('source-id');

            // Bind a listener to prevent fallback Evented error reporting.
            source.on('error',  function() {});
            source.on('tile.error',  function() {});

            source.fire('load');
            source.fire('error');
            source.fire('change');
            source.fire('tile.add');
            source.fire('tile.load');
            source.fire('tile.error');
            source.fire('tile.remove');
            t.end();
        });
    });

    t.end();
});

test('Style#addLayer', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('load', function() {
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
        style.on('load', function() {
            t.end();
        });
    });

    t.test('sets up layer event forwarding', function(t) {
        var style = new Style(createStyleJSON());

        style.on('layer.error', function(e) {
            t.deepEqual(e.layer, {id: 'background'});
            t.ok(e.mapbox);
            t.end();
        });

        style.on('load', function() {
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

        style.on('load', function() {
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
        style.on('load', function() {
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

        style.on('load', function() {
            style.sources['mapbox'].reload = t.end;

            style.addLayer(layer);
            style.update();
        });
    });

    t.test('fires layer.add', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('layer.add', function (e) {
            t.equal(e.layer.id, 'background');
            t.end();
        });

        style.on('load', function() {
            style.addLayer(layer);
            style.update();
        });
    });

    t.test('emits error on duplicates', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('layer.error', function(e) {
            t.deepEqual(e.layer, {id: 'background'});
            t.notOk(/duplicate/.match(e.error.message));
            t.end();
        });

        style.on('load', function() {
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

        style.on('load', function() {
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

        style.on('load', function() {
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

        style.on('load', function() {
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
        style.on('load', function() {
            t.end();
        });
    });

    t.test('fires layer.remove', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('layer.remove', function(e) {
            t.equal(e.layer.id, 'background');
            t.end();
        });

        style.on('load', function() {
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

        style.on('layer.error', function() {
            t.fail();
        });

        style.on('load', function() {
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

        style.on('load', function() {
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

        style.on('load', function() {
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

        style.on('load', function() {
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

        style.on('load', function() {
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

    t.test('sets again mutated filter', function(t) {
        var style = createStyle();

        style.on('load', function() {
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

        style.on('load', function() {
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
        style.on('load', function() {
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

        style.on('load', function() {
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

        style.on('load', function() {
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
        style.on('load', function() {
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

    style.on('load', function() {
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
            style.sources.mapbox.queryRenderedFeatures = function() { t.fail(); };
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layers: ['land--other']});
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

    style.on('load', function() {
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

        // called per added layer, conflating 'change' events
        t.equal(style.fire.callCount, 4, 'fire is called per action');
        t.equal(style.fire.args[0][0], 'layer.add', 'fire was called with layer.add');
        t.equal(style.fire.args[1][0], 'layer.add', 'fire was called with layer.add');
        t.equal(style.fire.args[2][0], 'layer.add', 'fire was called with layer.add');
        t.equal(style.fire.args[3][0], 'change', 'fire was called with change');

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

    t.test('querySourceFeatures emits an error on incorrect filter', function(t) {
        var style = createStyle();
        style.on('load', function() {
            t.throws(function() {
                t.deepEqual(style.querySourceFeatures([10, 100], {filter: 7}), []);
            }, /querySourceFeatures\.filter/);
            t.end();
        });
    });

    t.test('queryRenderedFeatures emits an error on incorrect filter', function(t) {
        var style = createStyle();
        style.on('load', function() {
            t.throws(function() {
                t.deepEqual(style.queryRenderedFeatures([10, 100], {filter: 7}), []);
            }, /queryRenderedFeatures\.filter/);
            t.end();
        });
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
