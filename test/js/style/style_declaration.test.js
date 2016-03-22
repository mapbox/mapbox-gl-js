'use strict';

var test = require('tap').test;
var StyleDeclaration = require('../../../js/style/style_declaration');

test('StyleDeclaration', function(t) {
    t.test('constant', function(t) {
        t.equal((new StyleDeclaration({type: "number"}, 5)).calculate(0), 5);
        t.equal((new StyleDeclaration({type: "number"}, 5)).calculate(100), 5);
        t.end();
    });

    t.test('interpolated functions', function(t) {
        var reference = {type: "number", function: "interpolated"};
        t.equal((new StyleDeclaration(reference, { stops: [[0, 1]] })).calculate(0), 1);
        t.equal((new StyleDeclaration(reference, { stops: [[2, 2], [5, 10]] })).calculate(0), 2);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [5, 10]] })).calculate(12), 10);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [5, 10]] })).calculate(6), 10);
        t.equal(Math.round((new StyleDeclaration(reference, { stops: [[0, 0], [5, 10]], base: 1.01 })).calculate(2.5)), 5);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [1, 10], [2, 20]] })).calculate(2), 20);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [1, 10], [2, 20]] })).calculate(1), 10);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0]] })).calculate(6), 0);
        t.end();
    });

    t.test('non-interpolated piecewise-constant function', function(t) {
        var decl = new StyleDeclaration({type: "array", function: "piecewise-constant"}, {stops: [[0, [0, 10, 5]]]});
        t.deepEqual(decl.calculate(0), [0, 10, 5]);
        t.end();
    });

    t.test('interpolated piecewise-constant function', function(t) {
        var reference = {type: "image", function: "piecewise-constant", transition: true};

        var constant = new StyleDeclaration(reference, 'a.png');
        t.deepEqual(constant.calculate(0, { lastIntegerZoomTime: 0, lastIntegerZoom: 0 }, 300),
            { to: 'a.png', toScale: 1, from: 'a.png', fromScale: 0.5, t: 1 });

        var variable = new StyleDeclaration(reference, {stops: [[0, 'a.png'], [1, 'b.png']]});
        t.deepEqual(variable.calculate(1, { lastIntegerZoomTime: 0, lastIntegerZoom: 0 }, 300),
            { to: 'b.png', toScale: 1, from: 'a.png', fromScale: 2, t: 1 });

        t.end();
    });

    t.test('color parsing', function(t) {
        var reference = {type: "color", function: "interpolated"};
        t.deepEqual(new StyleDeclaration(reference, 'red').calculate(0), [ 1, 0, 0, 1 ]);
        t.deepEqual(new StyleDeclaration(reference, '#ff00ff').calculate(0), [ 1, 0, 1, 1 ]);
        t.deepEqual(new StyleDeclaration(reference, { stops: [[0, '#f00'], [1, '#0f0']] }).calculate(0), [1, 0, 0, 1]);
        t.throws(function () {
            t.ok(new StyleDeclaration(reference, { stops: [[0, '#f00'], [1, null]] }));
        }, /Invalid color/);
        t.throws(function() {
            // hex value with only 5 digits should throw an Invalid color error
            t.ok(new StyleDeclaration(reference, '#00000'));
        }, Error, /Invalid color/i);
        // cached
        t.deepEqual(new StyleDeclaration(reference, '#ff00ff').calculate(0), [ 1, 0, 1, 1 ]);
        t.deepEqual(new StyleDeclaration(reference, 'rgba(255, 51, 0, 1)').calculate(0), [ 1, 0.2, 0, 1 ]);
        t.end();
    });

    t.end();
});
