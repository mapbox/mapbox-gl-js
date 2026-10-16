// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {describe, test, expect} from '../../util/vitest';
import createStyleLayer from '../../../src/style/create_style_layer';
import EvaluationParameters from '../../../src/style/evaluation_parameters';
import Color from '../../../src/style-spec/util/color';
import {ImageId} from '../../../src/style-spec/expression/types/image_id';
import {easeCubicInOut} from '../../../src/util/util';

function setPaint(layer, name, value, now, duration = 100, delay = 0) {
    layer.setPaintProperty(name, value);
    layer.updateTransitions({transition: {duration, delay}, now});
}

function opacityAt(layer, now, zoom = 0) {
    layer.recalculate(new EvaluationParameters(zoom, {now}), []);
    return layer.paint.get('background-opacity');
}

function backgroundLayer(paint = {}) {
    const layer = createStyleLayer({id: 'background', type: 'background', paint});
    layer.updateTransitions({transition: {}, now: 0});
    layer.recalculate(new EvaluationParameters(0, {now: 0}), []);
    return layer;
}

describe('paint transitions', () => {
    test('applies a value immediately without a transition', () => {
        const layer = backgroundLayer({'background-opacity': 0});
        setPaint(layer, 'background-opacity', 1, 0, 0);

        expect(opacityAt(layer, 0)).toEqual(1);
    });

    test('has no transition after a zero-duration change', () => {
        const layer = backgroundLayer({'background-opacity': 0});
        setPaint(layer, 'background-opacity', 1, 0, 0);
        opacityAt(layer, 0);

        expect(layer.hasTransition()).toEqual(false);
    });

    test('eases between the old and new values over the duration', () => {
        const layer = backgroundLayer({'background-opacity': 0});
        setPaint(layer, 'background-opacity', 1, 1000);

        expect([1000, 1025, 1050, 1100, 1101].map(now => opacityAt(layer, now))).toEqual([
            0, easeCubicInOut(0.25), 0.5, 1, 1
        ]);
    });

    test('holds the old value during the delay', () => {
        const layer = backgroundLayer({'background-opacity': 0});
        setPaint(layer, 'background-opacity', 1, 0, 100, 50);

        expect([25, 100, 200].map(now => opacityAt(layer, now))).toEqual([0, 0.5, 1]);
    });

    test('uses the property transition over the global one', () => {
        const layer = backgroundLayer({'background-opacity': 0, 'background-opacity-transition': {duration: 200}});
        setPaint(layer, 'background-opacity', 1, 0, 100);

        expect(opacityAt(layer, 100)).toEqual(0.5);
    });

    test('stays transitioning until a recalculation past the end', () => {
        const layer = backgroundLayer({'background-opacity': 0});
        setPaint(layer, 'background-opacity', 1, 0);

        const states = [50, 100, 101].map(now => {
            opacityAt(layer, now);
            return layer.hasTransition();
        });
        expect(states).toEqual([true, true, false]);
    });

    test('stays transitioning without a recalculation', () => {
        const layer = backgroundLayer({'background-opacity': 0});
        setPaint(layer, 'background-opacity', 1, 0);

        expect(layer.hasTransition()).toEqual(true);
    });

    test('chains a new transition from the in-progress value', () => {
        const layer = backgroundLayer({'background-opacity': 0});
        setPaint(layer, 'background-opacity', 1, 0);
        setPaint(layer, 'background-opacity', 0, 50);

        const prior = easeCubicInOut(0.75);
        expect([50, 75].map(now => opacityAt(layer, now))).toEqual([
            0.5, prior + (0 - prior) * easeCubicInOut(0.25)
        ]);
    });

    test('snaps to a data-driven value', () => {
        const layer = createStyleLayer({id: 'circle', type: 'circle', source: 's', paint: {'circle-radius': 1}});
        layer.updateTransitions({transition: {}, now: 0});
        layer.recalculate(new EvaluationParameters(0, {now: 0}), []);

        setPaint(layer, 'circle-radius', ['get', 'r'], 0);
        layer.recalculate(new EvaluationParameters(0, {now: 50}), []);

        expect(layer.paint.get('circle-radius').evaluate({properties: {r: 7}}, {})).toEqual(7);
    });

    test('ends the transition when snapping to a data-driven value', () => {
        const layer = createStyleLayer({id: 'circle', type: 'circle', source: 's', paint: {'circle-radius': 1}});
        layer.updateTransitions({transition: {}, now: 0});
        layer.recalculate(new EvaluationParameters(0, {now: 0}), []);

        setPaint(layer, 'circle-radius', ['get', 'r'], 0);
        layer.recalculate(new EvaluationParameters(0, {now: 50}), []);

        expect(layer.hasTransition()).toEqual(false);
    });

    test('keeps a settled sibling value while another property transitions', () => {
        const layer = backgroundLayer({'background-opacity': 0.5, 'background-color': 'red'});
        setPaint(layer, 'background-color', 'blue', 0);

        expect(opacityAt(layer, 50)).toEqual(0.5);
    });

    test('keeps an in-progress sibling transition when another property changes', () => {
        const layer = backgroundLayer({'background-opacity': 0, 'background-color': 'red'});
        setPaint(layer, 'background-opacity', 1, 0);
        setPaint(layer, 'background-color', 'blue', 50);

        expect(opacityAt(layer, 75)).toEqual(easeCubicInOut(0.75));
    });

    test('keeps an in-progress sibling transition on a zero-duration change', () => {
        const layer = backgroundLayer({'background-opacity': 0, 'background-color': 'red'});
        setPaint(layer, 'background-opacity', 1, 0);
        setPaint(layer, 'background-color', 'blue', 50, 0);

        expect(opacityAt(layer, 60)).toEqual(easeCubicInOut(0.6));
    });

    test('stops transitioning after a change to a property without transitions', () => {
        const layer = createStyleLayer({id: 'fill', type: 'fill', source: 's', paint: {'fill-opacity': 0.5}});
        layer.updateTransitions({transition: {}, now: 0});
        layer.recalculate(new EvaluationParameters(0, {now: 0}), []);
        setPaint(layer, 'fill-antialias', false, 0);
        layer.recalculate(new EvaluationParameters(0, {now: 50}), []);

        expect(layer.hasTransition()).toEqual(false);
    });
});

