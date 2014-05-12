'use strict';
var test = require('tape').test;
var util = require('../js/util/util.js');

test('util', function(t) {
    t.equal(util.easeCubicInOut(0), 0, 'easeCubicInOut=0');
    t.equal(util.easeCubicInOut(0.5), 0.5, 'easeCubicInOut=0.5');
    t.equal(util.easeCubicInOut(1), 1, 'easeCubicInOut=1');
    t.equal(util.interp(0, 1, 0.5), 0.5, 'interp=0.5');
    t.deepEqual(util.premultiply([0, 1, 2, 2]), [0, 2, 4, 2], 'premultiply');
    t.deepEqual(util.keysDifference({a:1}, {}), ['a'], 'keysDifference');
    t.deepEqual(util.extend({a:1}, {b:2}), {a:1,b:2}, 'extend');
    t.end();
});
