'use strict';

var test = require('tap').test;
var StyleDeclaration = require('../../../js/style/style_declaration');

test('StyleDeclaration', function(t) {
    t.test('constant', function(t) {
        t.equal((new StyleDeclaration({type: "number"}, 5)).calculate({zoom: 0}), 5);
        t.equal((new StyleDeclaration({type: "number"}, 5)).calculate({zoom: 100}), 5);
        t.ok((new StyleDeclaration({type: "number"}, 5)).isFeatureConstant);
        t.ok((new StyleDeclaration({type: "number"}, 5)).isZoomConstant);
        t.end();
    });

    t.test('interpolated functions', function(t) {
        var reference = {type: "number", function: "interpolated"};
        t.equal((new StyleDeclaration(reference, { stops: [[0, 1]] })).calculate({zoom: 0}), 1);
        t.equal((new StyleDeclaration(reference, { stops: [[2, 2], [5, 10]] })).calculate({zoom: 0}), 2);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [5, 10]] })).calculate({zoom: 12}), 10);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [5, 10]] })).calculate({zoom: 6}), 10);
        t.equal(Math.round((new StyleDeclaration(reference, { stops: [[0, 0], [5, 10]], base: 1.01 })).calculate({zoom: 2.5})), 5);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [1, 10], [2, 20]] })).calculate({zoom: 2}), 20);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [1, 10], [2, 20]] })).calculate({zoom: 1}), 10);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0]] })).calculate({zoom: 6}), 0);
        t.ok((new StyleDeclaration(reference, { stops: [[0, 1]] })).isFeatureConstant);
        t.notOk((new StyleDeclaration(reference, { stops: [[0, 1]] })).isZoomConstant);
        t.end();
    });

    t.test('non-interpolated piecewise-constant function', function(t) {
        var decl = new StyleDeclaration({type: "array", function: "piecewise-constant"}, {stops: [[0, [0, 10, 5]]]});
        t.deepEqual(decl.calculate({zoom: 0}), [0, 10, 5]);
        t.end();
    });

    t.test('interpolated piecewise-constant function', function(t) {
        var reference = {type: "image", function: "piecewise-constant", transition: true};

        var constant = new StyleDeclaration(reference, 'a.png');
        t.deepEqual(
            constant.calculate({zoom: 0, zoomHistory: { lastIntegerZoomTime: 0, lastIntegerZoom: 0 }, duration: 300}),
            { to: 'a.png', toScale: 1, from: 'a.png', fromScale: 0.5, t: 1 }
        );

        var variable = new StyleDeclaration(reference, {stops: [[0, 'a.png'], [1, 'b.png']]});
        t.deepEqual(
            variable.calculate({
                zoom: 1,
                zoomHistory: { lastIntegerZoomTime: 0, lastIntegerZoom: 0 },
                duration: 300
            }),
            { to: 'b.png', toScale: 1, from: 'a.png', fromScale: 2, t: 1 }
        );

        var unset = new StyleDeclaration(reference, undefined);
        t.deepEqual(
            unset.calculate({
                zoom: 1,
                zoomHistory: { lastIntegerZoomTime: 0, lastIntegerZoom: 0 },
                duration: 300
            }),
            undefined
        );

        t.end();
    });

    t.test('color parsing', function(t) {
        var reference = {type: "color", function: "interpolated"};
        t.deepEqual(new StyleDeclaration(reference, 'red').calculate({zoom: 0}), [ 1, 0, 0, 1 ]);
        t.deepEqual(new StyleDeclaration(reference, '#ff00ff').calculate({zoom: 0}), [ 1, 0, 1, 1 ]);
        t.deepEqual(new StyleDeclaration(reference, { stops: [[0, '#f00'], [1, '#0f0']] }).calculate({zoom: 0}), [1, 0, 0, 1]);
        t.throws(function () {
            t.ok(new StyleDeclaration(reference, { stops: [[0, '#f00'], [1, null]] }));
        }, /Invalid color/);
        t.throws(function() {
            // hex value with only 5 digits should throw an Invalid color error
            t.ok(new StyleDeclaration(reference, '#00000'));
        }, Error, /Invalid color/i);
        // cached
        t.deepEqual(new StyleDeclaration(reference, '#ff00ff').calculate({zoom: 0}), [ 1, 0, 1, 1 ]);
        t.deepEqual(new StyleDeclaration(reference, 'rgba(255, 51, 0, 1)').calculate({zoom: 0}), [ 1, 0.2, 0, 1 ]);
        t.end();
    });

    t.test('property functions', function(t) {
        var declaration = new StyleDeclaration(
            {type: "number", function: "interpolated"},
            { stops: [[0, 1]], property: 'mapbox' }
        );

        t.notOk(declaration.isFeatureConstant);
        t.ok(declaration.isZoomConstant);

        t.end();
    });

    t.end();
});
