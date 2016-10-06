'use strict';

var test = require('tap').test;
var Light = require('../../../js/style/light');
var spec = require('../../../js/style/style_spec').$root.light;

test('Light', function(t) {
    t.test('creates default light with no options', function (t) {
        var light = new Light({});

        for (var key in spec) {
            t.deepEqual(light.getLightProperty(key), spec[key].default);
        }

        t.end();
    });

    t.test('instantiates light correctly with options', function(t) {
        var light = new Light({
            anchor: 'map',
            direction: [2, 30, 30],
            intensity: 1
        });

        t.equal(light.getLightProperty('anchor'), 'map');
        t.deepEqual(light.getLightProperty('direction'), [2, 30, 30]);
        t.equal(light.getLightProperty('intensity'), 1);
        t.equal(light.getLightProperty('color'), '#ffffff');

        t.end();
    });

    t.end();
});

test('Light#set', function(t) {
    var light = new Light({});

    t.equal(light.getLightProperty('color'), '#ffffff');

    light.set({ color: 'blue' });

    t.equal(light.getLightProperty('color'), 'blue');

    t.end();
});

test('Light#getLight', function(t) {
    var light = new Light({});

    var defaults = {};
    for (var key in spec) {
        defaults[key] = spec[key].default;
    }

    t.deepEqual(light.getLight(), defaults);
    t.end();
});

test('Light#getLightProperty', function(t) {
    var light = new Light({
        intensity: {
            stops: [[16, 0.2], [17, 0.8]]
        },
        color: 'red'
    });
    light.updateLightTransitions({ transition: true }, null, createAnimationLoop());

    t.deepEqual(light.getLightProperty('intensity'), { stops: [[16, 0.2], [17, 0.8]] });
    t.equal(light.getLightProperty('color'), 'red');
    t.deepEqual(light.getLightProperty('direction', { zoom: 16.5 }), [1.15, 210, 30]);

    t.end();
});

test('Light#getLightValue', function(t) {
    var light = new Light({
        intensity: {
            stops: [[16, 0.2], [17, 0.8]]
        },
        color: 'red'
    });
    light.updateLightTransitions({ transition: true }, null, createAnimationLoop());

    t.equal(light.getLightValue('intensity', { zoom: 16.5 }), 0.5);
    t.deepEqual(light.getLightValue('color', { zoom: 16.5 }), [1, 0, 0, 1]);
    t.deepEqual(light.getLightValue('direction', { zoom: 16.5 }), { x: 0.2875, y: -0.4979646071760521, z: 0.9959292143521045 });

    t.end();
});

test('Light#setLight', function(t) {
    var light = new Light({});
    light.setLight({ color: 'red', "color-transition": { duration: 3000 }});
    light.updateLightTransitions({ transition: true }, null, createAnimationLoop());

    t.deepEqual(light.getLightValue('color', { zoom: 16 }), [1, 0, 0, 1]);

    t.end();
});

test('Light#recalculate', function(t) {
    var light = new Light({
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