describe('paintVersion', () => {
    test('stays the same on a recalculation at a new zoom', () => {
        const layer = backgroundLayer({'background-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0, 10, 1]});
        const version = layer.paintVersion;
        opacityAt(layer, 0, 5);

        expect(layer.paintVersion).toEqual(version);
    });

    test('changes on updateTransitions without a value change', () => {
        const layer = backgroundLayer({'background-opacity': 0.5});
        const version = layer.paintVersion;
        layer.updateTransitions({transition: {}, now: 0});

        expect(layer.paintVersion).not.toEqual(version);
    });
});

describe('zoom-dependent values', () => {
    test('re-evaluates a camera paint property on each recalculation', () => {
        const layer = backgroundLayer({'background-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0, 10, 1]});

        expect([5, 7].map(zoom => opacityAt(layer, 0, zoom))).toEqual([0.5, 0.7]);
    });

    test('re-evaluates a camera layout property on each recalculation', () => {
        const layer = createStyleLayer({id: 'line', type: 'line', source: 's', layout: {
            'line-miter-limit': ['interpolate', ['linear'], ['zoom'], 0, 0, 10, 10]
        }});
        layer.updateTransitions({transition: {}, now: 0});

        const values = [5, 7].map(zoom => {
            layer.recalculate(new EvaluationParameters(zoom), []);
            return layer.layout.get('line-miter-limit');
        });
        expect(values).toEqual([5, 7]);
    });

    test('evaluates a composite property at the zoom of the last recalculation', () => {
        const layer = createStyleLayer({id: 'circle', type: 'circle', source: 's', paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['get', 'r'], 10, ['*', 2, ['get', 'r']]]
        }});
        layer.updateTransitions({transition: {}, now: 0});

        const values = [0, 5].map(zoom => {
            layer.recalculate(new EvaluationParameters(zoom), []);
            return layer.paint.get('circle-radius').evaluate({properties: {r: 10}}, {});
        });
        expect(values).toEqual([10, 15]);
    });

    test('evaluates the composite zoom range of the last recalculation', () => {
        const layer = createStyleLayer({id: 'circle', type: 'circle', source: 's', paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['get', 'r'], 10, ['*', 2, ['get', 'r']], 20, 0]
        }});
        layer.updateTransitions({transition: {}, now: 0});
        layer.recalculate(new EvaluationParameters(15), []);

        expect(layer.paint.get('circle-radius').evaluate({properties: {r: 10}}, {})).toEqual(10);
    });
});

