'use strict';

var test = require('prova');
var Point = require('point-geometry');
var LineVertexBuffer = require('../../../js/data/buffer/line_vertex_buffer');

test('LineVertexBuffer', function(t) {
    t.ok(new LineVertexBuffer(), 'default buffer');
    var lineElems = new LineVertexBuffer();
    lineElems.setupViews();
    t.equal(lineElems.itemSize, 8);
    t.equal(lineElems.add(new Point(0, 0), new Point(0, 0), 0, 0), 0);
    t.equal(lineElems.pos, 8);
    t.end();
});
