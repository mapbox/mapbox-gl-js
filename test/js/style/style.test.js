'use strict';

var test = require('prova');
var st = require('st');
var http = require('http');
var path = require('path');
var Style = require('../../../js/style/style');
var VectorTileSource = require('../../../js/source/vector_tile_source');
var LayoutProperties = require('../../../js/style/layout_properties');
var PaintProperties = require('../../../js/style/paint_properties');
var StyleLayer = require('../../../js/style/style_layer');
var util = require('../../../js/util/util');

function createStyleJSON(properties) {
    return util.extend({
        "version": 7,
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

    t.test('after', function(t) {
        server.close(t.end);
    });
});

test('Style#_resolve', function(t) {
    t.test('creates StyleLayers', function(t) {
        var style = new Style({
            "version": 7,
            "sources": {
                "foo": {
                    "type": "vector"
                }
            },
            "layers": [{
                id: "fill",
                source: "foo",
                type: "fill"
            }]
        });

        style.on('load', function() {
            t.ok(style.getLayer('fill') instanceof StyleLayer);
            t.end();
        });
    });

    t.test('handles ref layer preceding referent', function(t) {
        var style = new Style({
            "version": 7,
            "sources": {
                "foo": {
                    "type": "vector"
                }
            },
            "layers": [{
                id: "ref",
                ref: "referent"
            }, {
                id: "referent",
                source: "foo",
                type: "fill"
            }]
        });

        style.on('load', function() {
            var ref = style.getLayer('ref'),
                referent = style.getLayer('referent');
            t.equal(ref.type, 'fill');
            t.equal(ref.layout, referent.layout);
            t.end();
        });
    });
});

test('Style#addSource', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        t.equal(style.addSource('source-id', source), style);
        t.end();
    });

    t.test('fires source.add', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('source.add', function(e) {
            t.equal(e.source, source);
            t.end();
        });
        style.addSource('source-id', source);
    });

    t.test('throws on duplicates', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.addSource('source-id', source);
        t.throws(function() {
            style.addSource('source-id', source);
        }, /There is already a source with this ID/);
        t.end();
    });

    t.test('sets up source event forwarding', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();

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

test('Style#removeSource', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.addSource('source-id', source);
        t.equal(style.removeSource('source-id'), style);
        t.end();
    });

    t.test('fires source.remove', function(t) {
        var style = new Style(createStyleJSON()),
            source = createSource();
        style.on('source.remove', function(e) {
            t.equal(e.source, source);
            t.end();
        });
        style.addSource('source-id', source);
        style.removeSource('source-id');
    });

    t.test('throws on non-existence', function(t) {
        var style = new Style(createStyleJSON());
        t.throws(function() {
            style.removeSource('source-id');
        }, /There is no source with this ID/);
        t.end();
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

test('Style#addLayer', function(t) {
    t.test('returns self', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('load', function() {
            t.equal(style.addLayer(layer), style);
            t.end();
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

    t.test('throws on duplicates', function(t) {
        var style = new Style(createStyleJSON()),
            layer = {id: 'background', type: 'background'};

        style.on('load', function() {
            style.addLayer(layer);
            t.throws(function () {
                style.addLayer(layer);
            }, /There is already a layer with this ID/);
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
});

test('Style#setFilter', function(t) {
    t.test('sets a layer filter', function(t) {
        var style = new Style({
            "version": 7,
            "sources": {
                "geojson": {
                    "type": "geojson",
                    "data": {
                        "type": "FeatureCollection",
                        "features": []
                    }
                }
            },
            "layers": [{
                "id": "symbol",
                "type": "symbol",
                "source": "geojson",
                "filter": ["==", "id", 0]
            }]
        });

        style.on('load', function() {
            style.setFilter('symbol', ["==", "id", 1]);
            t.deepEqual(style.getFilter('symbol'), ["==", "id", 1]);
            t.end();
        });
    });
});

test('Style#setLayoutProperty', function(t) {
    t.test('sets property', function(t) {
        var style = new Style({
            "version": 7,
            "sources": {
                "geojson": {
                    "type": "geojson",
                    "data": {
                        "type": "FeatureCollection",
                        "features": []
                    }
                }
            },
            "layers": [{
                "id": "symbol",
                "type": "symbol",
                "source": "geojson",
                "layout": {
                    "text-transform": "uppercase"
                }
            }]
        });

        style.on('load', function() {
            style.setLayoutProperty('symbol', 'text-transform', 'lowercase');
            t.deepEqual(style.getLayoutProperty('symbol', 'text-transform'), 'lowercase');
            t.end();
        });
    });
});

test('Style#setPaintProperty', function(t) {
    t.test('sets property', function(t) {
        var style = new Style({
            "version": 7,
            "sources": {
                "foo": {
                    "type": "vector"
                }
            },
            "layers": [{
                "id": "background",
                "source": "foo",
                "type": "background"
            }]
        });

        style.on('load', function() {
            style.setPaintProperty('background', 'background-color', 'red');
            t.deepEqual(style.getPaintProperty('background', 'background-color'), [1, 0, 0, 1]);
            t.end();
        });
    });
});

test('Style#featuresAt - race condition', function(t) {
    var style = new Style({
        "version": 7,
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

        style.sources.mapbox.featuresAt = function(position, params, callback) {
            var features = [{
                type: 'Feature',
                layer: 'land',
                geometry: { type: 'Polygon' }
            }];

            setTimeout(function() {
                callback(null, features);
            }, 10);
        };

        t.test('featuresAt race condition', function(t) {
            style.featuresAt([256, 256], {}, function(err, results) {
                t.error(err);
                t.equal(results.length, 0);
                t.end();
            });
            style.removeLayer('land');
        });
    });
});

test('Style#featuresAt', function(t) {
    var style = new Style({
        "version": 7,
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

        style.sources.mapbox.featuresAt = function(position, params, callback) {
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
                    return f.layer === params.layer.id;
                });
            }

            setTimeout(function() {
                callback(null, features);
            }, 10);
        };

        t.test('returns feature type', function(t) {
            style.featuresAt([256, 256], {}, function(err, results) {
                t.error(err);
                t.equal(results[0].geometry.type, 'Polygon');
                t.end();
            });
        });

        t.test('filters by `layer` option', function(t) {
            style.featuresAt([256, 256], {layer: 'land'}, function(err, results) {
                t.error(err);
                t.equal(results.length, 2);
                t.end();
            });
        });

        t.test('includes layout properties', function(t) {
            style.featuresAt([256, 256], {}, function(err, results) {
                t.error(err);

                var layout = results[0].layer.layout;
                t.deepEqual(layout, {'line-cap': 'round'});
                t.deepEqual(
                    Object.getPrototypeOf(layout),
                    LayoutProperties.line.prototype);

                t.end();
            });
        });

        t.test('includes paint properties', function(t) {
            style.featuresAt([256, 256], {}, function(err, results) {
                t.error(err);

                var paint = results[0].layer.paint;
                t.deepEqual(paint, {'line-color': [ 1, 0, 0, 1 ]});
                t.deepEqual(
                    Object.getPrototypeOf(paint),
                    PaintProperties.line.prototype);

                t.end();
            });
        });

        t.test('ref layer inherits properties', function(t) {
            style.featuresAt([256, 256], {}, function(err, results) {
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

        t.test('includes arbitrary keys', function(t) {
            style.featuresAt([256, 256], {}, function(err, results) {
                t.error(err);

                var layer = results[0].layer;
                t.equal(layer.something, 'else');

                t.end();
            });
        });

        t.end();
    });
});
