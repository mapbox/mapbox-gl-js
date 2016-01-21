'use strict';

var test = require('prova');
var StyleLayer = require('../../../js/style/style_layer');
var LayoutProperties = require('../../../js/style/layout_properties');

test('StyleLayer', function(t) {
    t.test('sets raw layer', function (t) {
        var rawLayer = {type: 'fill'},
            layer = StyleLayer.create(rawLayer);
        t.equal(layer._layer, rawLayer);
        t.end();
    });
});

test('StyleLayer#resolveLayout', function(t) {
    t.test('creates layout properties', function (t) {
        var layer = StyleLayer.create({type: 'fill'});
        layer.resolveLayout({});
        t.ok(layer.layout instanceof LayoutProperties.fill);
        t.end();
    });
});

test('StyleLayer#resolveReference', function(t) {
    t.test('sets properties from ref', function (t) {
        var layer = StyleLayer.create({ref: 'ref'}),
            referent = StyleLayer.create({type: 'fill'});
        layer.resolveReference({ref: referent});
        t.equal(layer.type, 'fill');
        t.end();
    });
});

test('StyleLayer#resolvePaint', function(t) {
    t.test('calculates paint classes', function(t) {
        var layer = StyleLayer.create({
            type: 'fill',
            'paint': {},
            'paint.night': {}
        });

        layer.resolvePaint({});

        t.deepEqual(Object.keys(layer._resolved), ['', 'night']);
        t.end();
    });
});

//test('StyleLayer#cascade', function(t) {
//    t.test('applies default transitions', function(t) {
//        var layer = StyleLayer.create({
//            type: 'fill',
//            paint: {
//                'fill-color': 'blue'
//            }
//        });
//
//        layer.resolvePaint({});
//
//        var declaration = layer._resolved['']['fill-color'];
//        t.deepEqual(declaration.value, [0, 0, 1, 1]);
//        t.deepEqual(declaration.transition, {delay: 0, duration: 300});
//
//        t.end();
//    });
//});

test('StyleLayer#setPaintProperty', function(t) {
    t.test('sets new property value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background"
        });

        layer.setPaintProperty('background-color', 'blue');

        t.deepEqual(layer.getPaintProperty('background-color'), [0, 0, 1, 1]);
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

        layer.resolvePaint({});
        layer.setPaintProperty('background-color', 'blue');

        t.deepEqual(layer.getPaintProperty('background-color'), [0, 0, 1, 1]);
        t.end();
    });

    t.test('unsets property value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });

        layer.resolvePaint({});
        layer.setPaintProperty('background-color', null);

        t.deepEqual(layer.getPaintProperty('background-color'), [0, 0, 0, 1]);
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

        layer.resolvePaint({});
        layer.setPaintProperty('background-color', 'blue', 'night');

        t.deepEqual(layer.getPaintProperty('background-color', 'night'), [0, 0, 1, 1]);
        t.end();
    });

    t.test('unsets classed paint value', function(t) {
        var layer = StyleLayer.create({
            "id": "background",
            "type": "background",
            "paint.night": {
                "background-color": "red"
            }
        });

        layer.resolvePaint({});
        layer.setPaintProperty('background-color', null, 'night');

        t.deepEqual(layer.getPaintProperty('background-color', 'night'), [0, 0, 0, 1]);
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

        layer.resolvePaint({});
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

        layer.resolvePaint({});
        layer.setPaintProperty('background-color-transition', {duration: 400});

        t.deepEqual(layer.getPaintProperty('background-color-transition'), {duration: 400});
        t.end();
    });
});

test('StyleLayer#setLayoutProperty', function(t) {
    t.test('sets new property value', function(t) {
        var layer = StyleLayer.create({
            "id": "symbol",
            "type": "symbol"
        });

        layer.resolveLayout();
        layer.setLayoutProperty('text-transform', 'lowercase');

        t.deepEqual(layer.getLayoutProperty('text-transform'), 'lowercase');
        t.end();
    });

    t.test('updates property value', function(t) {
        var layer = StyleLayer.create({
            "id": "symbol",
            "type": "symbol",
            "layout": {
                "text-transform": "uppercase"
            }
        });

        layer.resolveLayout();
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

        layer.resolveLayout();
        layer.setLayoutProperty('text-transform', null);

        t.deepEqual(layer.getLayoutProperty('text-transform'), 'none');
        t.end();
    });
});
