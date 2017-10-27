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
        });
        t.equal(expression.result, 'error');
        t.equal(expression.errors.length, 1);
        t.equal(expression.errors[0].message, '"interpolate" expressions cannot be used with this property');
        t.end();
    });

    t.end();
});
