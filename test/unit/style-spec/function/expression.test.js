'use strict';

const test = require('mapbox-gl-js-test').test;
const createFunction = require('../../../../src/style-spec/function/expression');

test('expressions', (t) => {
    t.test('literals', (t) => {
        let f = createFunction(1);
        t.equal(f({}, {}), 1);
        f = createFunction("hi");
        t.equal(f({}, {}), "hi");
        f = createFunction(true);
        t.equal(f({}, {}), true);

        t.end();
    });

    t.test('constants', (t) => {
        let f = createFunction([ 'ln2' ]);
        t.equal(f(), Math.LN2);
        f = createFunction([ 'pi' ]);
        t.equal(f(), Math.PI);
        f = createFunction([ 'e' ]);
        t.equal(f(), Math.E);
        t.end();
    });

    t.test('number_data', (t) => {
        const f = createFunction(['number_data', 'x']);
        t.equal(f({}, { properties: { x: 42 } }), 42);
        t.equal(f({}, { properties: { x: '42' } }), 42);
        t.ok(isNaN(f({}, {})));
        t.end();
    });

    t.test('string_data', (t) => {
        const f = createFunction(['string_data', 'x']);
        t.equal(f({}, { properties: { x: 'hello' } }), 'hello');
        t.equal(f({}, { properties: { x: 42 } }), '42');
        t.equal(f({}, { properties: { x: true } }), 'true');
        t.equal(f({}, {}), '');
        t.end();
    });

    t.test('boolean_data', (t) => {
        const f = createFunction(['boolean_data', 'x']);
        t.equal(f({}, { properties: { x: true } }), true);
        t.equal(f({}, { properties: { x: false } }), false);
        t.equal(f({}, { properties: { x: 'hello' } }), true);
        t.equal(f({}, { properties: { x: 42 } }), true);
        t.equal(f({}, { properties: { x: '' } }), false);
        t.equal(f({}, { properties: { x: 0 } }), false);
        t.equal(f({}, {}), false);
        t.end();
    });

    t.test('has', (t) => {
        const f = createFunction(['has', 'x']);
        t.equal(f({}, { properties: { x: 'foo' } }), true);
        t.equal(f({}, { properties: { x: 0 } }), true);
        t.equal(f({}, { properties: { x: null } }), true);
        t.equal(f({}, { properties: {} }), false);
        t.end();
    });

    t.test('typeof', (t) => {
        const f = createFunction(['typeof', 'x']);
        t.equal(f({}, { properties: { x: 'foo' } }), 'string');
        t.equal(f({}, { properties: { x: 0 } }), 'number');
        t.equal(f({}, { properties: { x: false } }), 'boolean');
        t.equal(f({}, { properties: { x: [] } }), 'array');
        t.equal(f({}, { properties: { x: {} } }), 'object');
        t.equal(f({}, { properties: {} }), 'none');
        t.end();
    });

    t.test('zoom', (t) => {
        const f = createFunction(['zoom']);
        t.equal(f({ zoom: 7 }, {}), 7);
        t.end();
    });

    t.test('basic arithmetic', (t) => {
        let f = createFunction([ '+', 1, 2 ]);
        t.equal(f({}, {}), 3);

        f = createFunction([ '*', 2, ['number_data', 'x'] ]);
        t.equal(f({}, { properties: { x: 42 } }), 84);

        f = createFunction([ '/', [ 'number_data', 'y' ], [ 'number_data', 'x' ] ]);
        t.equal(f({}, { properties: { x: -1, y: 12 } }), -12);

        t.end();
    });

    t.test('numeric comparison', (t) => {
        let f = createFunction(['==', 1, ['number_data', 'x']]);
        t.equal(f({}, {properties: {x: 1}}), true);
        t.equal(f({}, {properties: {x: 2}}), false);
        f = createFunction(['!=', 1, ['number_data', 'x']]);
        t.equal(f({}, {properties: {x: 1}}), false);
        t.equal(f({}, {properties: {x: 2}}), true);
        f = createFunction(['>', 1, ['number_data', 'x']]);
        t.equal(f({}, {properties: {x: 1}}), false);
        t.equal(f({}, {properties: {x: 2}}), false);
        t.equal(f({}, {properties: {x: 0}}), true);
        f = createFunction(['<', 1, ['number_data', 'x']]);
        t.equal(f({}, {properties: {x: 1}}), false);
        t.equal(f({}, {properties: {x: 2}}), true);
        t.equal(f({}, {properties: {x: 0}}), false);
        f = createFunction(['>=', 1, ['number_data', 'x']]);
        t.equal(f({}, {properties: {x: 1}}), true);
        t.equal(f({}, {properties: {x: 2}}), false);
        t.equal(f({}, {properties: {x: 0}}), true);
        f = createFunction(['<=', 1, ['number_data', 'x']]);
        t.equal(f({}, {properties: {x: 1}}), true);
        t.equal(f({}, {properties: {x: 2}}), true);
        t.equal(f({}, {properties: {x: 0}}), false);

        t.throws(() => {
            createFunction(['==', 1, ['string_data', 'x']]);
        });

        t.end();
    });

    t.test('string comparison', (t) => {
        let f = createFunction(['==', 'abc', ['string_data', 'x']]);
        t.equal(f({}, {properties: {x: 'abc'}}), true);
        t.equal(f({}, {properties: {x: 'def'}}), false);
        f = createFunction(['!=', 'abc', ['string_data', 'x']]);
        t.equal(f({}, {properties: {x: 'abc'}}), false);
        t.equal(f({}, {properties: {x: 'def'}}), true);
        f = createFunction(['>', 'abc', ['string_data', 'x']]);
        t.equal(f({}, {properties: {x: 'abc'}}), false);
        t.equal(f({}, {properties: {x: 'def'}}), false);
        t.equal(f({}, {properties: {x: 'aaa'}}), true);
        f = createFunction(['<', 'abc', ['string_data', 'x']]);
        t.equal(f({}, {properties: {x: 'abc'}}), false);
        t.equal(f({}, {properties: {x: 'def'}}), true);
        t.equal(f({}, {properties: {x: 'aaa'}}), false);
        f = createFunction(['>=', 'abc', ['string_data', 'x']]);
        t.equal(f({}, {properties: {x: 'abc'}}), true);
        t.equal(f({}, {properties: {x: 'def'}}), false);
        t.equal(f({}, {properties: {x: 'aaa'}}), true);
        f = createFunction(['<=', 'abc', ['string_data', 'x']]);
        t.equal(f({}, {properties: {x: 'abc'}}), true);
        t.equal(f({}, {properties: {x: 'def'}}), true);
        t.equal(f({}, {properties: {x: 'aaa'}}), false);

        t.throws(() => {
            createFunction(['==', 'abc', ['number_data', 'x']]);
        });

        t.end();
    });

    t.test('!', (t) => {
        const f = createFunction(['!', ['==', ['number_data', 'x'], 1]]);
        t.equal(f({}, {properties: {x: 1}}), false);
        t.end();
    });

    t.test('&&', (t) => {
        const f = createFunction([
            '&&',
            [ '==', [ 'number_data', 'x' ], 1 ],
            [ '==', [ 'string_data', 'y' ], '2' ],
            [ '==', [ 'string_data', 'z' ], '3' ]
        ]);
        t.equal(f({}, {properties: {x: 1, y: 2, z: 3}}), true);
        t.equal(f({}, {properties: {x: 1, y: 0, z: 3}}), false);
        t.end();
    });

    t.test('||', (t) => {
        const f = createFunction([
            '||',
            [ '==', [ 'number_data', 'x' ], 1 ],
            [ '==', [ 'string_data', 'y' ], '2' ],
            [ '==', [ 'string_data', 'z' ], '3' ]
        ]);
        t.equal(f({}, {properties: {x: 1, y: 2, z: 3}}), true);
        t.equal(f({}, {properties: {x: 1, y: 0, z: 3}}), true);
        t.equal(f({}, {properties: {x: 0, y: 0, z: 0}}), false);
        t.end();
    });

    t.test('upcase', (t) => {
        const f = createFunction(['upcase', ['string_data', 'x']]);
        t.equal(f({}, {properties: {x: 'aBc'}}), 'ABC');
        t.end();
    });

    t.test('downcase', (t) => {
        const f = createFunction(['downcase', ['string_data', 'x']]);
        t.equal(f({}, {properties: {x: 'AbC'}}), 'abc');
        t.end();
    });

    t.test('concat', (t) => {
        let f = createFunction(['concat', 'a', 'b', 'c']);

        t.equal(f(), 'abc');

        f = createFunction([
            'concat', ['string_data', 'name'], ' (', ['string_data', 'name_en'], ')'
        ]);

        t.equal(
            f({}, { properties: { name: 'B\'more', 'name_en': 'Baltimore' } }),
            'B\'more (Baltimore)'
        );

        f = createFunction(['concat', true, 1, 'foo']);
        t.equal(f(), 'true1foo');

        t.end();
    });

    t.test('color functions', (t) => {
        const f = createFunction([
            'rgb',
            [ '+', 128, [ '*', 10, ['number_data', 'x'] ] ],
            [ '+', 128, [ '*', 10, ['number_data', 'y'] ] ],
            128
        ]);
        t.equal(f({}, {properties: {x: -5, y: 5}}), 'rgb(78,178,128)');
        t.end();
    });

    t.test('if', (t) => {
        let f = createFunction([
            'if',
            [ 'has', 'x' ],
            [
                '*',
                ['number_data', 'y'],
                ['number_data', 'x']
            ],
            -1
        ]);

        t.equal(f({}, { properties: { x: -1, y: 12 } }), -12);
        t.equal(f({}, { properties: { y: 12 } }), -1);

        t.throws(() => {
            createFunction(['if', ['has', 'x'], 1, 'two']);
        });

        f = createFunction([
            'if', [ '&&', [ 'has', 'name_en' ], ['has', 'name'] ],
            [
                'concat',
                ['string_data', 'name'],
                ' (', ['string_data', 'name_en'], ')'
            ],
            [
                'if', [ '&&', ['has', 'name_fr'], ['has', 'name'] ],
                [
                    'concat',
                    ['string_data', 'name'],
                    ' (', ['string_data', 'name_fr'], ')'
                ],
                [
                    'if', ['has', 'name'],
                    ['string_data', 'name'],
                    'unnamed'
                ]
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

    t.test('math functions require numeric arguments', (t) => {
        t.throws(() => { createFunction(['+', '12', 6]); });
        t.end();
    });

    t.end();
});
