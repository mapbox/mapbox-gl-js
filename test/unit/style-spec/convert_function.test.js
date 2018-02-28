import { test } from 'mapbox-gl-js-test';
import convertFunction from '../../../src/style-spec/function/convert';

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
            'no tokens',
            3,
            ['to-string', ['get', 'one_token']],
            4,
            ['concat', ['to-string', ['get', 'leading']], ' token'],
            5,
            ['concat', 'trailing ', ['to-string', ['get', 'token']]]
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
