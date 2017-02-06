'use strict';

const t = require('mapbox-gl-js-test').test;
const declass = require('../../../src/style-spec/declass');

t('declass a style, one class', (t) => {
    const style = {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': { base: 2, stops: [[0, 'red'], [22, 'yellow']] },
                'fill-outline-color': 'green'
            },
            'paint.one': {
                'fill-color': { base: 1 },
                'fill-opacity': 0.5
            }
        }]
    };

    const declassed = declass(style, ['one']);

    t.notEqual(declassed, style, 'returns a new style object');
    t.notEqual(declassed.layers, style.layers, 'makes new style.layers array');
    t.notEqual(declassed.layers[0], style.layers[0], 'makes new layer object');
    t.notEqual(declassed.layers[0].paint, style.layers[0].paint, 'makes new paint object');

    t.deepEqual(declassed, {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': { base: 1 },
                'fill-outline-color': 'green',
                'fill-opacity': 0.5
            }
        }]
    });

    t.end();
});

t('declass a style, missing class ==> noop', (t) => {
    const style = {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            }
        }]
    };

    t.deepEqual(declass(style, ['one']), {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            }
        }]
    });

    t.end();
});

t('declass a style, multiple classes', (t) => {
    const style = {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            },
            'paint.one': {
                'fill-color': 'blue',
                'fill-opacity': 0.5
            },
            'paint.two': {
                'fill-opacity': 0.75,
                'fill-something-else': true
            }
        }]
    };

    t.deepEqual(declass(style, ['one', 'two']), {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'blue',
                'fill-outline-color': 'green',
                'fill-opacity': 0.75,
                'fill-something-else': true
            }
        }]
    });

    t.end();
});

t('declassing a style removes paint.CLASS definitions, whether or not they are applied', (t) => {
    const style = {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            },
            'paint.one': {}
        }]
    };

    t.deepEqual(declass(style, ['one']), {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            }
        }]
    });

    t.end();
});
