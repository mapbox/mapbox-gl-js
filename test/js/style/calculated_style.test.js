'use strict';

var test = require('tape').test;
var CalculatedStyle = require('../../../js/style/calculated_style');

test('CalculatedStyle', function(t) {
    test('resolves default values', function(t) {
        var f = new CalculatedStyle.fill();
        t.equal(f["fill-opacity"], 1);
        t.end();
    });

    test('parses default colors', function(t) {
        var f = new CalculatedStyle.fill();
        t.deepEqual(f["fill-color"], [0, 0, 0, 1]);
        t.end();
    });

    t.end();
});
