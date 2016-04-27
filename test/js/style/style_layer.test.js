'use strict';

var test = require('tap').test;
var StyleLayer = require('../../../js/style/style_layer');
var FillStyleLayer = require('../../../js/style/style_layer/fill_style_layer');
var util = require('../../../js/util/util');

test('StyleLayer', function(t) {
    t.test('sets properties from ref', function (t) {
        var layer = StyleLayer.create(
            {ref: 'ref'},
            StyleLayer.create({type: 'fill'})
        );

        t.equal(layer.type, 'fill');
        t.end();
    });

    t.test('instantiates the correct subclass', function (t) {
        var layer = StyleLayer.create({type: 'fill'});

        t.ok(layer instanceof FillStyleLayer);
        t.end();
    });

    t.end();
});

test('StyleLayer#updatePaintTransition', function (t) {

    t.test('updates paint transition', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });
        layer.updatePaintTransition('background-color', [], {});
        t.deepEqual(layer.getPaintValue('background-color'), [1, 0, 0, 1]);
        t.end();
    });

    t.test('updates paint transition with class', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            },
            "paint.mapbox": {
                "background-color": "blue"
            }
        });
        layer.updatePaintTransition('background-color', ['mapbox'], {});
        t.deepEqual(layer.getPaintValue('background-color'), [0, 0, 1, 1]);
        t.end();
    });

    t.test('updates paint transition with extraneous class', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });
        layer.updatePaintTransition('background-color', ['mapbox'], {});
        t.deepEqual(layer.getPaintValue('background-color'), [1, 0, 0, 1]);
        t.end();
    });

    t.end();
});

test('StyleLayer#updatePaintTransitions', function (t) {
    t.test('respects classes regardless of layer properties order', function (t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "fill",
            "paint.blue": {
                "fill-color": "#8ccbf7",
                "fill-opacity": 1
            },
            "paint": {
                "fill-opacity": 0
            }
        });

        layer.updatePaintTransitions([], {transition: false}, null, createAnimationLoop());
        t.equal(layer.getPaintValue('fill-opacity'), 0);

        layer.updatePaintTransitions(['blue'], {transition: false}, null, createAnimationLoop());
        t.equal(layer.getPaintValue('fill-opacity'), 1);

        t.end();
    });

    t.end();
});

