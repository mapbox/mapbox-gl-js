import { test } from 'mapbox-gl-js-test';
import filter from '../../../src/style-spec/feature_filter';

test('filter', (t) => {
    t.test('expression, zoom', (t) => {
        const f = filter(['>=', ['number', ['get', 'x']], ['zoom']]);
        t.equal(f({zoom: 1}, {properties: {x: 0}}), false);
        t.equal(f({zoom: 1}, {properties: {x: 1.5}}), true);
        t.equal(f({zoom: 1}, {properties: {x: 2.5}}), true);
        t.equal(f({zoom: 2}, {properties: {x: 0}}), false);
        t.equal(f({zoom: 2}, {properties: {x: 1.5}}), false);
        t.equal(f({zoom: 2}, {properties: {x: 2.5}}), true);
        t.end();
    });

    t.test('expression, compare two properties', (t) => {
        t.stub(console, 'warn');
        const f = filter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']]]);
        t.equal(f({zoom: 0}, {properties: {x: 1, y: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {x: '1', y: '1'}}), true);
        t.equal(f({zoom: 0}, {properties: {x: 'same', y: 'same'}}), true);
        t.equal(f({zoom: 0}, {properties: {x: null}}), false);
        t.equal(f({zoom: 0}, {properties: {x: undefined}}), false);
        t.end();
    });

    t.test('expression, any/all', (t) => {
        t.equal(filter(['all'])(), true);
        t.equal(filter(['all', true])(), true);
        t.equal(filter(['all', true, false])(), false);
        t.equal(filter(['all', true, true])(), true);
        t.equal(filter(['any'])(), false);
        t.equal(filter(['any', true])(), true);
        t.equal(filter(['any', true, false])(), true);
        t.equal(filter(['any', false, false])(), false);
        t.end();
    });

    t.test('expression, type error', (t) => {
        t.throws(() => {
            filter(['==', ['number', ['get', 'x']], ['string', ['get', 'y']]]);
        });

        t.throws(() => {
            filter(['number', ['get', 'x']]);
        });

        t.doesNotThrow(() => {
            filter(['boolean', ['get', 'x']]);
        });

        t.end();
    });


    t.test('degenerate', (t) => {
        t.equal(filter()(), true);
        t.equal(filter(undefined)(), true);
        t.equal(filter(null)(), true);
        t.end();
    });

    t.test('==, string', (t) => {
        const f = filter(['==', 'foo', 'bar']);
        t.equal(f({zoom: 0}, {properties: {foo: 'bar'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 'baz'}}), false);
        t.end();
    });

    t.test('==, number', (t) => {
        const f = filter(['==', 'foo', 0]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.equal(f({zoom: 0}, {properties: {}}), false);
        t.end();
    });

    t.test('==, null', (t) => {
        const f = filter(['==', 'foo', null]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.equal(f({zoom: 0}, {properties: {}}), false);
        t.end();
    });

    t.test('==, $type', (t) => {
        const f = filter(['==', '$type', 'LineString']);
        t.equal(f({zoom: 0}, {type: 1}), false);
        t.equal(f({zoom: 0}, {type: 2}), true);
        t.end();
    });

    t.test('==, $id', (t) => {
        const f = filter(['==', '$id', 1234]);

        t.equal(f({zoom: 0}, {id: 1234}), true);
        t.equal(f({zoom: 0}, {id: '1234'}), false);
        t.equal(f({zoom: 0}, {properties: {id: 1234}}), false);

        t.end();
    });

    t.test('!=, string', (t) => {
        const f = filter(['!=', 'foo', 'bar']);
        t.equal(f({zoom: 0}, {properties: {foo: 'bar'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 'baz'}}), true);
        t.end();
    });

    t.test('!=, number', (t) => {
        const f = filter(['!=', 'foo', 0]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.equal(f({zoom: 0}, {properties: {}}), true);
        t.end();
    });

    t.test('!=, null', (t) => {
        const f = filter(['!=', 'foo', null]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.equal(f({zoom: 0}, {properties: {}}), true);
        t.end();
    });

    t.test('!=, $type', (t) => {
        const f = filter(['!=', '$type', 'LineString']);
        t.equal(f({zoom: 0}, {type: 1}), true);
        t.equal(f({zoom: 0}, {type: 2}), false);
        t.end();
    });

    t.test('<, number', (t) => {
        const f = filter(['<', 'foo', 0]);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: -1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '-1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.equal(f({zoom: 0}, {properties: {}}), false);
        t.end();
    });

    t.test('<, string', (t) => {
        const f = filter(['<', 'foo', '0']);
        t.equal(f({zoom: 0}, {properties: {foo: -1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '-1'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.end();
    });

    t.test('<=, number', (t) => {
        const f = filter(['<=', 'foo', 0]);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: -1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '-1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.equal(f({zoom: 0}, {properties: {}}), false);
        t.end();
    });

    t.test('<=, string', (t) => {
        const f = filter(['<=', 'foo', '0']);
        t.equal(f({zoom: 0}, {properties: {foo: -1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '-1'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.end();
    });

    t.test('>, number', (t) => {
        const f = filter(['>', 'foo', 0]);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: -1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '-1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.equal(f({zoom: 0}, {properties: {}}), false);
        t.end();
    });

    t.test('>, string', (t) => {
        const f = filter(['>', 'foo', '0']);
        t.equal(f({zoom: 0}, {properties: {foo: -1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '1'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '-1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.end();
    });

    t.test('>=, number', (t) => {
        const f = filter(['>=', 'foo', 0]);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: -1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '-1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.equal(f({zoom: 0}, {properties: {}}), false);
        t.end();
    });

    t.test('>=, string', (t) => {
        const f = filter(['>=', 'foo', '0']);
        t.equal(f({zoom: 0}, {properties: {foo: -1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '1'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '-1'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.end();
    });

    t.test('in, degenerate', (t) => {
        const f = filter(['in', 'foo']);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.end();
    });

    t.test('in, string', (t) => {
        const f = filter(['in', 'foo', '0']);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.equal(f({zoom: 0}, {properties: {}}), false);
        t.end();
    });

    t.test('in, number', (t) => {
        const f = filter(['in', 'foo', 0]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.end();
    });

    t.test('in, null', (t) => {
        const f = filter(['in', 'foo', null]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.end();
    });

    t.test('in, multiple', (t) => {
        const f = filter(['in', 'foo', 0, 1]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 3}}), false);
        t.end();
    });

    t.test('in, large_multiple', (t) => {
        const values = Array.apply(null, {length: 2000}).map(Number.call, Number);
        values.reverse();
        const f = filter(['in', 'foo'].concat(values));
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1999}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 2000}}), false);
        t.end();
    });

    t.test('in, large_multiple, heterogeneous', (t) => {
        const values = Array.apply(null, {length: 2000}).map(Number.call, Number);
        values.push('a');
        values.unshift('b');
        const f = filter(['in', 'foo'].concat(values));
        t.equal(f({zoom: 0}, {properties: {foo: 'b'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 'a'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1999}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 2000}}), false);
        t.end();
    });

    t.test('in, $type', (t) => {
        const f = filter(['in', '$type', 'LineString', 'Polygon']);
        t.equal(f({zoom: 0}, {type: 1}), false);
        t.equal(f({zoom: 0}, {type: 2}), true);
        t.equal(f({zoom: 0}, {type: 3}), true);

        const f1 = filter(['in', '$type', 'Polygon', 'LineString', 'Point']);
        t.equal(f1({zoom: 0}, {type: 1}), true);
        t.equal(f1({zoom: 0}, {type: 2}), true);
        t.equal(f1({zoom: 0}, {type: 3}), true);

        t.end();
    });

    t.test('!in, degenerate', (t) => {
        const f = filter(['!in', 'foo']);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.end();
    });

    t.test('!in, string', (t) => {
        const f = filter(['!in', 'foo', '0']);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.equal(f({zoom: 0}, {properties: {}}), true);
        t.end();
    });

    t.test('!in, number', (t) => {
        const f = filter(['!in', 'foo', 0]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.end();
    });

    t.test('!in, null', (t) => {
        const f = filter(['!in', 'foo', null]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.end();
    });

    t.test('!in, multiple', (t) => {
        const f = filter(['!in', 'foo', 0, 1]);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 3}}), true);
        t.end();
    });

    t.test('!in, large_multiple', (t) => {
        const f = filter(['!in', 'foo'].concat(Array.apply(null, {length: 2000}).map(Number.call, Number)));
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1999}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 2000}}), true);
        t.end();
    });

    t.test('!in, $type', (t) => {
        const f = filter(['!in', '$type', 'LineString', 'Polygon']);
        t.equal(f({zoom: 0}, {type: 1}), true);
        t.equal(f({zoom: 0}, {type: 2}), false);
        t.equal(f({zoom: 0}, {type: 3}), false);
        t.end();
    });

    t.test('any', (t) => {
        const f1 = filter(['any']);
        t.equal(f1({zoom: 0}, {properties: {foo: 1}}), false);

        const f2 = filter(['any', ['==', 'foo', 1]]);
        t.equal(f2({zoom: 0}, {properties: {foo: 1}}), true);

        const f3 = filter(['any', ['==', 'foo', 0]]);
        t.equal(f3({zoom: 0}, {properties: {foo: 1}}), false);

        const f4 = filter(['any', ['==', 'foo', 0], ['==', 'foo', 1]]);
        t.equal(f4({zoom: 0}, {properties: {foo: 1}}), true);

        t.end();
    });

    t.test('all', (t) => {
        const f1 = filter(['all']);
        t.equal(f1({zoom: 0}, {properties: {foo: 1}}), true);

        const f2 = filter(['all', ['==', 'foo', 1]]);
        t.equal(f2({zoom: 0}, {properties: {foo: 1}}), true);

        const f3 = filter(['all', ['==', 'foo', 0]]);
        t.equal(f3({zoom: 0}, {properties: {foo: 1}}), false);

        const f4 = filter(['all', ['==', 'foo', 0], ['==', 'foo', 1]]);
        t.equal(f4({zoom: 0}, {properties: {foo: 1}}), false);

        t.end();
    });

    t.test('none', (t) => {
        const f1 = filter(['none']);
        t.equal(f1({zoom: 0}, {properties: {foo: 1}}), true);

        const f2 = filter(['none', ['==', 'foo', 1]]);
        t.equal(f2({zoom: 0}, {properties: {foo: 1}}), false);

        const f3 = filter(['none', ['==', 'foo', 0]]);
        t.equal(f3({zoom: 0}, {properties: {foo: 1}}), true);

        const f4 = filter(['none', ['==', 'foo', 0], ['==', 'foo', 1]]);
        t.equal(f4({zoom: 0}, {properties: {foo: 1}}), false);

        t.end();
    });

    t.test('has', (t) => {
        const f = filter(['has', 'foo']);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.equal(f({zoom: 0}, {properties: {}}), false);
        t.end();
    });

    t.test('!has', (t) => {
        const f = filter(['!has', 'foo']);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.equal(f({zoom: 0}, {properties: {}}), true);
        t.end();
    });

    t.end();
});
