'use strict';

var test = require('tap').test;
var st = require('st');
var http = require('http');
var path = require('path');
var sinon = require('sinon');
var Style = require('../../../js/style/style');
var VectorTileSource = require('../../../js/source/vector_tile_source');
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
    return new VectorTileSource({
        type: 'vector',
        minzoom: 1,
        maxzoom: 10,
        attribution: 'Mapbox',
        tiles: ['http://example.com/{z}/{x}/{y}.png']
    });
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
            t.ok(style.getSource('mapbox') instanceof VectorTileSource);
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
            style.addSource('-source-id-', source);
            source.vectorLayerIds = ['green'];
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

test('Style#_broadcastLayers', function(t) {
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

        style._broadcastLayers();
    });
});

test('Style#_broadcastLayers with specific ids', function(t) {
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

        style._broadcastLayers(['second', 'third']);
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

    t.test('fires source.add', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('source.add', function(e) {
            t.equal(e.source, source);
            t.end();
        });
        style.on('load', function () {
            style.addSource('source-id', source);
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
                t.notOk(style.getSource('source-id'));
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
            t.equal(e.source, source);
        }

        function tileEvent(e) {
            t.equal(e.source, source);
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
            source.fire('error');
            source.fire('change');
            source.fire('tile.add');
            source.fire('tile.load');
            source.fire('tile.error');
            source.fire('tile.remove');
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
            t.equal(e.source, source);
            t.end();
        });
        style.on('load', function () {
            style.addSource('source-id', source);
            style.removeSource('source-id');
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
            style.removeSource('source-id');

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
            style.addSource('-source-id-', source);
            style.addLayer({
                'id': '-layer-id-',
                'type': 'circle',
                'source': '-source-id-',
                'source-layer': '-source-layer-'
            });
            source.vectorLayerIds = ['green'];
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
            style.getSource('mapbox').reload = t.end;

            style.addLayer(layer);
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
                t.deepEqual(value.map(function(layer) { return layer.id; }), ['symbol']);
            };

            style.setFilter('symbol', ['==', 'id', 1]);
            t.deepEqual(style.getFilter('symbol'), ['==', 'id', 1]);
            t.end();
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

test('Style#queryRenderedFeatures - race condition', function(t) {
    var style = new Style({
        "version": 8,
        "sources": {
            "mapbox": {
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
            "something": "else"
        }]
    });

    style.on('load', function() {
        style._cascade([]);
        style._recalculate(0);

        style.sources.mapbox.queryRenderedFeatures = function(position, params, classes, zoom, bearing, callback) {
            var features = [{
                type: 'Feature',
                layer: 'land',
                geometry: { type: 'Polygon' }
            }];

            setTimeout(function() {
                callback(null, features);
            }, 10);
        };

        t.test('queryRenderedFeatures race condition', function(t) {
            style.queryRenderedFeatures([256, 256], {}, {}, 0, 0, function(err, results) {
                t.error(err);
                t.equal(results.length, 0);
                t.end();
            });
            style.removeLayer('land');
        });
        t.end();
    });
});

test('Style#queryRenderedFeatures', function(t) {
    var style = new Style({
        "version": 8,
        "sources": {
            "mapbox": {
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
        }]
    });

    style.on('load', function() {
        style._cascade([]);
        style._recalculate(0);

        style.sources.mapbox.queryRenderedFeatures = function(position, params, classes, zoom, bearing, callback) {
            var features = [{
                type: 'Feature',
                layer: 'land',
                geometry: {
                    type: 'Polygon'
                }
            }, {
                type: 'Feature',
                layer: 'land',
                geometry: {
                    type: 'Point'
                }
            }, {
                type: 'Feature',
                layer: 'landref',
                geometry: {
                    type: 'Point'
                }
            }];

            if (params.layer) {
                features = features.filter(function(f) {
                    return params.layerIds.indexOf(f.layer) > -1;
                });
            }

            setTimeout(function() {
                callback(null, features);
            }, 10);
        };

        t.test('returns feature type', function(t) {
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, {}, 0, 0, function(err, results) {
                t.error(err);
                t.equal(results[0].geometry.type, 'Polygon');
                t.end();
            });
        });

        t.test('filters by `layer` option', function(t) {
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layer: 'land'}, {}, 0, 0, function(err, results) {
                t.error(err);
                t.equal(results.length, 2);
                t.end();
            });
        });

        t.test('includes layout properties', function(t) {
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, {}, 0, 0, function(err, results) {
                t.error(err);
                var layout = results[0].layer.layout;
                t.deepEqual(layout['line-cap'], 'round');
                t.end();
            });
        });

        t.test('includes paint properties', function(t) {
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, {}, 0, 0, function(err, results) {
                t.error(err);
                t.deepEqual(results[0].layer.paint['line-color'], 'red');
                t.end();
            });
        });

        t.test('ref layer inherits properties', function(t) {
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, {}, 0, 0, function(err, results) {
                t.error(err);

                var layer = results[1].layer;
                var refLayer = results[2].layer;
                t.deepEqual(layer.layout, refLayer.layout);
                t.deepEqual(layer.type, refLayer.type);
                t.deepEqual(layer.id, refLayer.ref);
                t.notEqual(layer.paint, refLayer.paint);

                t.end();
            });
        });

        t.test('includes metadata', function(t) {
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {}, {}, 0, 0, function(err, results) {
                t.error(err);

                var layer = results[0].layer;
                t.equal(layer.metadata.something, 'else');

                t.end();
            });
        });

        t.test('include multiple layers', function(t) {
            style.queryRenderedFeatures([{column: 1, row: 1, zoom: 1}], {layer: ['land', 'landref']}, {}, 0, 0, function(err, results) {
                t.error(err);
                t.equals(results.length, 3);
                t.end();
            });
        });

        t.end();
    });
});

test('Style#batch', function(t) {
    t.test('defers expensive methods', function(t) {
        var style = new Style(createStyleJSON({
            "sources": {
                "streets": createGeoJSONSource(),
                "terrain": createGeoJSONSource()
            }
        }));

        style.on('load', function() {
            // spies to track defered methods
            sinon.spy(style, 'fire');
            sinon.spy(style, '_reloadSource');
            sinon.spy(style, '_broadcastLayers');
            sinon.spy(style, '_groupLayers');

            style.batch(function(s) {
                s.addLayer({ id: 'first', type: 'symbol', source: 'streets' });
                s.addLayer({ id: 'second', type: 'symbol', source: 'streets' });
                s.addLayer({ id: 'third', type: 'symbol', source: 'terrain' });

                s.setPaintProperty('first', 'text-color', 'black');
                s.setPaintProperty('first', 'text-halo-color', 'white');

                t.notOk(style.fire.called, 'fire is deferred');
                t.notOk(style._reloadSource.called, '_reloadSource is deferred');
                t.notOk(style._broadcastLayers.called, '_broadcastLayers is deferred');
                t.notOk(style._groupLayers.called, '_groupLayers is deferred');
            });

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
            t.ok(style._broadcastLayers.calledOnce, '_broadcastLayers is called once');
            t.ok(style._groupLayers.calledOnce, '_groupLayers is called once');

            t.end();
        });
    });

    t.test('throw before loaded', function(t) {
        var style = new Style(createStyleJSON());
        t.throws(function() {
            style.batch(function() {});
        }, Error, /load/i);
        style.on('load', function() {
            t.end();
        });
    });

    t.end();
});
