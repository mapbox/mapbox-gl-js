import { test } from 'mapbox-gl-js-test';
import StyleLayer from '../../../src/style/style_layer';
import FillStyleLayer from '../../../src/style/style_layer/fill_style_layer';
import util from '../../../src/util/util';
import Color from '../../../src/style-spec/util/color';

test('StyleLayer', (t) => {
    t.test('instantiates the correct subclass', (t) => {
        const layer = StyleLayer.create({type: 'fill'});

        t.ok(layer instanceof FillStyleLayer);
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

        layer.setPaintProperty('background-color', null);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});

        t.deepEqual(layer.paint.get('background-color'), new Color(0, 0, 0, 1));
        t.equal(layer.getPaintProperty('background-color'), undefined);
        t.equal(layer.paint.get('background-opacity'), 1);
        t.equal(layer.getPaintProperty('background-opacity'), 1);

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

    t.test('emits on an invalid property value', (t) => {
        const layer = StyleLayer.create({
            "id": "background",
            "type": "background"
        });

        layer.on('error', () => {
            t.equal(layer.getPaintProperty('background-opacity'), undefined);
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
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});
        t.deepEqual(layer.paint.get('fill-outline-color').value, {kind: 'constant', value: new Color(1, 0, 0, 1)});

        layer.setPaintProperty('fill-outline-color', undefined);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});
        t.deepEqual(layer.paint.get('fill-outline-color').value, {kind: 'constant', value: new Color(0, 0, 1, 1)});

        t.end();
    });

    t.test('can transition fill-outline-color from undefined to a value #3657', (t) => {
        const layer = StyleLayer.create({
            id: 'building',
            type: 'fill',
            source: 'streets',
            paint: {
                'fill-color': '#00f'
            }
        });

        // setup: set and then unset fill-outline-color so that, when we then try
        // to re-set it, StyleTransition#calculate() attempts interpolation
        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});

        layer.setPaintProperty('fill-outline-color', undefined);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});

        // re-set fill-outline-color and get its value, triggering the attempt
        // to interpolate between undefined and #f00
        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});

        layer.paint.get('fill-outline-color');

        t.end();
    });

    t.test('sets null property value', (t) => {
        const layer = StyleLayer.create({
            "id": "background",
            "type": "background"
        });

        layer.setPaintProperty('background-color-transition', null);

        t.deepEqual(layer.getPaintProperty('background-color-transition'), null);
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
        layer.recalculate({zoom: 0, zoomHistory: {}});

        t.deepEqual(layer.layout.get('text-transform').value, {kind: 'constant', value: 'none'});
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
