'use strict';

const test = require('mapbox-gl-js-test').test;
const {createExpression} = require('../../../src/style-spec/expression');

test('createExpression', (t) => {
    test('prohibits piecewise-constant properties from using an "interpolate" expression', (t) => {
        const expression = createExpression([
            'interpolate', ['linear'], ['zoom'], 0, 0, 10, 10
        ], {
            type: 'number',
            function: 'piecewise-constant'
        }, 'property');
        t.equal(expression.result, 'error');
        t.equal(expression.errors.length, 1);
        t.equal(expression.errors[0].message, '"interpolate" expressions cannot be used with this property');
        t.end();
    });

    t.end();
});

test('evaluate expression', (t) => {
    test('warns and falls back to default for invalid enum values', (t) => {
        const expression = createExpression([ 'get', 'x' ], {
            type: 'enum',
            values: {a: {}, b: {}, c: {}},
            default: 'a',
            'property-function': true
        }, 'property');

        t.stub(console, 'warn');

        t.equal(expression.result, 'success');

        t.equal(expression.evaluate({}, { properties: {x: 'b'} }), 'b');
        t.equal(expression.evaluate({}, { properties: {x: 'invalid'} }), 'a');
        t.ok(console.warn.calledWith(`Expected value to be one of "a", "b", "c", but found "invalid" instead.`));

        t.end();
    });

    t.end();
});
