'use strict';
var test = require('tape').test;
var util = require('../js/util/util.js');

test('util', function(t) {
    t.equal(util.uniqueId(), 1, 'uniqueId');
    t.equal(util.uniqueId(), 2, 'uniqueId');
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

    t.end();
});
