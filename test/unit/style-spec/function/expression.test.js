'use strict';

const test = require('mapbox-gl-js-test').test;
const createFunction = require('../../../../src/style-spec/function/expression');

test('expressions', (t) => {
    t.test('constant', (t) => {
        let f = createFunction(1);
        t.equal(f({}, {}), 1);
        f = createFunction("hi");
        t.equal(f({}, {}), "hi");
        f = createFunction(true);
        t.equal(f({}, {}), true);

        t.end();
    });

    t.test('feature property lookup', (t) => {
        let f = createFunction({ ref: 'feature', key: 'x', defaultValue: 12 });
        t.equal(f({}, {}), 12);
        t.equal(f({}, { properties: { x: 42 } }), 42);

        f = createFunction({ ref: 'feature', key: 'x' });
        t.equal(f({}, {}), 0);
        t.end();
    });

    t.test('map property lookup', (t) => {
        const f = createFunction({ ref: 'map', key: 'zoom' });
        t.equal(f({ zoom: 7 }, {}), 7);
        t.end();
    });

    t.test('basic arithmetic', (t) => {
        let f = createFunction([ '+', 1, 2 ]);
        t.equal(f({}, {}), 3);

        f = createFunction([
            '*', 2,
            { ref: 'feature', key: 'x' }
        ]);
        t.equal(f({}, { properties: { x: 42 } }), 84);

        f = createFunction([
            '/',
            { ref: 'feature', key: 'y' },
            { ref: 'feature', key: 'x' }
        ]);
        t.equal(f({}, { properties: { x: -1, y: 12 } }), -12);

        t.end();
    });

    t.test('concatenate strings', (t) => {
        let f = createFunction(['concat', 'a', 'b', 'c']);

        t.equal(f(), 'abc');

        f = createFunction([
            'concat',
            {ref: 'feature', key: 'name'},
            ' (', {ref: 'feature', key: 'name_en'}, ')'
        ]);

        t.equal(
            f({}, { properties: { name: 'B\'more', 'name_en': 'Baltimore' } }),
            'B\'more (Baltimore)'
        );

        t.end();
    });

    t.test('conditional', (t) => {
        let f = createFunction([
            'if',
            [ 'has', 'x' ],
            [
                '*',
                { ref: 'feature', key: 'y' },
                { ref: 'feature', key: 'x' }
            ],
            'NONE'
        ]);

        t.equal(f({}, { properties: { x: -1, y: 12 } }), -12);
        t.equal(f({}, { properties: { y: 12 } }), 'NONE');

        f = createFunction([
            'if', [ 'all', [ 'has', 'name_en' ], ['has', 'name'] ],
            [
                'concat',
                {ref: 'feature', key: 'name'},
                ' (', {ref: 'feature', key: 'name_en'}, ')'
            ],
            [
                'if', [ 'all', ['has', 'name_fr'], ['has', 'name'] ],
                [
                    'concat',
                    {ref: 'feature', key: 'name'},
                    ' (', {ref: 'feature', key: 'name_fr'}, ')'
                ],
                {ref: 'feature', key: 'name', defaultValue: 'unnamed'}
            ]
        ]);

        t.equal(f({}, { properties: { name: 'Foo' } }), 'Foo');
        t.equal(f({}, { properties: { name: 'Illyphay', 'name_en': 'Philly' } }),
            'Illyphay (Philly)');
        t.equal(f({}, { properties: { name: 'Arispay', 'name_fr': 'Paris' } }),
            'Arispay (Paris)');
        t.equal(f({}, {}), 'unnamed');

        t.end();
    });

    t.end();
});