describe('available images', () => {
    function patternsWith(layer, imageSets) {
        layer.updateTransitions({transition: {}, now: 0});
        return imageSets.map(images => {
            layer.recalculate(new EvaluationParameters(0), images.map(name => ImageId.from(name)));
            const value = layer.paint.get(`${layer.type}-pattern`);
            return (value.constantOr ? value.constantOr(null) : value).primaryId.name;
        });
    }

    test('re-evaluates a data-driven image property with the images passed to recalculate', () => {
        const layer = createStyleLayer({id: 'fill', type: 'fill', source: 's', paint: {
            'fill-pattern': ['coalesce', ['image', 'a'], ['image', 'b']]
        }});
        expect(patternsWith(layer, [['b'], ['a', 'b']])).toEqual(['b', 'a']);
    });

    test('ignores the images passed to recalculate for a data-constant image property', () => {
        const layer = createStyleLayer({id: 'background', type: 'background', paint: {
            'background-pattern': ['coalesce', ['image', 'a'], ['image', 'b']]
        }});
        expect(patternsWith(layer, [['b'], ['a', 'b']])).toEqual(['a', 'a']);
    });
});

describe('fill-outline-color', () => {
    test('falls back to fill-color at each zoom', () => {
        const layer = createStyleLayer({id: 'fill', type: 'fill', source: 's', paint: {
            'fill-color': ['interpolate', ['linear'], ['zoom'], 0, 'red', 10, 'blue']
        }});
        layer.updateTransitions({transition: {}, now: 0});

        const colors = [0, 10].map(zoom => {
            layer.recalculate(new EvaluationParameters(zoom), []);
            return layer.paint.get('fill-outline-color').constantOr(null);
        });
        expect(colors).toEqual([new Color(1, 0, 0, 1), new Color(0, 0, 1, 1)]);
    });

    test('uses its own value when set', () => {
        const layer = createStyleLayer({id: 'fill', type: 'fill', source: 's', paint: {
            'fill-color': 'red', 'fill-outline-color': 'blue'
        }});
        layer.updateTransitions({transition: {}, now: 0});
        layer.recalculate(new EvaluationParameters(0), []);

        expect(layer.paint.get('fill-outline-color').constantOr(null)).toEqual(new Color(0, 0, 1, 1));
    });
});