test('StyleLayer#setPaintProperty', function(t) {
    t.test('sets new property value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background"
        });

        layer.setPaintProperty('background-color', 'blue');

        t.deepEqual(layer.getPaintProperty('background-color'), 'blue');
        t.end();
    });

    t.test('updates property value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });

        layer.setPaintProperty('background-color', 'blue');

        t.deepEqual(layer.getPaintProperty('background-color'), 'blue');
        t.end();
    });

    t.test('unsets value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red",
                "background-opacity": 1
            }
        });
        layer.updatePaintTransitions([], {transition: false}, null, createAnimationLoop());
        layer.setPaintProperty('background-color', null);
        layer.updatePaintTransitions([], {transition: false}, null, createAnimationLoop());

        t.deepEqual(layer.getPaintValue('background-color'), [0, 0, 0, 1]);
        t.equal(layer.getPaintProperty('background-color'), undefined);
        t.equal(layer.getPaintValue('background-opacity'), 1);
        t.equal(layer.getPaintProperty('background-opacity'), 1);

        t.end();
    });

    t.test('sets classed paint value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint.night": {
                "background-color": "red"
            }
        });

        layer.setPaintProperty('background-color', 'blue', 'night');

        t.deepEqual(layer.getPaintProperty('background-color', 'night'), 'blue');
        t.end();
    });

    t.test('unsets classed paint value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red",
                "background-opacity": 1
            },
            "paint.night": {
                "background-color": "blue",
                "background-opacity": 0.1
            }
        });
        layer.updatePaintTransitions(['night'], {transition: false}, null, createAnimationLoop());
        t.deepEqual(layer.getPaintProperty('background-color', 'night'), 'blue');
        t.deepEqual(layer.getPaintValue('background-color'), [0, 0, 1, 1]);

        layer.setPaintProperty('background-color', null, 'night');
        layer.updatePaintTransitions(['night'], {transition: false}, null, createAnimationLoop());
        t.deepEqual(layer.getPaintValue('background-color'), [1, 0, 0, 1]);
        t.equal(layer.getPaintProperty('background-color', 'night'), undefined);

        t.end();
    });

    t.test('preserves existing transition', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red",
                "background-color-transition": {
                    duration: 600
                }
            }
        });

        layer.setPaintProperty('background-color', 'blue');

        t.deepEqual(layer.getPaintProperty('background-color-transition'), {duration: 600});
        t.end();
    });

    t.test('sets transition', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });

        layer.setPaintProperty('background-color-transition', {duration: 400});

        t.deepEqual(layer.getPaintProperty('background-color-transition'), {duration: 400});
        t.end();
    });

    t.test('sets transition with a class name equal to the property name', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });

        layer.setPaintProperty('background-color-transition', {duration: 400}, 'background-color');
        layer.updatePaintTransitions([], {transition: false}, null, createAnimationLoop());
        t.deepEqual(layer.getPaintProperty('background-color-transition', 'background-color'), {duration: 400});
        t.end();
    });

    t.test('emits on an invalid property value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background"
        });

        layer.on('error', function() {
            t.equal(layer.getPaintProperty('background-opacity'), undefined);
            t.equal(layer.getPaintValue('background-opacity'), 1);
            t.end();
        });

        layer.setPaintProperty('background-opacity', 5);
    });

    t.test('emits on an invalid transition property value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background"
        });

        layer.on('error', function() {
            t.end();
        });

        layer.setPaintProperty('background-opacity-transition', {
            duration: -10
        });
    });

    t.end();
});

test('StyleLayer#setLayoutProperty', function(t) {
    t.test('sets new property value', function(t) {
        var layer = StyleLayer.create({
            "id": "symbol",
            "type": "symbol"
        });

        layer.setLayoutProperty('text-transform', 'lowercase');

        t.deepEqual(layer.getLayoutProperty('text-transform'), 'lowercase');
        t.end();
    });

    t.test('emits on an invalid property value', function(t) {
        var layer = StyleLayer.create({
            "id": "symbol",
            "type": "symbol"
        });

        layer.on('error', function() {
            t.end();
        });

        layer.setLayoutProperty('text-transform', 'mapboxcase');
    });

    t.test('updates property value', function(t) {
        var layer = StyleLayer.create({
            "id": "symbol",
            "type": "symbol",
            "layout": {
                "text-transform": "uppercase"
            }
        });

        layer.setLayoutProperty('text-transform', 'lowercase');

        t.deepEqual(layer.getLayoutProperty('text-transform'), 'lowercase');
        t.end();
    });

    t.test('unsets property value', function(t) {
        var layer = StyleLayer.create({
            "id": "symbol",
            "type": "symbol",
            "layout": {
                "text-transform": "uppercase"
            }
        });

        layer.setLayoutProperty('text-transform', null);

        t.equal(layer.getLayoutValue('text-transform'), 'none');
        t.equal(layer.getLayoutProperty('text-transform'), undefined);
        t.end();
    });

    t.end();
});

