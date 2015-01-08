'use strict';

var test = require('tape');
var Point = require('point-geometry');

require('../../bootstrap');

var Buffer = require('../../../js/data/buffer/buffer');
var LineVertexBuffer = require('../../../js/data/buffer/line_vertex_buffer');

test('LineVertexBuffer', function(t) {
    var buf = new Buffer();
    t.ok(new LineVertexBuffer(buf), 'default buffer');
    var lineElems = new LineVertexBuffer(buf);
    lineElems.setupViews();
    t.equal(lineElems.itemSize, 8);
    t.equal(lineElems.add(new Point(0, 0), new Point(0, 0), 0, 0), 0);
    t.equal(lineElems.pos, 8);
    t.end();
});
