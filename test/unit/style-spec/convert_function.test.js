'use strict';

const test = require('mapbox-gl-js-test').test;
const convertFunction = require('../../../src/style-spec/function/convert');

test('convertFunction', (t) => {
    t.test('feature-constant text-field with token replacement', (t) => {
        const functionValue = {
            stops: [
                [0, 'my name is {name}.'],
                [1, '{a} {b} {c}'],
                [2, 'no tokens']
            ]
        };

        const expression = convertFunction(functionValue, {
            type: 'string',
            function: 'piecewise-constant'
        }, 'text-field');
        t.deepEqual(expression, [
            'step',
            ['zoom'],
            [
                'concat',
                'my name is ',
                ['to-string', ['get', 'name']],
                '.'
            ],
            1,
            [
                'concat',
                ['to-string', ['get', 'a']],
                ' ',
                ['to-string', ['get', 'b']],
                ' ',
                ['to-string', ['get', 'c']]
            ],
            2,
            'no tokens'
        ]);

        t.end();
    });

    t.end();
});
