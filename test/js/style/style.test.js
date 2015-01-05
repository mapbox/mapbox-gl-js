'use strict';

var test = require('tape');
var fs = require('fs');
var st = require('st');
var http = require('http');

require('../../bootstrap');

var AnimationLoop = require('../../../js/style/animation_loop');
var Style = require('../../../js/style/style');
var Source = require('../../../js/source/source');
var LayoutProperties = require('../../../js/style/layout_properties');
var PaintProperties = require('../../../js/style/paint_properties');
var util = require('../../../js/util/util');
var UPDATE = process.env.UPDATE;

function createStyleJSON() {
    return {
        "version": 6,
        "sources": {},
        "layers": []
    };
}

function createSource() {
    return new Source({
        type: 'vector',
        minzoom: 1,
        maxzoom: 10,
        attribution: 'Mapbox',
        tiles: ['http://example.com/{z}/{x}/{y}.png']
    });
}

test('Style', function(t) {
    var server = http.createServer(st({path: __dirname + '/../../fixtures'}));

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
            t.ok(style.getSource('mapbox') instanceof Source);
            t.end();
        });
    });

    t.test('after', function(t) {
        server.close(t.end);
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

test('Style#featuresAt', function(t) {
    var style = new Style({
        "version": 6,
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
            "paint": {
                "line-color": "red"
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
        style.recalculate(0);

        style.sources.mapbox.featuresAt = function(position, params, callback) {
            callback(null, [{
                $type: 'Polygon',
                layer: {
                    id: 'land',
                    type: 'line',
                    layout: {
                        'line-cap': 'round'
                    }
                }
            }, {
                $type: 'Polygon',
                layer: {
                    id: 'landref',
                    ref: 'land',
                    type: 'line',
                    layout: {
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': 'blue'
                    }
                }
            }]);
        };

        t.test('returns feature type', function(t) {
            style.featuresAt([256, 256], {}, function(err, results) {
                t.error(err);
                t.equal(results[0].$type, 'Polygon');
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

                var layer = results[0].layer;
                var refLayer = results[1].layer;
                t.deepEqual(layer.layout, refLayer.layout);
                t.deepEqual(layer.type, refLayer.type);
                t.deepEqual(layer.id, refLayer.ref);
                t.notEqual(layer.paint, refLayer.paint);

                t.end();
            });
        });

        t.end();
    });
});

test('style', function(t) {
    var style = new Style(require('../../fixtures/style-basic.json'), new AnimationLoop());
    style.on('load', function() {
        // Replace changing startTime/endTime values with singe stable value
        // for fixture comparison.
        var style_transitions = JSON.parse(JSON.stringify(style.transitions, function(key, val) {
            if (key === 'startTime' || key === 'endTime') {
                return +new Date('Tue, 17 Jun 2014 0:00:00 UTC');
            } else {
                return val;
            }
        }));
        if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/style-basic-transitions.json', JSON.stringify(style_transitions, null, 2));
        var style_transitions_expected = JSON.parse(fs.readFileSync(__dirname + '/../../expected/style-basic-transitions.json'));
        t.deepEqual(style_transitions, style_transitions_expected);

        style.recalculate(10);

        t.equal(style.hasClass('foo'), false, 'non-existent class');
        t.deepEqual(style.getClassList(), [], 'getClassList');
        t.deepEqual(style.removeClass('foo'), undefined, 'remove non-existent class');

        // layerGroups
        var style_layergroups = JSON.parse(JSON.stringify(style.layerGroups));
        if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/style-basic-layergroups.json', JSON.stringify(style_layergroups, null, 2));
        var style_layergroups_expected = JSON.parse(fs.readFileSync(__dirname + '/../../expected/style-basic-layergroups.json'));
        t.deepEqual(style_layergroups, style_layergroups_expected);

        // Check non JSON-stringified properites of layerGroups arrays.
        t.deepEqual(style.layerGroups[0].source, 'mapbox.mapbox-streets-v5');
        t.deepEqual(style.layerGroups[1].source, undefined);

        // computed
        var style_computed = JSON.parse(JSON.stringify(style.computed));
        if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/style-basic-computed.json', JSON.stringify(style_computed, null, 2));
        var style_computed_expected = JSON.parse(fs.readFileSync(__dirname + '/../../expected/style-basic-computed.json'));
        t.deepEqual(style_computed, style_computed_expected);

        // addClass and removeClass
        style.addClass('night');
        t.ok(style.hasClass('night'));

        style.removeClass('night');
        t.ok(!style.hasClass('night'));

        // getLayer
        var style_getlayer = JSON.parse(JSON.stringify(style.getLayer('park')));
        if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/style-basic-getlayer.json', JSON.stringify(style_getlayer, null, 2));
        var style_getlayer_expected = JSON.parse(fs.readFileSync(__dirname + '/../../expected/style-basic-getlayer.json'));
        t.deepEqual(style_getlayer, style_getlayer_expected);

        t.end();
    });
});
