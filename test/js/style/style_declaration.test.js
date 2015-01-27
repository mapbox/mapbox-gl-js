'use strict';

var test = require('tape');
var StyleDeclaration = require('../../../js/style/style_declaration');

test('styledeclaration', function(t) {

    t.test('boolean', function(t) {
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-antialias', false)).calculate(0), false);
        t.end();
    });

    t.test('image', function(t) {
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-image', 'smilingclownstaringatyou.png')).calculate(0),
            'smilingclownstaringatyou.png');
        t.end();
    });

    t.test('keywords', function(t) {
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-translate-anchor', 'viewport')).calculate(0),
            'viewport');
        t.end();
    });

    t.test('parseWidthArray', function(t) {
        var dashFn = new StyleDeclaration('paint', 'line', 'line-dasharray', [0, 10, 5]);
        t.ok(dashFn instanceof StyleDeclaration);
        t.deepEqual(dashFn.calculate(0), [0, 10, 5]);
        t.end();
    });

    t.test('constant', function(t) {
        t.equal((new StyleDeclaration('paint', 'line', 'line-width', 5)).calculate(0), 5);
        t.equal((new StyleDeclaration('paint', 'line', 'line-width', 5)).calculate(100), 5);
        t.end();
    });

    t.test('paint functions', function(t) {
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-opacity', { stops: [] })).calculate(0), 1);
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-opacity', { stops: [[2, 2], [5, 10]] })).calculate(0), 2);
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-opacity', { stops: [[0, 0], [5, 10]] })).calculate(12), 10);
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-opacity', { stops: [[0, 0], [5, 10]] })).calculate(6), 10);
        t.equal(Math.round((new StyleDeclaration('paint', 'fill', 'fill-opacity', { stops: [[0, 0], [5, 10]], base: 1.01 })).calculate(2.5)), 5);
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-opacity', { stops: [[0, 0], [1, 10], [2, 20]] })).calculate(2), 20);
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-opacity', { stops: [[0, 0], [1, 10], [2, 20]] })).calculate(1), 10);
        t.equal((new StyleDeclaration('paint', 'fill', 'fill-opacity', { stops: [[0, 0]] })).calculate(6), 0);

        t.end();
    });

    t.test('layout functions', function(t) {
        t.equal((new StyleDeclaration('layout', 'line', 'line-miter-limit', { stops: [] })).calculate(0), 1);
        t.equal((new StyleDeclaration('layout', 'symbol', 'symbol-min-distance', { stops: [[8, 0], [12, 250]] })).calculate(6), 0);
        t.equal((new StyleDeclaration('layout', 'symbol', 'icon-rotate', { stops: [[8, 0], [12, 360]] })).calculate(11), 270);
        t.deepEqual((new StyleDeclaration('layout', 'symbol', 'text-offset', [{ stops: [[8, 0], [12, 10]] }, 10])).calculate(10), [5, 10]);

        t.end();
    });

    t.test('color parsing', function(t) {
        t.deepEqual(new StyleDeclaration('paint', 'line', 'line-color', 'red').calculate(0), [ 1, 0, 0, 1 ]);
        t.deepEqual(new StyleDeclaration('paint', 'line', 'line-color', '#ff00ff').calculate(0), [ 1, 0, 1, 1 ]);
        t.deepEqual(new StyleDeclaration('paint', 'line', 'line-color', { stops: [[0, '#f00'], [1, '#0f0']] }).calculate(0), [1, 0, 0, 1]);
        // cached
        t.deepEqual(new StyleDeclaration('paint', 'line', 'line-color', '#ff00ff').calculate(0), [ 1, 0, 1, 1 ]);
        t.deepEqual(new StyleDeclaration('paint', 'line', 'line-color', 'rgba(255, 51, 0, 1)').calculate(0), [ 1, 0.2, 0, 1 ]);
        t.end();
    });

    t.equal((new StyleDeclaration('paint', '', 'unknown-prop')).prop, undefined, 'unknown prop');

    var widthfn = new StyleDeclaration('paint', 'line', 'line-width', function(z) {
        return Math.pow(z, 2);
    });
    t.equal(widthfn.calculate(10), 100);

    t.end();
});