test('StyleLayer#serialize', function(t) {

    function createSymbolLayer(layer) {
        return util.extend({
            id: 'symbol',
            type: 'symbol',
            paint: {
                'text-color': 'blue'
            },
            layout: {
                'text-transform': 'uppercase'
            }
        }, layer);
    }

    function createRefedSymbolLayer(layer) {
        return util.extend({
            id: 'symbol',
            ref: 'symbol',
            paint: {
                'text-color': 'red'
            }
        }, layer);
    }

    t.test('serializes layers', function(t) {
        t.deepEqual(
            StyleLayer.create(createSymbolLayer()).serialize(),
            createSymbolLayer()
        );
        t.end();
    });

    t.test('serializes layers with paint classes', function(t) {
        var layer = createSymbolLayer({
            'paint.night': {
                'text-color': 'orange'
            }
        });
        t.deepEqual(
            StyleLayer.create(layer).serialize(),
            layer
        );
        t.end();
    });

    t.test('serializes refed layers', function(t) {
        t.deepEqual(
            StyleLayer.create(
                createRefedSymbolLayer(),
                StyleLayer.create(createSymbolLayer())
            ).serialize(),
            createRefedSymbolLayer()
        );
        t.end();
    });

    t.test('serializes refed layers with ref properties', function(t) {
        t.deepEqual(
            StyleLayer.create(
                createRefedSymbolLayer(),
                StyleLayer.create(createSymbolLayer())
            ).serialize({includeRefProperties: true}),
            {
                id: "symbol",
                type: "symbol",
                paint: { "text-color": "red" },
                layout: { "text-transform": "uppercase" },
                ref: "symbol"
            }
        );
        t.end();
    });

    t.test('serializes functions', function(t) {
        var layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        t.deepEqual(
            StyleLayer.create(createSymbolLayer({ paint: layerPaint })).serialize().paint,
            layerPaint
        );
        t.end();
    });

    t.test('serializes added paint properties', function(t) {
        var layer = StyleLayer.create(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        t.equal(layer.serialize().paint['text-halo-color'], 'orange');
        t.equal(layer.serialize().paint['text-color'], 'blue');

        t.end();
    });

    t.test('serializes added layout properties', function(t) {
        var layer = StyleLayer.create(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        t.equal(layer.serialize().layout['text-transform'], 'uppercase');
        t.equal(layer.serialize().layout['text-size'], 20);

        t.end();
    });

    t.end();
});

test('StyleLayer#serialize', function(t) {

    function createSymbolLayer(layer) {
        return util.extend({
            id: 'symbol',
            type: 'symbol',
            paint: {
                'text-color': 'blue'
            },
            layout: {
                'text-transform': 'uppercase'
            }
        }, layer);
    }

    function createRefedSymbolLayer(layer) {
        return util.extend({
            id: 'symbol',
            ref: 'symbol',
            paint: {
                'text-color': 'red'
            }
        }, layer);
    }

    t.test('serializes layers', function(t) {
        t.deepEqual(
            StyleLayer.create(createSymbolLayer()).serialize(),
            createSymbolLayer()
        );
        t.end();
    });

    t.test('serializes refed layers', function(t) {
        t.deepEqual(
            StyleLayer.create(
                createRefedSymbolLayer(),
                StyleLayer.create(createSymbolLayer())).serialize(),
            createRefedSymbolLayer()
        );
        t.end();
    });

    t.test('serializes refed layers with ref properties', function(t) {
        t.deepEqual(
            StyleLayer.create(
                createRefedSymbolLayer(),
                StyleLayer.create(createSymbolLayer())
            ).serialize({includeRefProperties: true}),
            {
                id: "symbol",
                type: "symbol",
                paint: { "text-color": "red" },
                layout: { "text-transform": "uppercase" },
                ref: "symbol"
            }
        );
        t.end();
    });

    t.test('serializes functions', function(t) {
        var layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        t.deepEqual(
            StyleLayer.create(createSymbolLayer({ paint: layerPaint })).serialize().paint,
            layerPaint
        );
        t.end();
    });

    t.test('serializes added paint properties', function(t) {
        var layer = StyleLayer.create(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        t.equal(layer.serialize().paint['text-halo-color'], 'orange');
        t.equal(layer.serialize().paint['text-color'], 'blue');

        t.end();
    });

    t.test('serializes added layout properties', function(t) {
        var layer = StyleLayer.create(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        t.equal(layer.serialize().layout['text-transform'], 'uppercase');
        t.equal(layer.serialize().layout['text-size'], 20);

        t.end();
    });

    t.end();
});

function createAnimationLoop() {
    return {
        set: function() {},
        cancel: function() {}
    };
}
