'use strict';

var test = require('tape').test;
var StyleConstant = require('../../../js/style/styleconstant.js');

test('StyleConstant.resolve', function(t) {
    test('resolves simple types', function(t) {
        t.deepEqual(StyleConstant.resolve({"a": "a"}, {}), {"a": "a"});
        t.deepEqual(StyleConstant.resolve({"a": "a", "b": "b"}, {}), {"a": "a", "b": "b"});
        t.deepEqual(StyleConstant.resolve({"a": "b"}, {"a": "a"}), {"a": "b"});
        t.deepEqual(StyleConstant.resolve({"a": "@a"}, {"@a": "a"}), {"a": "a"});
        t.deepEqual(StyleConstant.resolve({"a": "@a"}, {"@a": "a"}), {"a": "a"});
        t.deepEqual(StyleConstant.resolve({"a": "@a", "b": "b"}, {"@a": "a"}), {"a": "a", "b": "b"});
        t.end();
    });

    test('does not modify in place', function(t) {
        var p = {};
        t.notEqual(StyleConstant.resolve(p, {}), p);
        t.end();
    });

    test('resolves array values', function(t) {
        var properties = {
            "array": ["@a", "b"]
        };

        var constants = {
            "@a": "a"
        };

        t.deepEqual(StyleConstant.resolve(properties, constants), {
            "array": ["a", "b"]
        });

        t.equal(properties.array[0], "@a");

        t.end();
    });

    test('resolves function values', function(t) {
        var properties = {
            "function": {
                "stops": [[0, "@a"], [1, "@b"]]
            }
        };

        var constants = {
            "@a": "a",
            "@b": "b"
        };

        t.deepEqual(StyleConstant.resolve(properties, constants), {
            "function": {
                "stops": [[0, "a"], [1, "b"]]
            }
        });

        t.equal(properties.function.stops[0][1], "@a");

        t.end();
    });

    t.end();
});