describe('line-floorwidth', () => {
    function lineLayer(paint) {
        const layer = createStyleLayer({id: 'line', type: 'line', source: 's', paint});
        layer.updateTransitions({transition: {}, now: 0});
        layer.recalculate(new EvaluationParameters(5.5), []);
        return layer;
    }

    test('evaluates line-width at the integer zoom', () => {
        const layer = lineLayer({'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0, 10, 10]});

        expect([layer.paint.get('line-width').constantOr(null), layer.paint.get('line-floorwidth').constantOr(null)]).toEqual([5.5, 5]);
    });

    test('evaluates a composite line-width at the integer zoom', () => {
        const layer = lineLayer({'line-width': ['interpolate', ['linear'], ['zoom'], 0, ['get', 'w'], 10, ['*', 2, ['get', 'w']]]});

        expect(layer.paint.get('line-floorwidth').evaluate({properties: {w: 10}}, {})).toEqual(15);
    });

    test('follows the latest line-width during a transition', () => {
        const layer = lineLayer({'line-width': 1});
        setPaint(layer, 'line-width', 3, 0);
        layer.recalculate(new EvaluationParameters(5.5, {now: 50}), []);

        expect([layer.paint.get('line-width').constantOr(null), layer.paint.get('line-floorwidth').constantOr(null)]).toEqual([2, 3]);
    });
});

describe('layout values', () => {
    test('applies a building-height layout value immediately', () => {
        const layer = createStyleLayer({id: 'building', type: 'building', source: 's', layout: {'building-height': 10}});
        layer.recalculate(new EvaluationParameters(16), []);

        expect(layer.layout.get('building-height').constantOr(null)).toEqual(10);
    });
});

describe('symbol layout fixups', () => {
    function symbolLayout(layout, appearances?) {
        const layer = createStyleLayer({id: 'symbol', type: 'symbol', source: 's', layout, appearances});
        layer.updateTransitions({transition: {}, now: 0});
        layer.recalculate(new EvaluationParameters(0), []);
        return layer.layout;
    }

    function alignments(layout) {
        return ['icon-rotation-alignment', 'icon-pitch-alignment', 'text-rotation-alignment', 'text-pitch-alignment']
            .map(name => layout.get(name));
    }

    test('resolves auto alignments for point placement', () => {
        expect(alignments(symbolLayout({}))).toEqual(['viewport', 'viewport', 'viewport', 'viewport']);
    });

    test('resolves auto alignments for line placement', () => {
        expect(alignments(symbolLayout({'symbol-placement': 'line'}))).toEqual(['map', 'map', 'map', 'map']);
    });

    test('resolves auto pitch alignment from an explicit rotation alignment', () => {
        expect(alignments(symbolLayout({'icon-rotation-alignment': 'map', 'text-rotation-alignment': 'viewport'})))
            .toEqual(['map', 'map', 'viewport', 'viewport']);
    });

    test('defaults text-writing-mode for point placement', () => {
        expect(symbolLayout({}).get('text-writing-mode')).toEqual(['horizontal']);
    });

    test('defaults text-writing-mode for line placement', () => {
        expect(symbolLayout({'symbol-placement': 'line'}).get('text-writing-mode')).toEqual(['horizontal', 'vertical']);
    });

    test('dedupes text-writing-mode', () => {
        expect(symbolLayout({'text-writing-mode': ['vertical', 'horizontal', 'vertical']}).get('text-writing-mode'))
            .toEqual(['vertical', 'horizontal']);
    });

    test('drops text-variable-anchor when the layer has appearances', () => {
        const layout = symbolLayout({'text-variable-anchor': ['top', 'bottom']}, [
            {condition: ['==', ['feature-state', 'hover'], true], properties: {'icon-size': 2}}
        ]);
        expect(layout.get('text-variable-anchor')).toEqual(undefined);
    });

    test('keeps the same values after repeated recalculations', () => {
        const layer = createStyleLayer({id: 'symbol', type: 'symbol', source: 's', layout: {
            'symbol-placement': 'line', 'text-writing-mode': ['vertical', 'vertical']
        }});
        layer.updateTransitions({transition: {}, now: 0});
        layer.recalculate(new EvaluationParameters(0), []);
        const first = [...alignments(layer.layout), layer.layout.get('text-writing-mode')];
        layer.recalculate(new EvaluationParameters(1), []);

        expect([...alignments(layer.layout), layer.layout.get('text-writing-mode')]).toEqual(first);
    });
});

describe('symbol paint overrides', () => {
    function symbolLayer(paint) {
        const layer = createStyleLayer({id: 'symbol', type: 'symbol', source: 's', paint, layout: {
            'text-field': ['format', 'a', {'text-color': 'red'}, 'b', {}]
        }});
        layer.updateTransitions({transition: {}, now: 0});
        return layer;
    }

    function colorsAt(layer, zoom) {
        layer.recalculate(new EvaluationParameters(zoom), []);
        const color = layer.paint.get('text-color');
        return [{textColor: new Color(1, 0, 0, 1)}, {}].map(section => color.evaluate({properties: {}}, {}, undefined, undefined, section));
    }

    test('uses format section overrides with a constant default', () => {
        expect(colorsAt(symbolLayer({'text-color': 'blue'}), 0)).toEqual([new Color(1, 0, 0, 1), new Color(0, 0, 1, 1)]);
    });

    test('uses format section overrides with a zoom-dependent default at each zoom', () => {
        const layer = symbolLayer({'text-color': ['interpolate', ['linear'], ['zoom'], 0, 'blue', 10, 'black']});
        colorsAt(layer, 0);

        expect(colorsAt(layer, 10)).toEqual([new Color(1, 0, 0, 1), new Color(0, 0, 0, 1)]);
    });

    test('keeps a non-overridden property as is', () => {
        const layer = symbolLayer({'text-halo-width': 2});
        layer.recalculate(new EvaluationParameters(0), []);

        expect(layer.paint.get('text-halo-width').constantOr(null)).toEqual(2);
    });
});
