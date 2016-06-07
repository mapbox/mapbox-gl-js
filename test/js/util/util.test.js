'use strict';

var test = require('tap').test;
var Coordinate = require('../../../js/geo/coordinate');
var util = require('../../../js/util/util');

test('util', function(t) {
    t.equal(util.easeCubicInOut(0), 0, 'easeCubicInOut=0');
    t.equal(util.easeCubicInOut(0.2), 0.03200000000000001);
    t.equal(util.easeCubicInOut(0.5), 0.5, 'easeCubicInOut=0.5');
    t.equal(util.easeCubicInOut(1), 1, 'easeCubicInOut=1');
    t.deepEqual(util.keysDifference({a:1}, {}), ['a'], 'keysDifference');
    t.deepEqual(util.keysDifference({a:1}, {a:1}), [], 'keysDifference');
    t.deepEqual(util.extend({a:1}, {b:2}), {a:1, b:2}, 'extend');
    t.deepEqual(util.extendAll({a:1}, {b:2}), {a:1, b:2}, 'extend');
    t.deepEqual(util.pick({a:1, b:2, c:3}, ['a', 'c']), {a:1, c:3}, 'pick');
    t.deepEqual(util.pick({a:1, b:2, c:3}, ['a', 'c', 'd']), {a:1, c:3}, 'pick');
    t.ok(typeof util.uniqueId() === 'number', 'uniqueId');

    t.test('inherit', function(t) {
        function Inheritance() { }
        Inheritance.prototype.foo = function() { return 42; };
        function Child() {}
        Child.prototype = util.inherit(Inheritance, {
            bar: function() {
                return 20;
            }
        });
        var c = new Child();
        t.equal(c.foo(), 42);
        t.equal(c.bar(), 20);
        t.end();
    });

    t.test('getCoordinatesCenter', function(t) {
        t.deepEqual(util.getCoordinatesCenter(
            [
                new Coordinate(0, 0, 2),
                new Coordinate(1, 1, 2)
            ]),
            new Coordinate(0.5, 0.5, 0));
        t.end();
    });

    t.test('bindAll', function(t) {
        function MyClass() {
            util.bindAll(['ontimer'], this);
            this.name = 'Tom';
        }
        MyClass.prototype.ontimer = function() {
            t.equal(this.name, 'Tom');
            t.end();
        };
        var my = new MyClass();
        setTimeout(my.ontimer, 0);
    });

    t.test('setOptions', function(t) {
        function MyClass(options) {
            util.setOptions(this, options);
        }
        var my = new MyClass();
        t.deepEqual(my.options, {});
        var my2 = new MyClass({ a: 2 });
        t.deepEqual(my2.options, { a: 2});

        function MyClassDefaults(options) {
            this.options = { foo: 'bar' };
            util.setOptions(this, options);
        }
        var myd = new MyClassDefaults();
        t.deepEqual(myd.options, { foo: 'bar' });
        var myd2 = new MyClassDefaults({ foo: 'baz' });
        t.deepEqual(myd2.options, { foo: 'baz' });
        t.end();
    });

    t.test('bindHandlers', function(t) {
        function MyClass() {
            util.bindHandlers(this);
            this.name = 'Tom';
        }
        MyClass.prototype.otherMethod = function() {
            t.equal(this, undefined);
        };
        MyClass.prototype._onClick = function() {
            t.equal(this.name, 'Tom');
            t.end();
        };
        var my = new MyClass();
        my.otherMethod.call(undefined);
        setTimeout(my._onClick, 0);
    });

    t.test('asyncAll - sync', function(t) {
        t.equal(util.asyncAll([0, 1, 2], function(data, callback) {
            callback(null, data);
        }, function(err, results) {
            t.ifError(err);
            t.deepEqual(results, [0, 1, 2]);
        }));
        t.end();
    });

    t.test('asyncAll - async', function(t) {
        t.equal(util.asyncAll([4, 0, 1, 2], function(data, callback) {
            setTimeout(function() {
                callback(null, data);
            }, data);
        }, function(err, results) {
            t.ifError(err);
            t.deepEqual(results, [4, 0, 1, 2]);
            t.end();
        }));
    });

    t.test('asyncAll - error', function(t) {
        t.equal(util.asyncAll([4, 0, 1, 2], function(data, callback) {
            setTimeout(function() {
                callback(new Error('hi'), data);
            }, data);
        }, function(err, results) {
            t.equal(err.message, 'hi');
            t.deepEqual(results, [4, 0, 1, 2]);
            t.end();
        }));
    });

    t.test('asyncAll - empty', function(t) {
        t.equal(util.asyncAll([], function(data, callback) {
            callback(null, 'foo');
        }, function(err, results) {
            t.ifError(err);
            t.deepEqual(results, []);
        }));
        t.end();
    });

    t.test('coalesce', function(t) {
        t.equal(util.coalesce(undefined, 1), 1);
        t.equal(util.coalesce(2, 1), 2);
        t.equal(util.coalesce(null, undefined, 4), 4);
        t.equal(util.coalesce(), undefined);
        t.end();
    });

    t.test('clamp', function(t) {
        t.equal(util.clamp(0, 0, 1), 0);
        t.equal(util.clamp(1, 0, 1), 1);
        t.equal(util.clamp(200, 0, 180), 180);
        t.equal(util.clamp(-200, 0, 180), 0);
        t.end();
    });

    t.test('wrap', function(t) {
        t.equal(util.wrap(0, 0, 1), 1);
        t.equal(util.wrap(1, 0, 1), 1);
        t.equal(util.wrap(200, 0, 180), 20);
        t.equal(util.wrap(-200, 0, 180), 160);
        t.end();
    });

    t.test('bezier', function(t) {
        var curve = util.bezier(0, 0, 0.25, 1);
        t.ok(curve instanceof Function, 'returns a function');
        t.equal(curve(0), 0);
        t.equal(curve(1), 1);
        t.equal(curve(0.5), 0.8230854638965502);
        t.end();
    });

    t.test('asyncAll', function(t) {
        var expect = 1;
        util.asyncAll([], function(callback) { callback(); }, function() {
            t.ok('immediate callback');
        });
        util.asyncAll([1, 2, 3], function(number, callback) {
            t.equal(number, expect++);
            t.ok(callback instanceof Function);
            callback();
        }, function() {
            t.end();
        });
    });

    t.test('debounce', function(t) {
        var ender = function(number) {
            t.equal(number, 3, 'passes argument');
            t.pass('calls function');
            t.end();
        };
        var debounced = util.debounce(ender, 100);
        t.ok(debounced, 'creates function');
        debounced(1);
        debounced(2);
        debounced(3);
    });

    t.test('startsWith', function(t) {
        t.ok(util.startsWith('mapbox', 'map'));
        t.notOk(util.startsWith('mapbox', 'box'));
        t.end();
    });

    t.test('endsWith', function(t) {
        t.ok(util.endsWith('mapbox', 'box'));
        t.notOk(util.endsWith('mapbox', 'map'));
        t.end();
    });

    t.test('mapObject', function(t) {
        t.plan(6);
        t.deepEqual(util.mapObject({}, function() { t.ok(false); }), {});
        var that = {};
        t.deepEqual(util.mapObject({map: 'box'}, function(value, key, object) {
            t.equal(value, 'box');
            t.equal(key, 'map');
            t.deepEqual(object, {map: 'box'});
            t.equal(this, that);
            return 'BOX';
        }, that), {map: 'BOX'});
    });

    t.test('filterObject', function(t) {
        t.plan(6);
        t.deepEqual(util.filterObject({}, function() { t.ok(false); }), {});
        var that = {};
        util.filterObject({map: 'box'}, function(value, key, object) {
            t.equal(value, 'box');
            t.equal(key, 'map');
            t.deepEqual(object, {map: 'box'});
            t.equal(this, that);
            return true;
        }, that);
        t.deepEqual(util.filterObject({map: 'box', box: 'map'}, function(value) {
            return value === 'box';
        }), {map: 'box'});
        t.end();
    });

    t.test('deepEqual', function(t) {
        var a = {
            foo: 'bar',
            bar: {
                baz: 5,
                lol: ["cat", 2]
            }
        };
        var b = JSON.parse(JSON.stringify(a));
        var c = JSON.parse(JSON.stringify(a));
        c.bar.lol[0] = "z";

        t.ok(util.deepEqual(a, b));
        t.notOk(util.deepEqual(a, c));

        t.end();
    });

    t.test('clone', function(t) {
        t.test('array', function(t) {
            var input = [false, 1, 'two'];
            var output = util.clone(input);
            t.notEqual(input, output);
            t.deepEqual(input, output);
            t.end();
        });

        t.test('object', function(t) {
            var input = {a: false, b: 1, c: 'two'};
            var output = util.clone(input);
            t.notEqual(input, output);
            t.deepEqual(input, output);
            t.end();
        });

        t.test('deep object', function(t) {
            var input = {object: {a: false, b: 1, c: 'two'}};
            var output = util.clone(input);
            t.notEqual(input.object, output.object);
            t.deepEqual(input.object, output.object);
            t.end();
        });

        t.test('deep array', function(t) {
            var input = {array: [false, 1, 'two']};
            var output = util.clone(input);
            t.notEqual(input.array, output.array);
            t.deepEqual(input.array, output.array);
            t.end();
        });

        t.end();
    });

    if (process.browser) {
        t.test('timed: no duration', function(t) {
            var context = { foo: 'bar' };
            util.timed(function(step) {
                t.deepEqual(this, context);
                t.equal(step, 1);
                t.end();
            }, 0, context);
        });
        t.test('timed: duration', function(t) {
            var context = { foo: 'bax' };
            util.timed(function(step) {
                t.deepEqual(this, context);
                if (step === 1) {
                    t.end();
                } else {
                    t.ok(step < 1);
                }
            }, 100, context);
        });
    }

    t.end();
});
