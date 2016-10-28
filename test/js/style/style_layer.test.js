'use strict';

const test = require('mapbox-gl-js-test').test;
const StyleLayer = require('../../../js/style/style_layer');
const FillStyleLayer = require('../../../js/style/style_layer/fill_style_layer');
const util = require('../../../js/util/util');

test('StyleLayer', (t) => {
    t.test('instantiates the correct subclass', (t) => {
        const layer = StyleLayer.create({type: 'fill'});

        t.ok(layer instanceof FillStyleLayer);
        t.end();
    });

    t.end();
});

test('StyleLayer#updatePaintTransition', (t) => {

    t.test('updates paint transition', (t) => {
        const layer = StyleLayer.create({
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

    t.test('updates paint transition with class', (t) => {
        const layer = StyleLayer.create({
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

    t.test('updates paint transition with extraneous class', (t) => {
        const layer = StyleLayer.create({
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

test('StyleLayer#updatePaintTransitions', (t) => {
    t.test('respects classes regardless of layer properties order', (t) => {
        const layer = StyleLayer.create({
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

test('StyleLayer#setPaintProperty', (t) => {
    t.test('sets new property value', (t) => {
        const layer = StyleLayer.create({
            "id": "background",
            "type": "background"
        });

        layer.setPaintProperty('background-color', 'blue');

        t.deepEqual(layer.getPaintProperty('background-color'), 'blue');
        t.end();
    });

    t.test('updates property value', (t) => {
        const layer = StyleLayer.create({
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

    t.test('unsets value', (t) => {
        const layer = StyleLayer.create({
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

    t.test('sets classed paint value', (t) => {
        const layer = StyleLayer.create({
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

    t.test('unsets classed paint value', (t) => {
        const layer = StyleLayer.create({
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

    t.test('preserves existing transition', (t) => {
        const layer = StyleLayer.create({
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

    t.test('sets transition', (t) => {
        const layer = StyleLayer.create({
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

    t.test('sets transition with a class name equal to the property name', (t) => {
        const layer = StyleLayer.create({
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

    t.test('emits on an invalid property value', (t) => {
        const layer = StyleLayer.create({
            "id": "background",
            "type": "background"
        });

        layer.on('error', () => {
            t.equal(layer.getPaintProperty('background-opacity'), undefined);
            t.equal(layer.getPaintValue('background-opacity'), 1);
            t.end();
        });

        layer.setPaintProperty('background-opacity', 5);
    });

    t.test('emits on an invalid transition property value', (t) => {
        const layer = StyleLayer.create({
            "id": "background",
            "type": "background"
        });

        layer.on('error', () => {
            t.end();
        });

        layer.setPaintProperty('background-opacity-transition', {
            duration: -10
        });
    });

    t.test('can unset fill-outline-color #2886', (t) => {
        const layer = StyleLayer.create({
            id: 'building',
            type: 'fill',
            source: 'streets',
            paint: {
                'fill-color': '#00f'
            }
        });

        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updatePaintTransitions([], {transition: false}, null, createAnimationLoop());
        t.deepEqual(layer.getPaintValue('fill-outline-color'), [1, 0, 0, 1]);
        layer.setPaintProperty('fill-outline-color', undefined);
        layer.updatePaintTransitions([], {transition: false}, null, createAnimationLoop());
        t.deepEqual(layer.getPaintValue('fill-outline-color'), [0, 0, 1, 1]);

        t.end();
    });

    t.end();
});

test('StyleLayer#setLayoutProperty', (t) => {
    t.test('sets new property value', (t) => {
        const layer = StyleLayer.create({
            "id": "symbol",
            "type": "symbol"
        });

        layer.setLayoutProperty('text-transform', 'lowercase');

        t.deepEqual(layer.getLayoutProperty('text-transform'), 'lowercase');
        t.end();
    });

    t.test('emits on an invalid property value', (t) => {
        const layer = StyleLayer.create({
            "id": "symbol",
            "type": "symbol"
        });

        layer.on('error', () => {
            t.end();
        });

        layer.setLayoutProperty('text-transform', 'mapboxcase');
    });

    t.test('updates property value', (t) => {
        const layer = StyleLayer.create({
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

    t.test('unsets property value', (t) => {
        const layer = StyleLayer.create({
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

test('StyleLayer#serialize', (t) => {

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

    t.test('serializes layers', (t) => {
        t.deepEqual(
            StyleLayer.create(createSymbolLayer()).serialize(),
            createSymbolLayer()
        );
        t.end();
    });

    t.test('serializes layers with paint classes', (t) => {
        const layer = createSymbolLayer({
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

    t.test('serializes functions', (t) => {
        const layerPaint = {
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

    t.test('serializes added paint properties', (t) => {
        const layer = StyleLayer.create(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        t.equal(layer.serialize().paint['text-halo-color'], 'orange');
        t.equal(layer.serialize().paint['text-color'], 'blue');

        t.end();
    });

    t.test('serializes added layout properties', (t) => {
        const layer = StyleLayer.create(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        t.equal(layer.serialize().layout['text-transform'], 'uppercase');
        t.equal(layer.serialize().layout['text-size'], 20);

        t.end();
    });

    t.end();
});

test('StyleLayer#serialize', (t) => {

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

    t.test('serializes layers', (t) => {
        t.deepEqual(
            StyleLayer.create(createSymbolLayer()).serialize(),
            createSymbolLayer()
        );
        t.end();
    });

    t.test('serializes functions', (t) => {
        const layerPaint = {
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

    t.test('serializes added paint properties', (t) => {
        const layer = StyleLayer.create(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        t.equal(layer.serialize().paint['text-halo-color'], 'orange');
        t.equal(layer.serialize().paint['text-color'], 'blue');

        t.end();
    });

    t.test('serializes added layout properties', (t) => {
        const layer = StyleLayer.create(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        t.equal(layer.serialize().layout['text-transform'], 'uppercase');
        t.equal(layer.serialize().layout['text-size'], 20);

        t.end();
    });

    t.end();
});

test('StyleLayer#getLayoutValue (default exceptions)', (t) => {
    t.test('symbol-placement:point => *-rotation-alignment:viewport', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "symbol-placement": "point"
            }
        });
        t.equal(layer.getLayoutValue('text-rotation-alignment'), 'viewport');
        t.equal(layer.getLayoutValue('icon-rotation-alignment'), 'viewport');
        t.end();
    });

    t.test('symbol-placement:line => *-rotation-alignment:map', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "symbol-placement": "line"
            }
        });
        t.equal(layer.getLayoutValue('text-rotation-alignment'), 'map');
        t.equal(layer.getLayoutValue('icon-rotation-alignment'), 'map');
        t.end();
    });

    t.test('text-rotation-alignment:map => text-pitch-alignment:map', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "text-rotation-alignment": "map"
            }
        });
        t.equal(layer.getLayoutValue('text-rotation-alignment'), 'map');
        t.equal(layer.getLayoutValue('text-pitch-alignment'), 'map');
        t.end();
    });

    t.test('text-rotation-alignment:viewport => text-pitch-alignment:viewport', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "text-rotation-alignment": "viewport"
            }
        });
        t.equal(layer.getLayoutValue('text-rotation-alignment'), 'viewport');
        t.equal(layer.getLayoutValue('text-pitch-alignment'), 'viewport');
        t.end();
    });

    t.test('text-pitch-alignment:auto defaults to text-rotation-alignment', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "text-rotation-alignment": "map",
                "text-pitch-alignment": "auto"
            }
        });
        t.equal(layer.getLayoutValue('text-rotation-alignment'), 'map');
        t.equal(layer.getLayoutValue('text-pitch-alignment'), 'map');
        t.end();
    });

    t.test('text-pitch-alignment respected when set', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "text-rotation-alignment": "viewport",
                "text-pitch-alignment": "map"
            }
        });
        t.equal(layer.getLayoutValue('text-rotation-alignment'), 'viewport');
        t.equal(layer.getLayoutValue('text-pitch-alignment'), 'map');
        t.end();
    });

    t.test('symbol-placement:point and text-rotation-alignment:auto  => text-rotation-alignment:viewport ', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "symbol-placement": "point",
                "text-rotation-alignment": "auto"
            }
        });
        t.equal(layer.getLayoutValue('text-rotation-alignment'), 'viewport');
        t.end();
    });

    t.test('symbol-placement:line and text-rotation-alignment:auto  => text-rotation-alignment:map ', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "symbol-placement": "line",
                "text-rotation-alignment": "auto"
            }
        });
        t.equal(layer.getLayoutValue('text-rotation-alignment'), 'map');
        t.end();
    });

    t.test('symbol-placement:point and icon-rotation-alignment:auto  => icon-rotation-alignment:viewport ', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "symbol-placement": "point",
                "icon-rotation-alignment": "auto"
            }
        });
        t.equal(layer.getLayoutValue('icon-rotation-alignment'), 'viewport');
        t.end();
    });

    t.test('symbol-placement:line and icon-rotation-alignment:auto  => icon-rotation-alignment:map ', (t) => {
        const layer = StyleLayer.create({
            "type": "symbol",
            "layout": {
                "symbol-placement": "line",
                "icon-rotation-alignment": "auto"
            }
        });
        t.equal(layer.getLayoutValue('icon-rotation-alignment'), 'map');
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
