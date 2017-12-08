'use strict';

const test = require('mapbox-gl-js-test').test;
const {convertFunction} = require('../../../src/style-spec/expression/convert_function');

test('convertFunction', (t) => {
    t.test('feature-constant text-field with token replacement', (t) => {
        const functionValue = {
            stops: [
                [0, 'my name is {name}.'],
                [1, '{a} {b} {c}'],
                [2, 'no tokens'],
                [3, '{one_token}'],
                [4, '{leading} token'],
                [5, 'trailing {token}']
            ]
        };

        const expression = convertFunction(functionValue, {
            type: 'string',
            function: 'piecewise-constant',
            tokens: true
        });
        t.deepEqual(expression, [
            'step',
            ['zoom'],
            [
                'concat',
                'my name is ',
                ['case', ['has', 'name'], ['to-string', ['get', 'name']], ''],
                '.'
            ],
            1,
            [
                'concat',
                ['case', ['has', 'a'], ['to-string', ['get', 'a']], ''],
                ' ',
                ['case', ['has', 'b'], ['to-string', ['get', 'b']], ''],
                ' ',
                ['case', ['has', 'c'], ['to-string', ['get', 'c']], '']
            ],
            2,
            'no tokens',
            3,
            ['case', ['has', 'one_token'], ['to-string', ['get', 'one_token']], ''],
            4,
            ['concat', ['case', ['has', 'leading'], ['to-string', ['get', 'leading']], ''], ' token'],
            5,
            ['concat', 'trailing ', ['case', ['has', 'token'], ['to-string', ['get', 'token']], '']]
        ]);

        t.end();
    });

    t.test('duplicate step function stops', (t) => {
        const functionValue = {
            stops: [
                [0, 'a'],
                [1, 'b'],
                [1, 'c'],
                [2, 'd']
            ]
        };

        const expression = convertFunction(functionValue, {
            type: 'string',
            function: 'piecewise-constant'
        });
        t.deepEqual(expression, [
            'step',
            ['zoom'],
            'a',
            1,
            'b',
            2,
            'd'
        ]);

        t.end();
    });

    t.test('duplicate interpolate function stops', (t) => {
        const functionValue = {
            stops: [
                [0, 'a'],
                [1, 'b'],
                [1, 'c'],
                [2, 'd']
            ]
        };

        const expression = convertFunction(functionValue, {
            type: 'number',
            function: 'interpolated'
        });
        t.deepEqual(expression, [
            'interpolate',
            ['exponential', 1],
            ['zoom'],
            0,
            'a',
            1,
            'b',
            2,
            'd'
        ]);

        t.end();
    });

    t.end();
});
