'use strict';

var test = require('prova');
var StyleLayer = require('../../../js/style/style_layer');
var FillStyleLayer = require('../../../js/style/style_layer/fill_style_layer');

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
});

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

        layer.setPaintProperty('background-color', null);

        t.equal(layer.getPaintProperty('background-color'), undefined);
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

        layer.setPaintProperty('background-color', null, 'night');

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

        t.deepEqual(layer.getLayoutProperty('text-transform'), undefined);
        t.end();
    });
});
