'use strict';

const test = require('mapbox-gl-js-test').test;
const StyleLayer = require('../../../src/style/style_layer');
const resolveText = require('../../../src/symbol/resolve_text');

function createLayer(layout) {
    return new StyleLayer({
        id: 'my-layer',
        type: 'symbol',
        layout: layout
    });
}

test('resolveText', (t) => {
    // Basic.
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}'}), { zoom: 0 }, {name: 'Test'}),
        'Test');
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}-suffix'}), { zoom: 0 }, {name: 'Test'}),
        'Test-suffix');

    // Undefined property.
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}'}), { zoom: 0 }, {}), undefined);
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}-suffix'}), { zoom: 0 }, {}), '-suffix');

    // Non-latin.
    t.deepEqual(
        resolveText(createLayer({'text-field': '{city}'}), { zoom: 0 }, {city: '서울특별시'}),
        '서울특별시');

    // Unicode up to 65535.
    t.deepEqual(
        resolveText(createLayer({'text-field': '{text}'}), { zoom: 0 }, {text: '\ufff0'}),
        '\ufff0');
    t.deepEqual(
        resolveText(createLayer({'text-field': '{text}'}), { zoom: 0 }, {text: '\uffff'}),
        '\uffff');

    // Non-string values cast to strings.
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}'}), { zoom: 0 }, {name: 5000}),
        '5000');
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}'}), { zoom: 0 }, {name: -15.5}),
        '-15.5');
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}'}), { zoom: 0 }, {name: true}),
        'true');

    // Non-string values cast to strings, with token replacement.
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}-suffix'}), { zoom: 0 }, {name: 5000}),
        '5000-suffix');
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}-suffix'}), { zoom: 0 }, {name: -15.5}),
        '-15.5-suffix');
    t.deepEqual(
        resolveText(createLayer({'text-field': '{name}-suffix'}), { zoom: 0 }, {name: true}),
        'true-suffix');

    t.end();
});
