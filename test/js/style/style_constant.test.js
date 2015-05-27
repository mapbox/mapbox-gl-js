'use strict';

var test = require('prova');
var StyleConstant = require('../../../js/style/style_constant');

test('StyleConstant.resolve', function(t) {
    t.test('ignores non-constants', function(t) {
        t.deepEqual(StyleConstant.resolve("a", {}), "a");
        t.end();
    });

    t.test('resolves scalars', function(t) {
        t.deepEqual(StyleConstant.resolve("@a", {"@a": "a"}), "a");
        t.end();
    });

    t.test('resolves array values', function(t) {
        t.deepEqual(StyleConstant.resolve(["@a", "b"], {"@a": "a"}), ["a", "b"]);
        t.end();
    });

    t.test('resolves function values', function(t) {
        var fun = {
            "stops": [[0, "@a"], [1, "@b"]]
        };

        var constants = {
            "@a": "a",
            "@b": "b"
        };

        t.deepEqual(StyleConstant.resolve(fun, constants), {
            "stops": [[0, "a"], [1, "b"]]
        });
        t.end();
    });
});

test('StyleConstant.resolveAll', function(t) {
    t.test('resolves all constants', function(t) {
        t.deepEqual(StyleConstant.resolveAll(
            {"a": "@a", "b": "@b"},
            {"@a": "a", "@b": "b"}),
            {"a": "a", "b": "b"});
        t.end();
    });

    t.test('does not modify in place', function(t) {
        var p = {};
        t.notEqual(StyleConstant.resolveAll(p, {}), p);
        t.end();
    });

    t.test('no constants', function(t) {
        t.deepEqual(StyleConstant.resolveAll({"a": "a"}), {"a": "a"});
        t.deepEqual(StyleConstant.resolveAll({"a": [1, 2]}), {"a": [1, 2]});
        t.deepEqual(StyleConstant.resolveAll({"a": {"stops": [[1, 2]]}}), {"a": {"stops": [[1, 2]]}});
        t.end();
    });
});
