// @flow

import {test} from '../../util/test.js';

import {degToRad, radToDeg, easeCubicInOut, getAABBPointSquareDist, furthestTileCorner, keysDifference, extend, pick, uniqueId, bindAll, asyncAll, clamp, smoothstep, wrap, bezier, endsWith, mapObject, filterObject, deepEqual, clone, arraysIntersect, isCounterClockwise, isClosedPolygon, parseCacheControl, uuid, validateUuid, nextPowerOfTwo, isPowerOfTwo, bufferConvexPolygon, prevPowerOfTwo} from '../../../src/util/util.js';
import Point from '@mapbox/point-geometry';

const EPSILON = 1e-8;

function pointsetEqual(t, actual, expected) {
    t.equal(actual.length, expected.length);
    for (let i = 0; i < actual.length; i++) {
        const p1 = actual[i];
        const p2 = expected[i];
        t.ok(Math.abs(p1.x - p2.x) < EPSILON);
        t.ok(Math.abs(p1.y - p2.y) < EPSILON);
    }
}

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

    t.equal(degToRad(radToDeg(Math.PI)), Math.PI);
    t.equal(degToRad(radToDeg(-Math.PI)), -Math.PI);
    t.equal(radToDeg(degToRad(65)), 65);
    t.equal(radToDeg(degToRad(-34.2)), -34.2);

    t.equal(smoothstep(30, 60, 29), 0);
    t.equal(smoothstep(30, 60, 45), 0.5);
    t.equal(smoothstep(30, 60, 61), 1);

    t.deepEqual(furthestTileCorner(-200), [1, 1]);
    t.deepEqual(furthestTileCorner(-95), [0, 1]);
    t.deepEqual(furthestTileCorner(-30), [0, 0]);
    t.deepEqual(furthestTileCorner(0), [1, 0]);
    t.deepEqual(furthestTileCorner(30), [1, 0]);
    t.deepEqual(furthestTileCorner(95), [1, 1]);
    t.deepEqual(furthestTileCorner(130), [1, 1]);
    t.deepEqual(furthestTileCorner(200), [0, 1]);
    t.deepEqual(furthestTileCorner(275), [0, 0]);
    t.deepEqual(furthestTileCorner(360), [1, 0]);
    t.deepEqual(furthestTileCorner(390), [1, 0]);

    t.deepEqual(getAABBPointSquareDist([2, 2], [3, 3], [1, 1]), 2);
    t.deepEqual(getAABBPointSquareDist([0, 0], [3, 2], [1, 1]), 0);
    t.deepEqual(getAABBPointSquareDist([-3, -2], [-2, -1], [1, 1]), 13);
    t.deepEqual(getAABBPointSquareDist([-3, -2], [-2, -1], [-1, -1]), 1);
    t.deepEqual(getAABBPointSquareDist([2, 2], [3, 3]), 8);
    t.deepEqual(getAABBPointSquareDist([2, 2], [10, 3]), 8);
    t.deepEqual(getAABBPointSquareDist([-2, -2], [2, 2]), 0);
    t.deepEqual(getAABBPointSquareDist([2, 2], [3, 3], [2.5, 0]), 4);
    t.deepEqual(getAABBPointSquareDist([2, 2], [3, 3], [2.5, -2]), 16);

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

    t.test('isPowerOfTwo', (t) => {
        t.equal(isPowerOfTwo(1), true);
        t.equal(isPowerOfTwo(2), true);
        t.equal(isPowerOfTwo(256), true);
        t.equal(isPowerOfTwo(-256), false);
        t.equal(isPowerOfTwo(0), false);
        t.equal(isPowerOfTwo(-42), false);
        t.equal(isPowerOfTwo(42), false);
        t.end();
    });

    t.test('nextPowerOfTwo', (t) => {
        t.equal(nextPowerOfTwo(1), 1);
        t.equal(nextPowerOfTwo(2), 2);
        t.equal(nextPowerOfTwo(256), 256);
        t.equal(nextPowerOfTwo(-256), 1);
        t.equal(nextPowerOfTwo(0), 1);
        t.equal(nextPowerOfTwo(-42), 1);
        t.equal(nextPowerOfTwo(42), 64);
        t.end();
    });

    t.test('prevPowerOfTwo', (t) => {
        t.equal(prevPowerOfTwo(1), 1);
        t.equal(prevPowerOfTwo(2), 2);
        t.equal(prevPowerOfTwo(256), 256);
        t.equal(prevPowerOfTwo(258), 256);
        t.equal(prevPowerOfTwo(514), 512);
        t.equal(prevPowerOfTwo(512), 512);
        t.equal(prevPowerOfTwo(98), 64);
        t.end();
    });

    t.test('nextPowerOfTwo', (t) => {
        t.equal(isPowerOfTwo(nextPowerOfTwo(1)), true);
        t.equal(isPowerOfTwo(nextPowerOfTwo(2)), true);
        t.equal(isPowerOfTwo(nextPowerOfTwo(256)), true);
        t.equal(isPowerOfTwo(nextPowerOfTwo(-256)), true);
        t.equal(isPowerOfTwo(nextPowerOfTwo(0)), true);
        t.equal(isPowerOfTwo(nextPowerOfTwo(-42)), true);
        t.equal(isPowerOfTwo(nextPowerOfTwo(42)), true);
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

    t.test('bufferConvexPolygon', (t) => {
        t.throws(() => {
            bufferConvexPolygon([new Point(0, 0), new Point(1, 1)], 5);
        });
        t.throws(() => {
            bufferConvexPolygon([new Point(0, 0)], 5);
        });
        t.ok(bufferConvexPolygon([new Point(0, 0), new Point(0, 1), new Point(1, 1)], 1));

        t.test('numerical tests', (t) => {
            t.test('box', (t) => {
                const buffered = bufferConvexPolygon([new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1)], 1);
                pointsetEqual(t, buffered, [new Point(-1, -1), new Point(2, -1), new Point(2, 2), new Point(-1, 2)]);
                t.end();
            });
            t.test('triangle', (t) => {
                const buffered = bufferConvexPolygon([new Point(0, 0), new Point(1, 0), new Point(0, 1)], 1);
                pointsetEqual(t, buffered, [new Point(-1, -1), new Point(3.414213562373095, -1), new Point(-1, 3.414213562373095)]);
                t.end();
            });

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

    t.test('validateUuid', (t) => {
        t.true(validateUuid(uuid()));
        t.false(validateUuid(uuid().substr(0, 10)));
        t.false(validateUuid('foobar'));
        t.false(validateUuid(null));
        t.end();
    });

    t.end();
});
