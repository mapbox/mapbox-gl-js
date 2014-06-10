'use strict';
var test = require('tape').test;
var StyleDeclaration = require('../js/style/styledeclaration.js');

test('styledeclaration', function(t) {
    var opacity = new StyleDeclaration('opacity', 0, {});
    t.equal(opacity.calculate(10), 0);

    t.test('parseWidthArray', function(t) {
        var dashFn = new StyleDeclaration('line-dasharray', [0, 10, 5]);
        t.ok(dashFn instanceof StyleDeclaration);
        t.deepEqual(dashFn.calculate(0), [0, 10, 5]);
        t.end();
    });

    t.test('constant', function(t) {
        t.equal((new StyleDeclaration('point-radius', 5)).calculate(0), 5);
        t.equal((new StyleDeclaration('point-radius', 5)).calculate(100), 5);
        t.end();
    });

    t.test('functions', function(t) {
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'linear' })).calculate(0), 0);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'linear', max: 10, slope: 0.5 })).calculate(10), 5);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'exponential' })).calculate(0), 0);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'min' })).calculate(0), true);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [] })).calculate(0), 1);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [[0, 0], [5, 10]] })).calculate(0), 2);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [[0, 0], [5, 10]] })).calculate(10), 10);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [[0, 0], [5, 10]] })).calculate(6), 10);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [[0, 0], [0, 10]] })).calculate(6), 0);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [[0, 0], [0, 10]] })).calculate(6), 0);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [[0, 0], [1, 10], [2, 20]] })).calculate(2), 20);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [[0, 0], [1, 10], [2, 20]] })).calculate(1), 20);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [[0, 10], [2, 20]] })).calculate(1), 20);
        t.equal((new StyleDeclaration('fill-opacity', { fn: 'stops', stops: [[0, 0]] })).calculate(6), 0);

        t.throws(function() {
            new StyleDeclaration('fill-opacity', { fn: 'blah' });
        }, 'rejects unknown fns');
        t.end();
    });

    t.test('color parsing', function(t) {
        t.deepEqual(new StyleDeclaration('line-color', 'red').calculate(0), [ 1, 0, 0, 1 ]);
        t.deepEqual(new StyleDeclaration('line-color', [0, 0.25, 0, 1]).calculate(0), [0, 0.25, 0, 1]);
        t.deepEqual(new StyleDeclaration('line-color', '#ff00ff').calculate(0), [ 1, 0, 1, 1 ]);
        // cached
        t.deepEqual(new StyleDeclaration('line-color', '#ff00ff').calculate(0), [ 1, 0, 1, 1 ]);
        t.deepEqual(new StyleDeclaration('line-color', 'rgba(255, 51, 0, 1)').calculate(0), [ 1, 0.2, 0, 1 ]);
        t.deepEqual(new StyleDeclaration('line-color', 'rgba(255, 51, 0, 0.5)').calculate(0).map(function(p) {
            return p.toFixed(2);
        }), [ '0.50', '0.10', '0.00', '0.50' ]);
        t.end();
    });

    t.equal((new StyleDeclaration('unknown-prop')).prop, undefined, 'unknown prop');

    var width = new StyleDeclaration('line-width', 'widthvar', {
        widthvar: 10
    });
    t.equal(width.calculate(10), 10);

    var widthfn = new StyleDeclaration('line-width', function(z) {
        return Math.pow(z, 2);
    });
    t.equal(widthfn.calculate(10), 100);

    t.end();
});
