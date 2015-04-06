'use strict';

var test = require('tape');
var Buffer = require('../../../js/data/buffer/buffer');
var TriangleElementsBuffer = require('../../../js/data/buffer/triangle_element_buffer');

test('TriangleElementsBuffer', function(t) {
    var buf = new Buffer();
    t.ok(new TriangleElementsBuffer(buf), 'default buffer');
    var triangleElems = new TriangleElementsBuffer(buf);
    triangleElems.setupViews();
    t.equal(triangleElems.itemSize, 6);
    t.equal(triangleElems.arrayType, 'ELEMENT_ARRAY_BUFFER');
    t.equal(triangleElems.add(0, 0, 0), undefined);
    t.equal(triangleElems.pos, 6);
    t.end();
});
