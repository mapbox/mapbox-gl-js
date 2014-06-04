'use strict';
var test = require('tape').test;

var Buffer = require('../js/geometry/buffer.js'),
    Point = require('../js/geometry/point.js'),
    LineVertexBuffer = require('../js/geometry/linevertexbuffer.js');

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
