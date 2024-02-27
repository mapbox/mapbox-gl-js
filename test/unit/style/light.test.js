import {describe, test, expect, vi} from "../../util/vitest.js";
import {sphericalPositionToCartesian} from '../../../src/util/util.js';
import Light from '../../../src/style/light.js';
import styleSpec from '../../../src/style-spec/reference/latest.js';
import Color from '../../../src/style-spec/util/color.js';

const spec = styleSpec.light;

test('Light with defaults', () => {
    const light = new Light({});
    light.recalculate({zoom: 0});

    expect(light.properties.get('anchor')).toEqual(spec.anchor.default);
    expect(light.properties.get('position')).toEqual(sphericalPositionToCartesian(spec.position.default));
    expect(light.properties.get('intensity')).toEqual(spec.intensity.default);
    expect(light.properties.get('color')).toEqual(Color.parse(spec.color.default));
});

test('Light with options', () => {
    const light = new Light({
        anchor: 'map',
        position: [2, 30, 30],
        intensity: 1
    });
    light.recalculate({zoom: 0});

    expect(light.properties.get('anchor')).toEqual('map');
    expect(light.properties.get('position')).toEqual(sphericalPositionToCartesian([2, 30, 30]));
    expect(light.properties.get('intensity')).toEqual(1);
    expect(light.properties.get('color')).toEqual(Color.parse(spec.color.default));
});

test('Light with stops function', () => {
    const light = new Light({
        intensity: {
            stops: [[16, 0.2], [17, 0.8]]
        }
    });
    light.recalculate({zoom: 16.5});

    expect(light.properties.get('intensity')).toEqual(0.5);
});

test('Light#getLight', () => {
    const defaults = {};
    for (const key in spec) {
        defaults[key] = spec[key].default;
    }

    expect(new Light(defaults).getLight()).toEqual(defaults);
});

describe('Light#setLight', () => {
    test('sets light', () => {
        const light = new Light({});
        light.setLight({color: 'red', "color-transition": {duration: 3000}}, "flat");
        light.updateTransitions({transition: true}, {});
        light.recalculate({zoom: 16, now: 1500});
        expect(light.properties.get('color')).toEqual(new Color(1, 0.5, 0.5, 1));
    });

    test('validates by default', () => {
        const light = new Light({});
        const lightSpy = vi.spyOn(light, '_validate');
        vi.spyOn(console, 'error').mockImplementation(() => {});
        light.setLight({color: 'notacolor'}, "flat");
        light.updateTransitions({transition: false}, {});
        light.recalculate({zoom: 16, now: 10});
        expect(lightSpy).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(lightSpy.mock.calls[0][2]).toEqual({});
    });

    test('respects validation option', () => {
        const light = new Light({});

        const lightSpy = vi.spyOn(light, '_validate');
        light.setLight({color: 999}, "flat", {validate: false});
        light.updateTransitions({transition: false}, {});
        light.recalculate({zoom: 16, now: 10});

        expect(lightSpy).toHaveBeenCalledTimes(1);
        expect(lightSpy.mock.calls[0][2]).toEqual({validate: false});
        expect(light.properties.get('color')).toEqual(999);
    });
});
