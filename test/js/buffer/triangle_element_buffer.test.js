'use strict';

var test = require('prova');
var TriangleElementBuffer = require('../../../js/data/buffer/triangle_element_buffer');

test('TriangleElementBuffer', function(t) {
    var buf = new TriangleElementBuffer();
    t.ok(new TriangleElementBuffer(buf), 'default buffer');
    var triangleElems = new TriangleElementBuffer(buf);
    triangleElems.setupViews();
    t.equal(triangleElems.itemSize, 6);
    t.equal(triangleElems.arrayType, 'ELEMENT_ARRAY_BUFFER');
    t.equal(triangleElems.add(0, 0, 0), undefined);
    t.equal(triangleElems.pos, 6);
    t.end();
});
