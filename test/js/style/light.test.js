'use strict';

const test = require('mapbox-gl-js-test').test;
const Light = require('../../../js/style/light');
const spec = require('../../../js/style/style_spec').light;

test('Light', (t) => {
    t.test('creates default light with no options', (t) => {
        const light = new Light({});

        for (const key in spec) {
            t.deepEqual(light.getLightProperty(key), spec[key].default);
        }

        t.end();
    });

    t.test('instantiates light correctly with options', (t) => {
        const light = new Light({
            anchor: 'map',
            position: [2, 30, 30],
            intensity: 1
        });

        t.equal(light.getLightProperty('anchor'), 'map');
        t.deepEqual(light.getLightProperty('position'), [2, 30, 30]);
        t.equal(light.getLightProperty('intensity'), 1);
        t.equal(light.getLightProperty('color'), '#ffffff');

        t.end();
    });

    t.end();
});

test('Light#set', (t) => {
    const light = new Light({});

    t.equal(light.getLightProperty('color'), '#ffffff');

    light.set({ color: 'blue' });

    t.equal(light.getLightProperty('color'), 'blue');

    t.end();
});

test('Light#getLight', (t) => {
    const light = new Light({});

    const defaults = {};
    for (const key in spec) {
        defaults[key] = spec[key].default;
    }

    t.deepEqual(light.getLight(), defaults);
    t.end();
});

test('Light#getLightProperty', (t) => {
    const light = new Light({
        intensity: {
            stops: [[16, 0.2], [17, 0.8]]
        },
        color: 'red'
    });
    light.updateLightTransitions({ transition: true }, null, createAnimationLoop());

    t.deepEqual(light.getLightProperty('intensity'), { stops: [[16, 0.2], [17, 0.8]] });
    t.equal(light.getLightProperty('color'), 'red');
    t.deepEqual(light.getLightProperty('position', { zoom: 16.5 }), [1.15, 210, 30]);

    t.end();
});

test('Light#getLightValue', (t) => {
    const light = new Light({
        intensity: {
            stops: [[16, 0.2], [17, 0.8]]
        },
        color: 'red'
    });
    light.updateLightTransitions({ transition: true }, null, createAnimationLoop());

    t.equal(light.getLightValue('intensity', { zoom: 16.5 }), 0.5);
    t.deepEqual(light.getLightValue('color', { zoom: 16.5 }), [1, 0, 0, 1]);
    t.deepEqual(light.getLightValue('position', { zoom: 16.5 }), { x: 0.2875, y: -0.4979646071760521, z: 0.9959292143521045 });

    t.end();
});

test('Light#setLight', (t) => {
    const light = new Light({});
    light.setLight({ color: 'red', "color-transition": { duration: 3000 }});
    light.updateLightTransitions({ transition: true }, null, createAnimationLoop());

    t.deepEqual(light.getLightValue('color', { zoom: 16 }), [1, 0, 0, 1]);

    t.end();
});

test('Light#recalculate', (t) => {
    const light = new Light({
        intensity: {
            stops: [[16, 0.2], [17, 0.8]]
        }
    });
    light.updateLightTransitions({ transition: true }, null, createAnimationLoop());

    light.recalculate(16, null);

    t.equal(light.calculated.intensity, 0.2);

    light.recalculate(17, null);

    t.equal(light.calculated.intensity, 0.8);

    t.end();
});

function createAnimationLoop() {
    return {
        set: function() {},
        cancel: function() {}
    };
}
