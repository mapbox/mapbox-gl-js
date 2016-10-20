'use strict';

const test = require('mapbox-gl-js-test').test;
const resolveText = require('../../../js/symbol/resolve_text');

test('resolveText', (t) => {
    // Basic.
    t.deepEqual(
        resolveText({properties: {name: 'Test'}}, {'text-field': '{name}'}),
        'Test');
    t.deepEqual(
        resolveText({properties: {name: 'Test'}}, {'text-field': '{name}-suffix'}),
        'Test-suffix');

    // Undefined property.
    t.deepEqual(
        resolveText({properties: {}}, {'text-field': '{name}'}),
        undefined);
    t.deepEqual(
        resolveText({properties: {}}, {'text-field': '{name}-suffix'}),
        '-suffix');

    // Non-latin.
    t.deepEqual(
        resolveText({properties: {city: '서울특별시'}}, {'text-field': '{city}'}),
        '서울특별시');

    // Unicode up to 65535.
    t.deepEqual(
        resolveText({properties: {text: '\ufff0'}}, {'text-field': '{text}'}),
        '\ufff0');
    t.deepEqual(
        resolveText({properties: {text: '\uffff'}}, {'text-field': '{text}'}),
        '\uffff');

    // Non-string values cast to strings.
    t.deepEqual(
        resolveText({properties: {name: 5000}}, {'text-field': '{name}'}),
        '5000');
    t.deepEqual(
        resolveText({properties: {name: -15.5}}, {'text-field': '{name}'}),
        '-15.5');
    t.deepEqual(
        resolveText({properties: {name: true}}, {'text-field': '{name}'}),
        'true');

    // Non-string values cast to strings, with token replacement.
    t.deepEqual(
        resolveText({properties: {name: 5000}}, {'text-field': '{name}-suffix'}),
        '5000-suffix');
    t.deepEqual(
        resolveText({properties: {name: -15.5}}, {'text-field': '{name}-suffix'}),
        '-15.5-suffix');
    t.deepEqual(
        resolveText({properties: {name: true}}, {'text-field': '{name}-suffix'}),
        'true-suffix');

    t.end();
});
