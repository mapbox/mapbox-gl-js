import {test} from '../../util/test';
import {default as createFilter, isExpressionFilter} from '../../../src/style-spec/feature_filter';

import convertFilter from '../../../src/style-spec/feature_filter/convert';
import Point from '@mapbox/point-geometry';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate';
import EXTENT from '../../../src/data/extent';

test('filter', t => {
    t.test('expression, zoom', (t) => {
        const f = createFilter(['>=', ['number', ['get', 'x']], ['zoom']]).filter;
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
        const f = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']]]).filter;
        t.equal(f({zoom: 0}, {properties: {x: 1, y: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {x: '1', y: '1'}}), true);
        t.equal(f({zoom: 0}, {properties: {x: 'same', y: 'same'}}), true);
        t.equal(f({zoom: 0}, {properties: {x: null}}), false);
        t.equal(f({zoom: 0}, {properties: {x: undefined}}), false);
        t.end();
    });

    t.test('expression, collator comparison', (t) => {
        const caseSensitive = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']], ['collator', {'case-sensitive': true}]]).filter;
        t.equal(caseSensitive({zoom: 0}, {properties: {x: 'a', y: 'b'}}), false);
        t.equal(caseSensitive({zoom: 0}, {properties: {x: 'a', y: 'A'}}), false);
        t.equal(caseSensitive({zoom: 0}, {properties: {x: 'a', y: 'a'}}), true);

        const caseInsensitive = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']], ['collator', {'case-sensitive': false}]]).filter;
        t.equal(caseInsensitive({zoom: 0}, {properties: {x: 'a', y: 'b'}}), false);
        t.equal(caseInsensitive({zoom: 0}, {properties: {x: 'a', y: 'A'}}), true);
        t.equal(caseInsensitive({zoom: 0}, {properties: {x: 'a', y: 'a'}}), true);
        t.end();
    });

    t.test('expression, any/all', (t) => {
        t.equal(createFilter(['all']).filter(), true);
        t.equal(createFilter(['all', true]).filter(), true);
        t.equal(createFilter(['all', true, false]).filter(), false);
        t.equal(createFilter(['all', true, true]).filter(), true);
        t.equal(createFilter(['any']).filter(), false);
        t.equal(createFilter(['any', true]).filter(), true);
        t.equal(createFilter(['any', true, false]).filter(), true);
        t.equal(createFilter(['any', false, false]).filter(), false);
        t.end();
    });

    t.test('expression, type error', (t) => {
        t.throws(() => {
            createFilter(['==', ['number', ['get', 'x']], ['string', ['get', 'y']]]);
        });

        t.throws(() => {
            createFilter(['number', ['get', 'x']]);
        });

        t.doesNotThrow(() => {
            createFilter(['boolean', ['get', 'x']]);
        });

        t.end();
    });

    t.test('expression, within', (t) => {
        const  getPointFromLngLat = (lng, lat, canonical) => {
            const p = MercatorCoordinate.fromLngLat({lng, lat}, 0);
            const tilesAtZoom = Math.pow(2, canonical.z);
            return new Point(
                (p.x * tilesAtZoom - canonical.x) * EXTENT,
                (p.y * tilesAtZoom - canonical.y) * EXTENT);
        };
        const withinFilter =  createFilter(['within', {'type': 'Polygon', 'coordinates': [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]]}]);
        t.equal(withinFilter.needGeometry, true);
        const canonical = {z: 3, x: 3, y:3};
        t.equal(withinFilter.filter({zoom: 3}, {type: 1, geometry: [[getPointFromLngLat(2, 2, canonical)]]}, canonical), true);
        t.equal(withinFilter.filter({zoom: 3}, {type: 1, geometry: [[getPointFromLngLat(6, 6, canonical)]]}, canonical), false);
        t.equal(withinFilter.filter({zoom: 3}, {type: 1, geometry: [[getPointFromLngLat(5, 5, canonical)]]}, canonical), false);
        t.equal(withinFilter.filter({zoom: 3}, {type: 2, geometry: [[getPointFromLngLat(2, 2, canonical), getPointFromLngLat(3, 3, canonical)]]}, canonical), true);
        t.equal(withinFilter.filter({zoom: 3}, {type: 2, geometry: [[getPointFromLngLat(6, 6, canonical), getPointFromLngLat(2, 2, canonical)]]}, canonical), false);
        t.equal(withinFilter.filter({zoom: 3}, {type: 2, geometry: [[getPointFromLngLat(5, 5, canonical), getPointFromLngLat(2, 2, canonical)]]}, canonical), false);
        t.end();
    });

    legacyFilterTests(t, createFilter);

    t.end();
});

