'use strict';

const test = require('mapbox-gl-js-test').test;
const StyleDeclaration = require('../../../src/style/style_declaration');

test('StyleDeclaration', (t) => {
    t.test('with minimum value', (t) => {
        t.equal((new StyleDeclaration({type: "number", minimum: -2}, -5)).calculate({zoom: 0}), -2);
        t.equal((new StyleDeclaration({type: "number", minimum: -2}, 5)).calculate({zoom: 0}), 5);
        t.end();
    });

    t.test('interpolated functions', (t) => {
        const reference = {type: "number", function: "interpolated"};
        t.equal((new StyleDeclaration(reference, { stops: [[0, 1]] })).calculate({zoom: 0}), 1);
        t.equal((new StyleDeclaration(reference, { stops: [[2, 2], [5, 10]] })).calculate({zoom: 0}), 2);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [5, 10]] })).calculate({zoom: 12}), 10);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [5, 10]] })).calculate({zoom: 6}), 10);
        t.equal(Math.round((new StyleDeclaration(reference, { stops: [[0, 0], [5, 10]], base: 1.01 })).calculate({zoom: 2.5})), 5);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [1, 10], [2, 20]] })).calculate({zoom: 2}), 20);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0], [1, 10], [2, 20]] })).calculate({zoom: 1}), 10);
        t.equal((new StyleDeclaration(reference, { stops: [[0, 0]] })).calculate({zoom: 6}), 0);
        t.end();
    });

    t.test('piecewise-constant function', (t) => {
        const decl = new StyleDeclaration({type: "array", function: "piecewise-constant"}, {stops: [[0, [0, 10, 5]]]});
        t.deepEqual(decl.calculate({zoom: 0}), [0, 10, 5]);
        t.end();
    });

    t.end();
});
