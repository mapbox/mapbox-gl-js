'use strict';

const test = require('mapbox-gl-js-test').test;
const StyleDeclaration = require('../../../src/style/style_declaration');
const Color = require('../../../src/style-spec/util/color');

test('StyleDeclaration', (t) => {
    t.test('with minimum value', (t) => {
        t.equal((new StyleDeclaration({type: "number", minimum: -2}, -5)).calculate({zoom: 0}), -2);
        t.equal((new StyleDeclaration({type: "number", minimum: -2}, 5)).calculate({zoom: 0}), 5);
        t.end();
    });

    t.test('number constant', (t) => {
        const d = new StyleDeclaration({type: 'number'}, 1);

        t.ok(d.isZoomConstant());
        t.ok(d.isFeatureConstant());

        t.equal(d.calculate({zoom: 0}), 1);
        t.equal(d.calculate({zoom: 1}), 1);
        t.equal(d.calculate({zoom: 2}), 1);

        t.end();
    });

    t.test('string constant', (t) => {
        const d = new StyleDeclaration({type: 'string'}, 'mapbox');

        t.ok(d.isZoomConstant());
        t.ok(d.isFeatureConstant());

        t.equal(d.calculate({zoom: 0}), 'mapbox');
        t.equal(d.calculate({zoom: 1}), 'mapbox');
        t.equal(d.calculate({zoom: 2}), 'mapbox');

        t.end();
    });

    t.test('color constant', (t) => {
        const d = new StyleDeclaration({type: 'color'}, 'red');

        t.ok(d.isZoomConstant());
        t.ok(d.isFeatureConstant());

        t.deepEqual(d.calculate({zoom: 0}), new Color(1, 0, 0, 1));
        t.deepEqual(d.calculate({zoom: 1}), new Color(1, 0, 0, 1));
        t.deepEqual(d.calculate({zoom: 2}), new Color(1, 0, 0, 1));

        t.end();
    });

    t.test('array constant', (t) => {
        const d = new StyleDeclaration({type: 'array'}, [1]);

        t.ok(d.isZoomConstant());
        t.ok(d.isFeatureConstant());

        t.deepEqual(d.calculate({zoom: 0}), [1]);
        t.deepEqual(d.calculate({zoom: 1}), [1]);
        t.deepEqual(d.calculate({zoom: 2}), [1]);

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
