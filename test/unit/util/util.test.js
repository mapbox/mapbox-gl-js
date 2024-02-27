import {describe, test, expect} from "../../util/vitest.js";

import {mapValue, degToRad, radToDeg, easeCubicInOut, getAABBPointSquareDist, furthestTileCorner, keysDifference, extend, pick, uniqueId, bindAll, asyncAll, clamp, smoothstep, wrap, bezier, endsWith, mapObject, filterObject, deepEqual, clone, arraysIntersect, isCounterClockwise, parseCacheControl, uuid, validateUuid, nextPowerOfTwo, isPowerOfTwo, bufferConvexPolygon, prevPowerOfTwo, shortestAngle, _resetSafariCheckForTest, isSafariWithAntialiasingBug} from '../../../src/util/util.js';

import Point from '@mapbox/point-geometry';

const EPSILON = 1e-8;

function pointsetEqual(actual, expected) {
    expect(actual.length).toEqual(expected.length);
    for (let i = 0; i < actual.length; i++) {
        const p1 = actual[i];
        const p2 = expected[i];
        expect(Math.abs(p1.x - p2.x) < EPSILON).toBeTruthy();
        expect(Math.abs(p1.y - p2.y) < EPSILON).toBeTruthy();
    }
}

describe('util', () => {
    expect(easeCubicInOut(0)).toEqual(0);
    expect(easeCubicInOut(0.2)).toEqual(0.03200000000000001);
    expect(easeCubicInOut(0.5)).toEqual(0.5);
    expect(easeCubicInOut(1)).toEqual(1);
    expect(keysDifference({a:1}, {})).toEqual(['a']);
    expect(keysDifference({a:1}, {a:1})).toEqual([]);
    expect(extend({a:1}, {b:2})).toEqual({a:1, b:2});
    expect(pick({a:1, b:2, c:3}, ['a', 'c'])).toEqual({a:1, c:3});
    expect(pick({a:1, b:2, c:3}, ['a', 'c', 'd'])).toEqual({a:1, c:3});
    expect(typeof uniqueId() === 'number').toBeTruthy();

    expect(degToRad(radToDeg(Math.PI))).toEqual(Math.PI);
    expect(degToRad(radToDeg(-Math.PI))).toEqual(-Math.PI);
    expect(radToDeg(degToRad(65))).toEqual(65);
    expect(radToDeg(degToRad(-34.2))).toEqual(-34.2);

    expect(smoothstep(30, 60, 29)).toEqual(0);
    expect(smoothstep(30, 60, 45)).toEqual(0.5);
    expect(smoothstep(30, 60, 61)).toEqual(1);

    expect(furthestTileCorner(-200)).toEqual([1, 1]);
    expect(furthestTileCorner(-95)).toEqual([0, 1]);
    expect(furthestTileCorner(-30)).toEqual([0, 0]);
    expect(furthestTileCorner(0)).toEqual([1, 0]);
    expect(furthestTileCorner(30)).toEqual([1, 0]);
    expect(furthestTileCorner(95)).toEqual([1, 1]);
    expect(furthestTileCorner(130)).toEqual([1, 1]);
    expect(furthestTileCorner(200)).toEqual([0, 1]);
    expect(furthestTileCorner(275)).toEqual([0, 0]);
    expect(furthestTileCorner(360)).toEqual([1, 0]);
    expect(furthestTileCorner(390)).toEqual([1, 0]);

    expect(getAABBPointSquareDist([2, 2], [3, 3], [1, 1])).toEqual(2);
    expect(getAABBPointSquareDist([0, 0], [3, 2], [1, 1])).toEqual(0);
    expect(getAABBPointSquareDist([-3, -2], [-2, -1], [1, 1])).toEqual(13);
    expect(getAABBPointSquareDist([-3, -2], [-2, -1], [-1, -1])).toEqual(1);
    expect(getAABBPointSquareDist([2, 2], [3, 3])).toEqual(8);
    expect(getAABBPointSquareDist([2, 2], [10, 3])).toEqual(8);
    expect(getAABBPointSquareDist([-2, -2], [2, 2])).toEqual(0);
    expect(getAABBPointSquareDist([2, 2], [3, 3], [2.5, 0])).toEqual(4);
    expect(getAABBPointSquareDist([2, 2], [3, 3], [2.5, -2])).toEqual(16);

    test('bindAll', () => {
        class MyClass {
            name;
            constructor() {
                bindAll(['ontimer'], this);
                this.name = 'Tom';
            }

            ontimer() {
                expect(this.name).toEqual('Tom');
            }
        }

        const my = new MyClass();
        // $FlowFixMe[method-unbinding]
        setTimeout(my.ontimer, 0);
    });
    /*
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
    */

    test('isPowerOfTwo', () => {
        expect(isPowerOfTwo(1)).toEqual(true);
        expect(isPowerOfTwo(2)).toEqual(true);
        expect(isPowerOfTwo(256)).toEqual(true);
        expect(isPowerOfTwo(-256)).toEqual(false);
        expect(isPowerOfTwo(0)).toEqual(false);
        expect(isPowerOfTwo(-42)).toEqual(false);
        expect(isPowerOfTwo(42)).toEqual(false);
    });

    test('nextPowerOfTwo', () => {
        expect(nextPowerOfTwo(1)).toEqual(1);
        expect(nextPowerOfTwo(2)).toEqual(2);
        expect(nextPowerOfTwo(256)).toEqual(256);
        expect(nextPowerOfTwo(-256)).toEqual(1);
        expect(nextPowerOfTwo(0)).toEqual(1);
        expect(nextPowerOfTwo(-42)).toEqual(1);
        expect(nextPowerOfTwo(42)).toEqual(64);
    });

    test('prevPowerOfTwo', () => {
        expect(prevPowerOfTwo(1)).toEqual(1);
        expect(prevPowerOfTwo(2)).toEqual(2);
        expect(prevPowerOfTwo(256)).toEqual(256);
        expect(prevPowerOfTwo(258)).toEqual(256);
        expect(prevPowerOfTwo(514)).toEqual(512);
        expect(prevPowerOfTwo(512)).toEqual(512);
        expect(prevPowerOfTwo(98)).toEqual(64);
    });

    test('nextPowerOfTwo', () => {
        expect(isPowerOfTwo(nextPowerOfTwo(1))).toEqual(true);
        expect(isPowerOfTwo(nextPowerOfTwo(2))).toEqual(true);
        expect(isPowerOfTwo(nextPowerOfTwo(256))).toEqual(true);
        expect(isPowerOfTwo(nextPowerOfTwo(-256))).toEqual(true);
        expect(isPowerOfTwo(nextPowerOfTwo(0))).toEqual(true);
        expect(isPowerOfTwo(nextPowerOfTwo(-42))).toEqual(true);
        expect(isPowerOfTwo(nextPowerOfTwo(42))).toEqual(true);
    });

    test('clamp', () => {
        expect(clamp(0, 0, 1)).toEqual(0);
        expect(clamp(1, 0, 1)).toEqual(1);
        expect(clamp(200, 0, 180)).toEqual(180);
        expect(clamp(-200, 0, 180)).toEqual(0);
    });

    test('mapValue', () => {
        expect(mapValue(5, 0, 10, 0, 1)).toEqual(0.5);
        expect(mapValue(0, -10, 10, 0, 1)).toEqual(0.5);
        expect(mapValue(12, 0, 5, 0, 1)).toEqual(1);
        expect(mapValue(-10, -5, 5, 0, 1)).toEqual(0);

        expect(mapValue(5, 0, 10, -5, 5)).toEqual(0);
        expect(mapValue(0, -10, 10, -5, 10)).toEqual(2.5);
        expect(mapValue(12, 0, 5, -1, 0)).toEqual(0);
        expect(mapValue(5, -10, 10, -5, -4)).toEqual(-4.25);
    });

    test('wrap', () => {
        expect(wrap(0, 0, 1)).toEqual(1);
        expect(wrap(1, 0, 1)).toEqual(1);
        expect(wrap(200, 0, 180)).toEqual(20);
        expect(wrap(-200, 0, 180)).toEqual(160);
    });

    test('bezier', () => {
        const curve = bezier(0, 0, 0.25, 1);
        expect(curve instanceof Function).toBeTruthy();
        expect(curve(0)).toEqual(0);
        expect(curve(1)).toEqual(1);
        expect(curve(0.5)).toEqual(0.8230854638965502);
    });

    test('asyncAll', () => {
        let expectResult = 1;
        asyncAll([], (callback) => { callback(); }, () => {
            expect('immediate callback').toBeTruthy();
        });
        asyncAll([1, 2, 3], (number, callback) => {
            expect(number).toEqual(expectResult++);
            expect(callback instanceof Function).toBeTruthy();
            callback(null, 0);
        }, () => {});
    });

    test('endsWith', () => {
        expect(endsWith('mapbox', 'box')).toBeTruthy();
        expect(endsWith('mapbox', 'map')).toBeFalsy();
    });

    test('mapObject', () => {
        expect.assertions(6);
        expect(mapObject({}, () => { expect(false).toBeTruthy(); })).toEqual({});
        const that = {};
        // $FlowFixMe[missing-this-annot]
        expect(mapObject({map: 'box'}, function(value, key, object) {
            expect(value).toEqual('box');
            expect(key).toEqual('map');
            expect(object).toEqual({map: 'box'});
            expect(this).toEqual(that);
            return 'BOX';
        }, that)).toEqual({map: 'BOX'});
    });

    test('filterObject', () => {
        expect.assertions(6);
        expect(filterObject({}, () => { expect(false).toBeTruthy(); })).toEqual({});
        const that = {};
        // $FlowFixMe[missing-this-annot]
        filterObject({map: 'box'}, function(value, key, object) {
            expect(value).toEqual('box');
            expect(key).toEqual('map');
            expect(object).toEqual({map: 'box'});
            expect(this).toEqual(that);
            return true;
        }, that);
        expect(filterObject({map: 'box', box: 'map'}, (value) => {
            return value === 'box';
        })).toEqual({map: 'box'});
    });

    test('deepEqual', () => {
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

        expect(deepEqual(a, b)).toBeTruthy();
        expect(deepEqual(a, c)).toBeFalsy();
        expect(deepEqual(a, null)).toBeFalsy();
        expect(deepEqual(null, c)).toBeFalsy();
        expect(deepEqual(null, null)).toBeTruthy();
    });

    describe('clone', () => {
        test('array', () => {
            const input = [false, 1, 'two'];
            const output = clone(input);
            expect(input).not.toBe(output);
            expect(input).toEqual(output);
        });

        test('object', () => {
            const input = {a: false, b: 1, c: 'two'};
            const output = clone(input);
            expect(input).not.toBe(output);
            expect(input).toEqual(output);
        });

        test('deep object', () => {
            const input = {object: {a: false, b: 1, c: 'two'}};
            const output = clone(input);
            expect(input.object).not.toBe(output.object);
            expect(input.object).toEqual(output.object);
        });

        test('deep array', () => {
            const input = {array: [false, 1, 'two']};
            const output = clone(input);
            expect(input.array).not.toBe(output.array);
            expect(input.array).toEqual(output.array);
        });
    });

    describe('arraysIntersect', () => {
        test('intersection', () => {
            const a = ["1", "2", "3"];
            const b = ["5", "4", "3"];

            expect(arraysIntersect(a, b)).toEqual(true);
        });

        test('no intersection', () => {
            const a = ["1", "2", "3"];
            const b = ["4", "5", "6"];

            expect(arraysIntersect(a, b)).toEqual(false);
        });
    });

    describe('isCounterClockwise ', () => {
        test('counter clockwise', () => {
            const a = new Point(0, 0);
            const b = new Point(1, 0);
            const c = new Point(1, 1);

            expect(isCounterClockwise(a, b, c)).toEqual(true);
        });

        test('clockwise', () => {
            const a = new Point(0, 0);
            const b = new Point(1, 0);
            const c = new Point(1, 1);

            expect(isCounterClockwise(c, b, a)).toEqual(false);
        });
    });

    describe('bufferConvexPolygon', () => {
        test('should throw error or return correct result', () => {
            expect(() => {
                bufferConvexPolygon([new Point(0, 0), new Point(1, 1)], 5);
            }).toThrowError();
            expect(() => {
                bufferConvexPolygon([new Point(0, 0)], 5);
            }).toThrowError();
            expect(
            bufferConvexPolygon([new Point(0, 0), new Point(0, 1), new Point(1, 1)], 1)
            ).toBeTruthy();
        });

        describe('numerical tests', () => {
            test('box', () => {
                const buffered = bufferConvexPolygon([new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1)], 1);
                pointsetEqual(buffered, [new Point(-1, -1), new Point(2, -1), new Point(2, 2), new Point(-1, 2)]);
            });
            test('triangle', () => {
                const buffered = bufferConvexPolygon([new Point(0, 0), new Point(1, 0), new Point(0, 1)], 1);
                pointsetEqual(buffered, [new Point(-1, -1), new Point(3.414213562373095, -1), new Point(-1, 3.414213562373095)]);
            });
        });
    });

    describe('parseCacheControl', () => {
        test('max-age', () => {
            expect(parseCacheControl('max-age=123456789')).toEqual({
                'max-age': 123456789
            });

            expect(parseCacheControl('max-age=1000')).toEqual({
                'max-age': 1000
            });

            expect(parseCacheControl('max-age=null')).toEqual({});
        });
    });

    test('validateUuid', () => {
        expect(validateUuid(uuid())).toBeTruthy();
        expect(validateUuid(uuid().substr(0, 10))).toBeFalsy();
        expect(validateUuid('foobar')).toBeFalsy();
        expect(validateUuid(null)).toBeFalsy();
    });

    test('shortestAngle', () => {
        expect(shortestAngle(0, 90)).toEqual(90);
        expect(shortestAngle(0, -270)).toEqual(90);
        expect(shortestAngle(0, 450)).toEqual(90);

        expect(shortestAngle(0, -90)).toEqual(-90);
        expect(shortestAngle(0, 270)).toEqual(-90);
        expect(shortestAngle(0, -450)).toEqual(-90);

        expect(shortestAngle(45, 226)).toEqual(-179);
        expect(shortestAngle(100, 123 * 360 + 100)).toEqual(0);
        expect(shortestAngle(-45, 335)).toEqual(20);
        expect(shortestAngle(-100, -270)).toEqual(-170);
    });

    test('isSafariWithAntialiasingBug', () => {
        const isSafariWithAntialiasingBugReset = (scope) => {
            _resetSafariCheckForTest();
            const result = isSafariWithAntialiasingBug(scope);
            _resetSafariCheckForTest();
            return result;
        };

        // mac
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Safari/605.1.15'}})
        ).toBeFalsy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15'}})
        ).toBeFalsy();

        // iphone
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();

        // ipad
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();

        // chrome
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.74 Safari/537.36'}})
        ).toBeFalsy();
        // firefox
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 12.3; rv:98.0) Gecko/20100101 Firefox/98.0'}})
        ).toBeFalsy();
        // edge
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.74 Safari/537.36 Edg/99.0.1150.36'}})
        ).toBeFalsy();

        // chrome on iOS
        // iphone
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();
        // ipad
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();
        // ipod
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPod; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPod; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPod; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPod; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1'}})
        ).toBeFalsy();

        // firefox on iOS
        // iphone
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeFalsy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeFalsy();
        // ipad
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeFalsy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeFalsy();
        // ipod
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/604.5.6 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeFalsy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/604.5.6 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/604.5.6 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeTruthy();
        expect(
            isSafariWithAntialiasingBugReset({navigator: {userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/604.5.6 (KHTML, like Gecko) FxiOS/98.0 Mobile/15E148 Safari/605.1.15'}})
        ).toBeFalsy();
    });
});
