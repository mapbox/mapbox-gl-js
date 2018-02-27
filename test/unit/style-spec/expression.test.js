'use strict';

import { test } from 'mapbox-gl-js-test';
import { createPropertyExpression } from '../../../src/style-spec/expression';

test('createPropertyExpression', (t) => {
    test('prohibits piecewise-constant properties from using an "interpolate" expression', (t) => {
        const {result, value} = createPropertyExpression([
            'interpolate', ['linear'], ['zoom'], 0, 0, 10, 10
        ], {
            type: 'number',
            function: 'piecewise-constant'
        });
        t.equal(result, 'error');
        t.equal(value.length, 1);
        t.equal(value[0].message, '"interpolate" expressions cannot be used with this property');
        t.end();
    });

    t.end();
});

test('evaluate expression', (t) => {
    test('warns and falls back to default for invalid enum values', (t) => {
        const {value} = createPropertyExpression([ 'get', 'x' ], {
            type: 'enum',
            values: {a: {}, b: {}, c: {}},
            default: 'a',
            'property-function': true
        });

        t.stub(console, 'warn');

        t.equal(value.kind, 'source');

        t.equal(value.evaluate({}, { properties: {x: 'b'} }), 'b');
        t.equal(value.evaluate({}, { properties: {x: 'invalid'} }), 'a');
        t.ok(console.warn.calledWith(`Expected value to be one of "a", "b", "c", but found "invalid" instead.`));

        t.end();
    });

    t.end();
});
