'use strict';

var test = require('tape');

require('../../bootstrap');

var util = require('../../../js/util/util');

test('util', function(t) {
    t.equal(util.easeCubicInOut(0), 0, 'easeCubicInOut=0');
    t.equal(util.easeCubicInOut(0.2), 0.03200000000000001);
    t.equal(util.easeCubicInOut(0.5), 0.5, 'easeCubicInOut=0.5');
    t.equal(util.easeCubicInOut(1), 1, 'easeCubicInOut=1');
    t.equal(util.interp(0, 1, 0.5), 0.5, 'interp=0.5');
    t.deepEqual(util.premultiply([0, 1, 2, 2]), [0, 2, 4, 2], 'premultiply');
    t.deepEqual(util.keysDifference({a:1}, {}), ['a'], 'keysDifference');
    t.deepEqual(util.keysDifference({a:1}, {a:1}), [], 'keysDifference');
    t.deepEqual(util.extend({a:1}, {b:2}), {a:1,b:2}, 'extend');

    t.test('bezier', function(t) {
        var curve = util.bezier(0, 0, 0.25, 1);
        t.ok(curve instanceof Function, 'returns a function');
        t.equal(curve(0), 0);
        t.equal(curve(1), 1);
        t.equal(curve(0.5), 0.8230854638965502);
        t.end();
    });

    t.test('asyncEach', function(t) {
        var expect = 1;
        util.asyncEach([], function(callback) { callback(); }, function() {
            t.ok('immediate callback');
        });
        util.asyncEach([1, 2, 3], function(number, callback) {
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
