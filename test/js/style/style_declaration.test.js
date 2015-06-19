'use strict';

var test = require('prova');
var StyleDeclaration = require('../../../js/style/style_declaration');

test('StyleDeclaration', function(t) {
    t.test('constant', function(t) {
        t.equal((new StyleDeclaration({type: "number"}, 5)).calculate({$zoom: 0})({}), 5);
        t.equal((new StyleDeclaration({type: "number"}, 5)).calculate({$zoom: 100})({}), 5);
        t.end();
    });

    t.test('interpolated functions', function(t) {
        var reference = {type: "number", function: "continuous"};
        t.equal((new StyleDeclaration(reference, { domain: [0], range: [1] })).calculate({$zoom: 0})({}), 1);
        t.equal((new StyleDeclaration(reference, { domain: [2, 5], range: [2, 10] })).calculate({$zoom: 0})({}), 2);
        t.equal((new StyleDeclaration(reference, { domain: [0, 5], range: [0, 10] })).calculate({$zoom: 12})({}), 10);
        t.equal((new StyleDeclaration(reference, { domain: [0, 5], range: [0, 10] })).calculate({$zoom: 6})({}), 10);
        t.equal(Math.round((new StyleDeclaration(reference, { domain: [0, 5], range: [0, 10], base: 1.01 })).calculate({$zoom: 2.5})({})), 5);
        t.equal((new StyleDeclaration(reference, { domain: [0, 1, 2], range: [0, 10, 20] })).calculate({$zoom: 2})({}), 20);
        t.equal((new StyleDeclaration(reference, { domain: [0, 1, 2], range: [0, 10, 20] })).calculate({$zoom: 1})({}), 10);
        t.equal((new StyleDeclaration(reference, { domain: [0], range: [0] })).calculate({$zoom: 6})({}), 0);
        t.end();
    });

    t.test('non-interpolated piecewise-constant function', function(t) {
        var decl = new StyleDeclaration({ type: "array", function: "discrete" }, { type: 'interval', domain: [0], range: [[0, 10, 5], [0, 10, 5]] });
        t.deepEqual(decl.calculate({$zoom: 0})({}), [0, 10, 5]);
        t.end();
    });

    t.test('interpolated piecewise-constant function', function(t) {
        var reference = {type: "image", function: "discrete", transition: true};

        var constant = new StyleDeclaration(reference, 'a.png');
        t.deepEqual(constant.calculate({$zoom: 0}, { lastIntegerZoomTime: 0, lastIntegerZoom: 0 }, 300)({}),
            { to: 'a.png', toScale: 1, from: 'a.png', fromScale: 0.5, t: 1 });

        var variable = new StyleDeclaration(reference, { type: 'interval', domain: [0, 1], range: ['a.png', 'a.png', 'b.png'] });
        t.deepEqual(variable.calculate({$zoom: 1}, { lastIntegerZoomTime: 0, lastIntegerZoom: 0 }, 300)({}),
            { to: 'b.png', toScale: 1, from: 'a.png', fromScale: 2, t: 1 });

        t.end();
    });

    t.test('color parsing', function(t) {
        var reference = {type: "color", function: "continuous"};
        t.deepEqual(new StyleDeclaration(reference, 'red').calculate({$zoom: 0})({}), [ 1, 0, 0, 1 ]);
        t.deepEqual(new StyleDeclaration(reference, '#ff00ff').calculate({$zoom: 0})({}), [ 1, 0, 1, 1 ]);
        t.deepEqual(new StyleDeclaration(reference, { domain: [0, 1], range: ['#f00', '#0f0'] }).calculate({$zoom: 0})({}), [1, 0, 0, 1]);
        t.deepEqual(new StyleDeclaration(reference, ['lighten', -50, '#FFF']).calculate({$zoom: 0})({}),
            [0.5, 0.5, 0.5, 1]);
        t.deepEqual(new StyleDeclaration(reference, ['lighten', -30, ['mix', 20, '#551A8B',
            ['saturate', 10, '#FF0000']]]).calculate({$zoom: 0})({}),
            [0.2804597701149426, 0.006599053414469202, 0.035279554792739365, 1]);
        // cached
        t.deepEqual(new StyleDeclaration(reference, '#ff00ff').calculate({$zoom: 0})({}), [ 1, 0, 1, 1 ]);
        t.deepEqual(new StyleDeclaration(reference, 'rgba(255, 51, 0, 1)').calculate({$zoom: 0})({}), [ 1, 0.2, 0, 1 ]);
        t.end();
    });
});
