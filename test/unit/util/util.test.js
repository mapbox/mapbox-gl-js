// @flow

import { test } from 'mapbox-gl-js-test';

import Coordinate from '../../../src/geo/coordinate';
import { easeCubicInOut, keysDifference, extend, pick, uniqueId, getCoordinatesCenter, bindAll, asyncAll, clamp, wrap, bezier, endsWith, mapObject, filterObject, deepEqual, clone, arraysIntersect, isCounterClockwise, isClosedPolygon, parseCacheControl } from '../../../src/util/util';
import Point from '@mapbox/point-geometry';

test('util', (t) => {
    t.equal(easeCubicInOut(0), 0, 'easeCubicInOut=0');
    t.equal(easeCubicInOut(0.2), 0.03200000000000001);
    t.equal(easeCubicInOut(0.5), 0.5, 'easeCubicInOut=0.5');
    t.equal(easeCubicInOut(1), 1, 'easeCubicInOut=1');
    t.deepEqual(keysDifference({a:1}, {}), ['a'], 'keysDifference');
    t.deepEqual(keysDifference({a:1}, {a:1}), [], 'keysDifference');
    t.deepEqual(extend({a:1}, {b:2}), {a:1, b:2}, 'extend');
    t.deepEqual(pick({a:1, b:2, c:3}, ['a', 'c']), {a:1, c:3}, 'pick');
    t.deepEqual(pick({a:1, b:2, c:3}, ['a', 'c', 'd']), {a:1, c:3}, 'pick');
    t.ok(typeof uniqueId() === 'number', 'uniqueId');

    t.test('getCoordinatesCenter', (t) => {
        t.deepEqual(getCoordinatesCenter([
            new Coordinate(0, 0, 2),
            new Coordinate(1, 1, 2)
        ]), new Coordinate(0.5, 0.5, 0));
        t.end();
    });

    t.test('bindAll', (t) => {
        function MyClass() {
            bindAll(['ontimer'], this);
            this.name = 'Tom';
        }
        MyClass.prototype.ontimer = function() {
            t.equal(this.name, 'Tom');
            t.end();
        };
        const my = new MyClass();
        setTimeout(my.ontimer, 0);
    });

    t.test('asyncAll - sync', (t) => {
        t.equal(asyncAll([0, 1, 2], (data, callback) => {
            callback(null, data);
        }, (err, results) => {
            t.ifError(err);
            t.deepEqual(results, [0, 1, 2]);
        }));
        t.end();
    });

    t.test('asyncAll - async', (t) => {
        t.equal(asyncAll([4, 0, 1, 2], (data, callback) => {
            setTimeout(() => {
                callback(null, data);
            }, data);
        }, (err, results) => {
            t.ifError(err);
            t.deepEqual(results, [4, 0, 1, 2]);
            t.end();
        }));
    });

    t.test('asyncAll - error', (t) => {
        t.equal(asyncAll([4, 0, 1, 2], (data, callback) => {
            setTimeout(() => {
                callback(new Error('hi'), data);
            }, data);
        }, (err, results) => {
            t.equal(err && err.message, 'hi');
            t.deepEqual(results, [4, 0, 1, 2]);
            t.end();
        }));
    });

    t.test('asyncAll - empty', (t) => {
        t.equal(asyncAll([], (data, callback) => {
            callback(null, 'foo');
        }, (err, results) => {
            t.ifError(err);
            t.deepEqual(results, []);
        }));
        t.end();
    });

    t.test('clamp', (t) => {
        t.equal(clamp(0, 0, 1), 0);
        t.equal(clamp(1, 0, 1), 1);
        t.equal(clamp(200, 0, 180), 180);
        t.equal(clamp(-200, 0, 180), 0);
        t.end();
    });

    t.test('wrap', (t) => {
        t.equal(wrap(0, 0, 1), 1);
        t.equal(wrap(1, 0, 1), 1);
        t.equal(wrap(200, 0, 180), 20);
        t.equal(wrap(-200, 0, 180), 160);
        t.end();
    });

    t.test('bezier', (t) => {
        const curve = bezier(0, 0, 0.25, 1);
        t.ok(curve instanceof Function, 'returns a function');
        t.equal(curve(0), 0);
        t.equal(curve(1), 1);
        t.equal(curve(0.5), 0.8230854638965502);
        t.end();
    });

    t.test('asyncAll', (t) => {
        let expect = 1;
        asyncAll([], (callback) => { callback(); }, () => {
            t.ok('immediate callback');
        });
        asyncAll([1, 2, 3], (number, callback) => {
            t.equal(number, expect++);
            t.ok(callback instanceof Function);
            callback(null, 0);
        }, () => {
            t.end();
        });
    });

    t.test('endsWith', (t) => {
        t.ok(endsWith('mapbox', 'box'));
        t.notOk(endsWith('mapbox', 'map'));
        t.end();
    });

    t.test('mapObject', (t) => {
        t.plan(6);
        t.deepEqual(mapObject({}, () => { t.ok(false); }), {});
        const that = {};
        t.deepEqual(mapObject({map: 'box'}, function(value, key, object) {
            t.equal(value, 'box');
            t.equal(key, 'map');
            t.deepEqual(object, {map: 'box'});
            t.equal(this, that);
            return 'BOX';
        }, that), {map: 'BOX'});
    });

    t.test('filterObject', (t) => {
        t.plan(6);
        t.deepEqual(filterObject({}, () => { t.ok(false); }), {});
        const that = {};
        filterObject({map: 'box'}, function(value, key, object) {
            t.equal(value, 'box');
            t.equal(key, 'map');
            t.deepEqual(object, {map: 'box'});
            t.equal(this, that);
            return true;
        }, that);
        t.deepEqual(filterObject({map: 'box', box: 'map'}, (value) => {
            return value === 'box';
        }), {map: 'box'});
        t.end();
    });

    t.test('deepEqual', (t) => {
        const a = {
            foo: 'bar',
            bar: {
                baz: 5,
                lol: ["cat", 2]
            }
        };
        const b = JSON.parse(JSON.stringify(a));
        const c = JSON.parse(JSON.stringify(a));
        c.bar.lol[0] = "z";

        t.ok(deepEqual(a, b));
        t.notOk(deepEqual(a, c));
        t.notOk(deepEqual(a, null));
        t.notOk(deepEqual(null, c));
        t.ok(deepEqual(null, null));

        t.end();
    });

    t.test('clone', (t) => {
        t.test('array', (t) => {
            const input = [false, 1, 'two'];
            const output = clone(input);
            t.notEqual(input, output);
            t.deepEqual(input, output);
            t.end();
        });

        t.test('object', (t) => {
            const input = {a: false, b: 1, c: 'two'};
            const output = clone(input);
            t.notEqual(input, output);
            t.deepEqual(input, output);
            t.end();
        });

        t.test('deep object', (t) => {
            const input = {object: {a: false, b: 1, c: 'two'}};
            const output = clone(input);
            t.notEqual(input.object, output.object);
            t.deepEqual(input.object, output.object);
            t.end();
        });

        t.test('deep array', (t) => {
            const input = {array: [false, 1, 'two']};
            const output = clone(input);
            t.notEqual(input.array, output.array);
            t.deepEqual(input.array, output.array);
            t.end();
        });

        t.end();
    });

    t.test('arraysIntersect', (t) => {
        t.test('intersection', (t) => {
            const a = ["1", "2", "3"];
            const b = ["5", "4", "3"];

            t.equal(arraysIntersect(a, b), true);
            t.end();
        });

        t.test('no intersection', (t) => {
            const a = ["1", "2", "3"];
            const b = ["4", "5", "6"];

            t.equal(arraysIntersect(a, b), false);
            t.end();
        });

        t.end();
    });

    t.test('isCounterClockwise ', (t) => {
        t.test('counter clockwise', (t) => {
            const a = new Point(0, 0);
            const b = new Point(1, 0);
            const c = new Point(1, 1);

            t.equal(isCounterClockwise(a, b, c), true);
            t.end();
        });

        t.test('clockwise', (t) => {
            const a = new Point(0, 0);
            const b = new Point(1, 0);
            const c = new Point(1, 1);

            t.equal(isCounterClockwise(c, b, a), false);
            t.end();
        });

        t.end();
    });

    t.test('isClosedPolygon', (t) => {
        t.test('not enough points', (t) => {
            const polygon = [new Point(0, 0), new Point(1, 0), new Point(0, 1)];

            t.equal(isClosedPolygon(polygon), false);
            t.end();
        });

        t.test('not equal first + last point', (t) => {
            const polygon = [new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(1, 1)];

            t.equal(isClosedPolygon(polygon), false);
            t.end();
        });

        t.test('closed polygon', (t) => {
            const polygon = [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1), new Point(0, 0)];

            t.equal(isClosedPolygon(polygon), true);
            t.end();
        });

        t.end();
    });

    t.test('parseCacheControl', (t) => {
        t.test('max-age', (t) => {
            t.deepEqual(parseCacheControl('max-age=123456789'), {
                'max-age': 123456789
            }, 'returns valid max-age header');

            t.deepEqual(parseCacheControl('max-age=1000'), {
                'max-age': 1000
            }, 'returns valid max-age header');

            t.deepEqual(parseCacheControl('max-age=null'), {}, 'does not return invalid max-age header');

            t.end();
        });

        t.end();
    });

    t.end();
});
