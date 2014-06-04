'use strict';
var test = require('tape').test;

var Buffer = require('../js/geometry/buffer.js'),
    Point = require('../js/geometry/point.js'),
    PointVertexBuffer = require('../js/geometry/pointvertexbuffer.js');

test('PointVertexBuffer', function(t) {
    var buf = new Buffer();
    t.ok(new PointVertexBuffer(buf), 'default buffer');
    var lineElems = new PointVertexBuffer(buf);
    lineElems.setupViews();
    t.equal(lineElems.itemSize, 18);
    t.equal(lineElems.add(0, 0, [12,12], [0,0], [4,4], 0, 0, [0, 0]), undefined);
    t.equal(lineElems.pos, 18);
    t.end();
});
