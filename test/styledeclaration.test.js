'use strict';
var test = require('tape').test;
var StyleDeclaration = require('../js/style/styledeclaration.js');

test('styledeclaration', function(t) {
    var opacity = new StyleDeclaration('opacity', 0, {});
    t.equal(opacity.calculate(10), 0);

    /*
     * waiting on non-canvas color parser
    var color = new StyleDeclaration('color', 'red', {});
    t.deepEqual(color.calculate(10), [1, 0, 0, 1]);
    */

    var width = new StyleDeclaration('width', 'widthvar', {
        widthvar: 10
    });
    t.equal(width.calculate(10), 10);

    var widthfn = new StyleDeclaration('width', function(z) {
        return Math.pow(z, 2);
    });
    t.equal(widthfn.calculate(10), 100);

    t.end();
});
