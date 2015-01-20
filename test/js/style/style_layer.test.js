'use strict';

var test = require('tape');

require('../../bootstrap');

var StyleLayer = require('../../../js/style/style_layer');
var LayoutProperties = require('../../../js/style/layout_properties');

test('StyleLayer', function(t) {
    t.test('sets raw layer', function (t) {
        var rawLayer = {type: 'fill'},
            layer = new StyleLayer(rawLayer);
        t.equal(layer._layer, rawLayer);
        t.end();
    });
});

test('StyleLayer#resolve', function(t) {
    t.test('sets properties from ref', function (t) {
        var layer = new StyleLayer({ref: 'ref'}),
            referent = new StyleLayer({type: 'fill'});
        layer.resolve({ref: referent}, {});
        t.equal(layer.type, 'fill');
        t.end();
    });

    t.test('creates layout properties', function(t) {
        var layer = new StyleLayer({type: 'fill'});
        layer.resolve({}, {});
        t.ok(layer.layout instanceof LayoutProperties.fill);
        t.end();
    });

    t.test('resolves layout constants', function(t) {
        var layer = new StyleLayer({
            type: 'line',
            layout: {
                'line-cap': '@square'
            }
        });

        layer.resolve({}, {
            '@square': 'square'
        });

        t.equal(layer.layout['line-cap'], 'square');
        t.end();
    });

    t.test('calculates paint classes', function(t) {
        var layer = new StyleLayer({
            type: 'fill',
            'paint': {},
            'paint.night': {}
        });

        layer.resolve({}, {});

        t.deepEqual(Object.keys(layer._resolved), ['', 'night']);
        t.end();
    });

    t.test('matches paint properties with their transitions', function(t) {
        var layer = new StyleLayer({
            type: 'fill',
            paint: {
                'fill-color': 'blue',
                'fill-color-transition': {
                    delay: 10,
                    duration: 20
                }
            }
        });

        layer.resolve({}, {});

        var declaration = layer._resolved['']['fill-color'];
        t.deepEqual(declaration.value, [0, 0, 1, 1]);
        t.deepEqual(declaration.transition, {delay: 10, duration: 20});

        t.end();
    });

    t.test('applies default transitions', function(t) {
        var layer = new StyleLayer({
            type: 'fill',
            paint: {
                'fill-color': 'blue'
            }
        });

        layer.resolve({}, {});

        var declaration = layer._resolved['']['fill-color'];
        t.deepEqual(declaration.value, [0, 0, 1, 1]);
        t.deepEqual(declaration.transition, {delay: 0, duration: 300});

        t.end();
    });

    t.test('ignores transitions without a matching base value', function(t) {
        var layer = new StyleLayer({
            type: 'fill',
            paint: {
                'fill-color-transition': {
                    delay: 10,
                    duration: 20
                }
            }
        });

        layer.resolve({}, {});

        t.equal(layer._resolved['']['fill-color'], undefined);
        t.end();
    });

    t.test('resolves paint constants', function(t) {
        // TODO
        t.end();
    });
});
