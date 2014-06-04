'use strict';
var test = require('tape').test;

var Buffer = require('../js/geometry/buffer.js'),
    FillVertexBuffer = require('../js/geometry/fillvertexbuffer.js');

test('FillVertexBuffer', function(t) {
    var buf = new Buffer();
    t.ok(new FillVertexBuffer(buf), 'default buffer');
    var fillVertexes = new FillVertexBuffer(buf);
    fillVertexes.setupViews();
    t.equal(fillVertexes.itemSize, 4);
    t.equal(fillVertexes.arrayType, 'ARRAY_BUFFER');
    t.equal(fillVertexes.add(0, 0), undefined);
    t.equal(fillVertexes.pos, 4);
    t.equal(fillVertexes.addDegenerate(), undefined);
    t.equal(fillVertexes.pos, 8);
    t.end();
});
