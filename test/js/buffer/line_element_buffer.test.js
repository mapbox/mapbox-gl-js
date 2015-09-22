'use strict';

var test = require('prova');
var LineElementBuffer = require('../../../js/data/buffer/line_element_buffer');

test('LineElementBuffer', function(t) {
    t.ok(new LineElementBuffer(), 'default buffer');
    var lineElems = new LineElementBuffer();
    lineElems.setupViews();
    t.equal(lineElems.itemSize, 6);
    t.equal(lineElems.arrayType, 'ELEMENT_ARRAY_BUFFER');
    t.equal(lineElems.add(0, 0, 0), undefined);
    t.equal(lineElems.pos, 6);
    t.end();
});
