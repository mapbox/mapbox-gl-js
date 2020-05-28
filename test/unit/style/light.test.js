import {test} from '../../util/test';
import Light from '../../../src/style/light';
import styleSpec from '../../../src/style-spec/reference/latest';
import Color from '../../../src/style-spec/util/color';
import {sphericalToCartesian} from '../../../src/util/util';

const spec = styleSpec.light;

test('Light with defaults', (t) => {
    const light = new Light({});
    light.recalculate({zoom: 0, zoomHistory: {}});

    t.deepEqual(light.properties.get('anchor'), spec.anchor.default);
    t.deepEqual(light.properties.get('position'), sphericalToCartesian(spec.position.default));
    t.deepEqual(light.properties.get('intensity'), spec.intensity.default);
    t.deepEqual(light.properties.get('color'), Color.parse(spec.color.default));

    t.end();
});

test('Light with options', (t) => {
    const light = new Light({
        anchor: 'map',
        position: [2, 30, 30],
        intensity: 1
    });
    light.recalculate({zoom: 0, zoomHistory: {}});

    t.deepEqual(light.properties.get('anchor'), 'map');
    t.deepEqual(light.properties.get('position'), sphericalToCartesian([2, 30, 30]));
    t.deepEqual(light.properties.get('intensity'), 1);
    t.deepEqual(light.properties.get('color'), Color.parse(spec.color.default));

    t.end();
});

test('Light with stops function', (t) => {
    const light = new Light({
        intensity: {
            stops: [[16, 0.2], [17, 0.8]]
        }
    });
    light.recalculate({zoom: 16.5, zoomHistory: {}});

    t.deepEqual(light.properties.get('intensity'), 0.5);

    t.end();
});

test('Light#getLight', (t) => {
    const defaults = {};
    for (const key in spec) {
        defaults[key] = spec[key].default;
    }

    t.deepEqual(new Light(defaults).getLight(), defaults);
    t.end();
});

test('Light#setLight', (t) => {
    t.test('sets light', (t) => {
        const light = new Light({});
        light.setLight({color: 'red', "color-transition": {duration: 3000}});
        light.updateTransitions({transition: true}, {});
        light.recalculate({zoom: 16, zoomHistory: {}, now: 1500});
        t.deepEqual(light.properties.get('color'), new Color(1, 0.5, 0.5, 1));
        t.end();
    });

    t.test('validates by default', (t) => {
        const light = new Light({});
        const lightSpy = t.spy(light, '_validate');
        t.stub(console, 'error');
        light.setLight({color: 'notacolor'});
        light.updateTransitions({transition: false}, {});
        light.recalculate({zoom: 16, zoomHistory: {}, now: 10});
        t.ok(lightSpy.calledOnce);
        t.ok(console.error.calledOnce);
        t.deepEqual(lightSpy.args[0][2], {});
        t.end();
    });

    t.test('respects validation option', (t) => {
        const light = new Light({});

        const lightSpy = t.spy(light, '_validate');
        light.setLight({color: [999]}, {validate: false});
        light.updateTransitions({transition: false}, {});
        light.recalculate({zoom: 16, zoomHistory: {}, now: 10});

        t.ok(lightSpy.calledOnce);
        t.deepEqual(lightSpy.args[0][2], {validate: false});
        t.deepEqual(light.properties.get('color'), [999]);
        t.end();
    });
    t.end();
});
