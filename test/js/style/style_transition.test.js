'use strict';

const test = require('mapbox-gl-js-test').test;
const StyleDeclaration = require('../../../js/style/style_declaration');
const StyleTransition = require('../../../js/style/style_transition');

test('StyleTransition', (t) => {

    t.test('interpolated piecewise-constant function', (t) => {
        const reference = {type: "image", function: "piecewise-constant", transition: true};
        const options = {duration: 300, delay: 0};

        const constant = new StyleTransition(reference, new StyleDeclaration(reference, 'a.png'), null, options);
        t.deepEqual(
            constant.calculate({zoom: 0}),
            { to: 'a.png', toScale: 1, from: 'a.png', fromScale: 0.5, t: 1 }
        );

        const variable = new StyleTransition(reference,
            new StyleDeclaration(reference, {stops: [[0, 'a.png'], [1, 'b.png']]}), null, options);
        t.deepEqual(
            variable.calculate({zoom: 1}),
            { to: 'b.png', toScale: 1, from: 'a.png', fromScale: 2, t: 1 }
        );

        const unset = new StyleTransition(reference, new StyleDeclaration(reference, undefined), null, options);
        t.deepEqual(
            unset.calculate({zoom: 1}),
            undefined
        );

        t.end();
    });

    t.end();
});
