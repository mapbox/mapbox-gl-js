import {describe, test, expect} from "../../util/vitest.js";
import createStyleLayer from '../../../src/style/create_style_layer.js';
import FillStyleLayer from '../../../src/style/style_layer/fill_style_layer.js';
import {extend} from '../../../src/util/util.js';
import Color from '../../../src/style-spec/util/color.js';

describe('StyleLayer', () => {
    test('instantiates the correct subclass', () => {
        const layer = createStyleLayer({type: 'fill'});

        expect(layer instanceof FillStyleLayer).toBeTruthy();
    });
});

describe('StyleLayer#setPaintProperty', () => {
    test('sets new property value', () => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background"
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color')).toEqual('blue');
    });

    test('updates property value', () => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color')).toEqual('blue');
    });

    test('unsets value', () => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red",
                "background-opacity": 1
            }
        });

        layer.setPaintProperty('background-color', null);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0});

        expect(layer.paint.get('background-color')).toEqual(new Color(0, 0, 0, 1));
        expect(layer.getPaintProperty('background-color')).toEqual(undefined);
        expect(layer.paint.get('background-opacity')).toEqual(1);
        expect(layer.getPaintProperty('background-opacity')).toEqual(1);
    });

    test('preserves existing transition', () => {
        const layer = createStyleLayer({
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

        expect(layer.getPaintProperty('background-color-transition')).toEqual({duration: 600});
    });

    test('sets transition', () => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });

        layer.setPaintProperty('background-color-transition', {duration: 400});

        expect(layer.getPaintProperty('background-color-transition')).toEqual({duration: 400});
    });

    test('can unset fill-outline-color #2886', () => {
        const layer = createStyleLayer({
            id: 'building',
            type: 'fill',
            source: 'streets',
            paint: {
                'fill-color': '#00f'
            }
        });

        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updateTransitions({});
        layer.recalculate({zoom: 0});
        expect(layer.paint.get('fill-outline-color').value).toEqual({kind: 'constant', value: new Color(1, 0, 0, 1)});

        layer.setPaintProperty('fill-outline-color', undefined);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0});
        expect(layer.paint.get('fill-outline-color').value).toEqual({kind: 'constant', value: new Color(0, 0, 1, 1)});
    });

    test(
        'can transition fill-outline-color from undefined to a value #3657',
        () => {
            const layer = createStyleLayer({
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
            layer.recalculate({zoom: 0});

            layer.setPaintProperty('fill-outline-color', undefined);
            layer.updateTransitions({});
            layer.recalculate({zoom: 0});

            // re-set fill-outline-color and get its value, triggering the attempt
            // to interpolate between undefined and #f00
            layer.setPaintProperty('fill-outline-color', '#f00');
            layer.updateTransitions({});
            layer.recalculate({zoom: 0});

            layer.paint.get('fill-outline-color');
        }
    );

    test('sets null property value', () => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background"
        });

        layer.setPaintProperty('background-color-transition', null);

        expect(layer.getPaintProperty('background-color-transition')).toEqual(undefined);
    });
});

describe('StyleLayer#setLayoutProperty', () => {
    test('sets new property value', () => {
        const layer = createStyleLayer({
            "id": "symbol",
            "type": "symbol"
        });

        layer.setLayoutProperty('text-transform', 'lowercase');

        expect(layer.getLayoutProperty('text-transform')).toEqual('lowercase');
    });

    test('updates property value', () => {
        const layer = createStyleLayer({
            "id": "symbol",
            "type": "symbol",
            "layout": {
                "text-transform": "uppercase"
            }
        });

        layer.setLayoutProperty('text-transform', 'lowercase');

        expect(layer.getLayoutProperty('text-transform')).toEqual('lowercase');
    });

    test('unsets property value', () => {
        const layer = createStyleLayer({
            "id": "symbol",
            "type": "symbol",
            "layout": {
                "text-transform": "uppercase"
            }
        });

        layer.setLayoutProperty('text-transform', null);
        layer.recalculate({zoom: 0});

        expect(layer.layout.get('text-transform').value).toEqual({kind: 'constant', value: 'none'});
        expect(layer.getLayoutProperty('text-transform')).toEqual(undefined);
    });

    test('updates visibility for custom layer', () => {
        const layer = createStyleLayer({type: 'custom'});
        layer.setLayoutProperty('visibility', 'none');
        expect(layer.getLayoutProperty('visibility')).toEqual('none');
    });
});

describe('StyleLayer#serialize', () => {
    function createSymbolLayer(layer) {
        return extend({
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

    test('serializes layers', () => {
        expect(createStyleLayer(createSymbolLayer()).serialize()).toEqual(createSymbolLayer());
    });

    test('serializes functions', () => {
        const layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        expect(createStyleLayer(createSymbolLayer({paint: layerPaint})).serialize().paint).toEqual(layerPaint);
    });

    test('serializes added paint properties', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        expect(layer.serialize().paint['text-halo-color']).toEqual('orange');
        expect(layer.serialize().paint['text-color']).toEqual('blue');
    });

    test('serializes added layout properties', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        expect(layer.serialize().layout['text-transform']).toEqual('uppercase');
        expect(layer.serialize().layout['text-size']).toEqual(20);
    });

    test('serializes "visibility" of "visible"', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', 'visible');

        expect(layer.serialize().layout['visibility']).toEqual('visible');
    });

    test('serializes "visibility" of "none"', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', 'none');

        expect(layer.serialize().layout['visibility']).toEqual('none');
    });

    test('serializes "visibility" of undefined', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', undefined);

        expect(layer.serialize().layout['visibility']).toEqual(undefined);
    });
});

describe('StyleLayer#serialize', () => {
    function createSymbolLayer(layer) {
        return extend({
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

    test('serializes layers', () => {
        expect(createStyleLayer(createSymbolLayer()).serialize()).toEqual(createSymbolLayer());
    });

    test('serializes functions', () => {
        const layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        expect(createStyleLayer(createSymbolLayer({paint: layerPaint})).serialize().paint).toEqual(layerPaint);
    });

    test('serializes added paint properties', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        expect(layer.serialize().paint['text-halo-color']).toEqual('orange');
        expect(layer.serialize().paint['text-color']).toEqual('blue');
    });

    test('serializes added layout properties', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        expect(layer.serialize().layout['text-transform']).toEqual('uppercase');
        expect(layer.serialize().layout['text-size']).toEqual(20);
    });

    test('layer.paint is never undefined', () => {
        const layer = createStyleLayer({type: 'fill'});
        // paint is never undefined
        expect(layer.paint).toBeTruthy();
    });
});
