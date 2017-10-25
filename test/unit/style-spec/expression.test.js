'use strict';

const test = require('mapbox-gl-js-test').test;
const {createExpression} = require('../../../src/style-spec/expression');

test('createExpression', (t) => {
    test('require piecewise-constant zoom curves to use "step" interpolation', (t) => {
        const expression = createExpression([
            'curve', ['linear'], ['zoom'], 0, 0, 10, 10
        ], {
            type: 'number',
            function: 'piecewise-constant'
        });
        t.equal(expression.result, 'error');
        t.equal(expression.errors.length, 1);
        t.equal(expression.errors[0].message, 'interpolation type must be "step" for this property');
        t.end();
    });

    t.end();
});