test('legacy filter detection', t => {
    t.test('definitely legacy filters', t => {
        // Expressions with more than two arguments.
        t.notOk(isExpressionFilter(["in", "color", "red", "blue"]));

        // Expressions where the second argument is not a string or array.
        t.notOk(isExpressionFilter(["in", "value", 42]));
        t.notOk(isExpressionFilter(["in", "value", true]));
        t.end();
    });

    t.test('ambiguous value', t => {
        // Should err on the side of reporting as a legacy filter. Style authors can force filters
        // by using a literal expression as the first argument.
        t.notOk(isExpressionFilter(["in", "color", "red"]));
        t.end();
    });

    t.test('definitely expressions', t => {
        t.ok(isExpressionFilter(["in", ["get", "color"], "reddish"]));
        t.ok(isExpressionFilter(["in", ["get", "color"], ["red", "blue"]]));
        t.ok(isExpressionFilter(["in", 42, 42]));
        t.ok(isExpressionFilter(["in", true, true]));
        t.ok(isExpressionFilter(["in", "red", ["get", "colors"]]));
        t.end();
    });

    t.end();
});

test('convert legacy filters to expressions', t => {
    t.beforeEach(done => {
        t.stub(console, 'warn');
        done();
    });

    legacyFilterTests(t, (f) => {
        const converted = convertFilter(f);
        return createFilter(converted);
    });

    t.test('mimic legacy type mismatch semantics', (t) => {
        const filter = ["any",
            ["all", [">", "y", 0], [">", "y", 0]],
            [">", "x", 0]
        ];

        const converted = convertFilter(filter);
        const f = createFilter(converted).filter;

        t.equal(f({zoom: 0}, {properties: {x: 0, y: 1, z: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {x: 1, y: 0, z: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {x: 0, y: 0, z: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {x: null, y: 1, z: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {x: 1, y: null, z: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {x: null, y: null, z: 1}}), false);
        t.end();
    });

    t.test('flattens nested, single child all expressions', (t) => {
        const filter = [
            "all",
            [
                "in",
                "$type",
                "Polygon",
                "LineString",
                "Point"
            ],
            [
                "all",
                ["in", "type", "island"]
            ]
        ];

        const expected = [
            "all",
            [
                "match",
                ["geometry-type"],
                ["LineString", "Point", "Polygon"],
                true,
                false
            ],
            [
                "match",
                ["get", "type"],
                ["island"],
                true,
                false
            ]
        ];

        const converted = convertFilter(filter);
        t.same(converted, expected);
        t.end();
    });

    t.test('removes duplicates when outputting match expressions', (t) => {
        const filter = [
            "in",
            "$id",
            1,
            2,
            3,
            2,
            1
        ];

        const expected = [
            "match",
            ["id"],
            [1, 2, 3],
            true,
            false
        ];

        const converted = convertFilter(filter);
        t.same(converted, expected);
        t.end();
    });

    t.end();
});

function legacyFilterTests(t, createFilterExpr) {
    t.test('degenerate', (t) => {
        t.equal(createFilterExpr().filter(), true);
        t.equal(createFilterExpr(undefined).filter(), true);
        t.equal(createFilterExpr(null).filter(), true);
        t.end();
    });

    t.test('==, string', (t) => {
        const f = createFilterExpr(['==', 'foo', 'bar']).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 'bar'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 'baz'}}), false);
        t.end();
    });

    t.test('==, number', (t) => {
        const f = createFilterExpr(['==', 'foo', 0]).filter;
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
        const f = createFilterExpr(['==', 'foo', null]).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.equal(f({zoom: 0}, {properties: {}}), false);
        t.end();
    });

    t.test('==, $type', (t) => {
        const f = createFilterExpr(['==', '$type', 'LineString']).filter;
        t.equal(f({zoom: 0}, {type: 1}), false);
        t.equal(f({zoom: 0}, {type: 2}), true);
        t.end();
    });

    t.test('==, $id', (t) => {
        const f = createFilterExpr(['==', '$id', 1234]).filter;

        t.equal(f({zoom: 0}, {id: 1234}), true);
        t.equal(f({zoom: 0}, {id: '1234'}), false);
        t.equal(f({zoom: 0}, {properties: {id: 1234}}), false);

        t.end();
    });

    t.test('!=, string', (t) => {
        const f = createFilterExpr(['!=', 'foo', 'bar']).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 'bar'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 'baz'}}), true);
        t.end();
    });

    t.test('!=, number', (t) => {
        const f = createFilterExpr(['!=', 'foo', 0]).filter;
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
        const f = createFilterExpr(['!=', 'foo', null]).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.equal(f({zoom: 0}, {properties: {}}), true);
        t.end();
    });

    t.test('!=, $type', (t) => {
        const f = createFilterExpr(['!=', '$type', 'LineString']).filter;
        t.equal(f({zoom: 0}, {type: 1}), true);
        t.equal(f({zoom: 0}, {type: 2}), false);
        t.end();
    });

    t.test('<, number', (t) => {
        const f = createFilterExpr(['<', 'foo', 0]).filter;
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
        const f = createFilterExpr(['<', 'foo', '0']).filter;
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
        const f = createFilterExpr(['<=', 'foo', 0]).filter;
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
        const f = createFilterExpr(['<=', 'foo', '0']).filter;
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
        const f = createFilterExpr(['>', 'foo', 0]).filter;
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
        const f = createFilterExpr(['>', 'foo', '0']).filter;
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
        const f = createFilterExpr(['>=', 'foo', 0]).filter;
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
        const f = createFilterExpr(['>=', 'foo', '0']).filter;
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
        const f = createFilterExpr(['in', 'foo']).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.end();
    });

    t.test('in, string', (t) => {
        const f = createFilterExpr(['in', 'foo', '0']).filter;
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
        const f = createFilterExpr(['in', 'foo', 0]).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.end();
    });

    t.test('in, null', (t) => {
        const f = createFilterExpr(['in', 'foo', null]).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: true}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: false}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.end();
    });

    t.test('in, multiple', (t) => {
        const f = createFilterExpr(['in', 'foo', 0, 1]).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 3}}), false);
        t.end();
    });

    t.test('in, large_multiple', (t) => {
        const values = Array.from({length: 2000}).map(Number.call, Number);
        values.reverse();
        const f = createFilterExpr(['in', 'foo'].concat(values)).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1999}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 2000}}), false);
        t.end();
    });

    t.test('in, large_multiple, heterogeneous', (t) => {
        const values = Array.from({length: 2000}).map(Number.call, Number);
        values.push('a');
        values.unshift('b');
        const f = createFilterExpr(['in', 'foo'].concat(values)).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 'b'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 'a'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 1999}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: 2000}}), false);
        t.end();
    });

    t.test('in, $type', (t) => {
        const f = createFilterExpr(['in', '$type', 'LineString', 'Polygon']).filter;
        t.equal(f({zoom: 0}, {type: 1}), false);
        t.equal(f({zoom: 0}, {type: 2}), true);
        t.equal(f({zoom: 0}, {type: 3}), true);

        const f1 = createFilterExpr(['in', '$type', 'Polygon', 'LineString', 'Point']).filter;
        t.equal(f1({zoom: 0}, {type: 1}), true);
        t.equal(f1({zoom: 0}, {type: 2}), true);
        t.equal(f1({zoom: 0}, {type: 3}), true);

        t.end();
    });

    t.test('!in, degenerate', (t) => {
        const f = createFilterExpr(['!in', 'foo']).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), true);
        t.end();
    });

    t.test('!in, string', (t) => {
        const f = createFilterExpr(['!in', 'foo', '0']).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.equal(f({zoom: 0}, {properties: {}}), true);
        t.end();
    });

    t.test('!in, number', (t) => {
        const f = createFilterExpr(['!in', 'foo', 0]).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.end();
    });

    t.test('!in, null', (t) => {
        const f = createFilterExpr(['!in', 'foo', null]).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: '0'}}), true);
        t.equal(f({zoom: 0}, {properties: {foo: null}}), false);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.end();
    });

    t.test('!in, multiple', (t) => {
        const f = createFilterExpr(['!in', 'foo', 0, 1]).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 3}}), true);
        t.end();
    });

    t.test('!in, large_multiple', (t) => {
        const f = createFilterExpr(['!in', 'foo'].concat(Array.from({length: 2000}).map(Number.call, Number))).filter;
        t.equal(f({zoom: 0}, {properties: {foo: 0}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 1999}}), false);
        t.equal(f({zoom: 0}, {properties: {foo: 2000}}), true);
        t.end();
    });

    t.test('!in, $type', (t) => {
        const f = createFilterExpr(['!in', '$type', 'LineString', 'Polygon']).filter;
        t.equal(f({zoom: 0}, {type: 1}), true);
        t.equal(f({zoom: 0}, {type: 2}), false);
        t.equal(f({zoom: 0}, {type: 3}), false);
        t.end();
    });

    t.test('any', (t) => {
        const f1 = createFilterExpr(['any']).filter;
        t.equal(f1({zoom: 0}, {properties: {foo: 1}}), false);

        const f2 = createFilterExpr(['any', ['==', 'foo', 1]]).filter;
        t.equal(f2({zoom: 0}, {properties: {foo: 1}}), true);

        const f3 = createFilterExpr(['any', ['==', 'foo', 0]]).filter;
        t.equal(f3({zoom: 0}, {properties: {foo: 1}}), false);

        const f4 = createFilterExpr(['any', ['==', 'foo', 0], ['==', 'foo', 1]]).filter;
        t.equal(f4({zoom: 0}, {properties: {foo: 1}}), true);

        t.end();
    });

    t.test('all', (t) => {
        const f1 = createFilterExpr(['all']).filter;
        t.equal(f1({zoom: 0}, {properties: {foo: 1}}), true);

        const f2 = createFilterExpr(['all', ['==', 'foo', 1]]).filter;
        t.equal(f2({zoom: 0}, {properties: {foo: 1}}), true);

        const f3 = createFilterExpr(['all', ['==', 'foo', 0]]).filter;
        t.equal(f3({zoom: 0}, {properties: {foo: 1}}), false);

        const f4 = createFilterExpr(['all', ['==', 'foo', 0], ['==', 'foo', 1]]).filter;
        t.equal(f4({zoom: 0}, {properties: {foo: 1}}), false);

        t.end();
    });

    t.test('none', (t) => {
        const f1 = createFilterExpr(['none']).filter;
        t.equal(f1({zoom: 0}, {properties: {foo: 1}}), true);

        const f2 = createFilterExpr(['none', ['==', 'foo', 1]]).filter;
        t.equal(f2({zoom: 0}, {properties: {foo: 1}}), false);

        const f3 = createFilterExpr(['none', ['==', 'foo', 0]]).filter;
        t.equal(f3({zoom: 0}, {properties: {foo: 1}}), true);

        const f4 = createFilterExpr(['none', ['==', 'foo', 0], ['==', 'foo', 1]]).filter;
        t.equal(f4({zoom: 0}, {properties: {foo: 1}}), false);

        t.end();
    });

    t.test('has', (t) => {
        const f = createFilterExpr(['has', 'foo']).filter;
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
        const f = createFilterExpr(['!has', 'foo']).filter;
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
}
